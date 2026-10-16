import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const sizes = [[320,480],[320,568],[360,640],[375,667],[390,844],[568,320],[667,375],[844,390],[768,1024],[1366,768]];
let roundId = 0;

// Deterministic eight-player snapshots exercise layouts; the real room flow,
// private ballots, reconnection and winner transitions are in spyfall-browser.
async function fixture(phase = 'VOTING', count = 8, remaining = 60000) {
  await page.evaluate(async ({ phase, count, remaining, roundId }) => {
    const { spySession } = await import('/src/session.ts');
    const { navigate } = await import('/src/router.ts');
    const players = Array.from({ length: count }, (_, seat) => ({
      id: `p${seat}`, name: seat === 0 ? 'เจ้าของชื่อยาวทดสอบ' : `ผู้ต้องสงสัยชื่อยาว ${seat}`,
      seat, connected: seat !== 7, ready: false, readyVote: true, hasVoted: seat > 1, score: seat,
    }));
    const snapshot = { game: 'spyfall', code: 'ABCDEF0123', phase, roundId,
      deadline: phase === 'RESULTS' ? 0 : Date.now() + remaining,
      hostId: 'p0', questionMinutes: 5, votingMinutes: 1, guessMinutes: 1, playerCount: 8, phaseDurationMs: 60000, votingDurationMs: 60000,
      guessDurationMs: 60000, players, chat: [], caughtSpyId: phase === 'GUESS' ? 'p0' : null, result: null };
    window.confirmedVotes = [];
    window.spyAnswers = [];
    spySession.send = (type, value) => {
      if (type === 'guess' || type === 'surrender') { window.spyAnswers.push({ type, value }); return; }
      if (type !== 'vote') return;
      window.confirmedVotes.push(value);
      const state = spySession.getSnapshot();
      spySession.update({ snapshot: { ...state.snapshot, players: state.snapshot.players.map(p => ({ ...p, hasVoted: p.id === 'p0' || p.hasVoted })) },
        secret: { roundId, role: { ...state.secret.role, ownVote: value } } });
    };
    spySession.update({ status: 'connected', playerId: 'p0', error: '', snapshot,
      secret: { roundId, role: phase === 'GUESS' ? { kind: 'spy', ownVote: null } : { kind: 'citizen', location: 'โรงเรียน', occupation: 'ครู', ownVote: null } } });
    navigate('/spyfall/play/ABCDEF0123');
  }, { phase, count, remaining, roundId: ++roundId });
  if (phase === 'VOTING') await page.getByRole('dialog', { name: 'ใครคือ Spy?' }).waitFor();
  if (phase === 'GUESS') await page.getByRole('dialog', { name: 'Spy ตอบสถานที่', exact: true }).waitFor();
}

async function fits(label) {
  const report = await page.evaluate(() => {
    const selectors = ['.spy-voting-dialog', '.spy-voting-heading', '.spy-voting-confirm', '.spy-voting-clock', '.spy-voting-note'];
    const clipped = selectors.filter(selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return r.top < 0 || r.left < 0 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1;
    });
    const overflow = [...document.querySelectorAll('.spy-voting-dialog,.spy-voting-list,.spy-vote-option,.spy-voting-footer')]
      .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className);
    const footer = document.querySelector('.spy-voting-footer').getBoundingClientRect();
    const list = document.querySelector('.spy-voting-list').getBoundingClientRect();
    const button = document.querySelector('.spy-voting-confirm');
    const b = button.getBoundingClientRect();
    return { clipped, overflow, overlap: list.bottom > footer.top + 1, modal: document.querySelector('dialog').matches(':modal'),
      reachable: button.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)),
      columns: getComputedStyle(document.querySelector('.spy-voting-list')).gridTemplateColumns.split(' ').length };
  });
  assert.deepEqual(report.clipped, [], label + ': visible controls');
  assert.deepEqual(report.overflow, [], label + ': no horizontal clipping');
  assert.equal(report.overlap, false, label + ': list and footer remain separate');
  assert.equal(report.modal, true); assert.equal(report.reachable, true); assert.equal(report.columns, 2);
}

try {
  await page.goto('http://127.0.0.1:5188');
  await fixture('QUESTION');assert.equal(await page.getByRole('dialog').count(), 0);
  for (const count of [3, 8]) for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await fixture('VOTING', count); await fits(`${count} players ${width}x${height}`);
    assert.equal(await page.locator('.spy-vote-option').count(), count);
    assert.equal(await page.getByRole('button', { name: 'ยืนยันโหวต', exact: true }).isDisabled(), true);
    assert.equal(await page.locator('.spy-vote-option.own').isDisabled(), true);
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').isVisible(), true);
    await page.locator('.spy-vote-option').last().click();
    assert.equal(await page.locator('.spy-vote-option.chosen').count(), 1);
    await fits(`selected ${width}x${height}`);
    await page.locator('.spy-vote-option').nth(1).click();
    assert.equal(await page.locator('.spy-vote-option.chosen').count(), 1);
    await page.getByRole('button', { name: 'ยืนยันโหวต', exact: true }).click();
    await page.getByRole('button', { name: '✓ ยืนยันแล้ว', exact: true }).waitFor();
    assert.equal(await page.locator('.spy-vote-option:not(:disabled)').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.confirmedVotes), ['p1']);
    assert.equal(await page.locator('.spy-vote-stamp.done').count(), count - 1);
    if (count === 8 && (width === 375 || width === 1366)) assert.equal(await page.locator('.spy-voting-list').evaluate(e => e.scrollHeight <= e.clientHeight + 1), true, 'all eight players fit at ' + width + 'x' + height);
    if (count === 8 && (width === 375 || width === 568 || width === 1366)) await page.screenshot({ path: `preview-spyfall-voting-${width}x${height}.png` });
  }
  await fixture('VOTING', 8, 500);
  await page.locator('.spy-vote-option').nth(1).click();
  await page.waitForFunction(() => document.querySelector('.spy-voting-clock strong').textContent === '0');
  assert.equal(await page.getByRole('button', { name: 'ยืนยันโหวต', exact: true }).isDisabled(), true);
  await fixture('QUESTION');assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  for (const [width,height] of [...sizes,[375,320]]) {
    await page.setViewportSize({width,height});await fixture('GUESS');
    assert.equal(await page.getByLabel('เฉลยสถานที่').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').isVisible(),true);
    await page.getByLabel('เฉลยสถานที่').fill('   ');
    assert.equal(await page.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'ยอมแพ้',exact:true}).isEnabled(),true);
    const clipped=await page.evaluate(()=>['.spy-guess-dialog','.spy-guess-fields input','.spy-guess-buttons button:first-child','.spy-guess-buttons button:last-child','.spy-guess-footer .spy-voting-clock'].filter(selector=>{
      const el=document.querySelector(selector),r=el.getBoundingClientRect();
      return r.top<0||r.left<0||r.bottom>innerHeight+1||r.right>innerWidth+1||!el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }));
    assert.deepEqual(clipped,[],`answer popup ${width}x${height}: input, countdown and buttons stay visible`);
    await page.getByLabel('เฉลยสถานที่').fill(' โรงเรียน ');
    await page.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.spyAnswers),[{type:'guess',value:'โรงเรียน'}]);
    assert.equal(await page.getByRole('button',{name:'ยอมแพ้',exact:true}).isDisabled(),true);
    if(width===375||width===568||width===1366)await page.screenshot({path:`preview-spyfall-guess-${width}x${height}.png`});
  }
  await fixture('GUESS');await page.getByRole('button',{name:'ยอมแพ้',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.spyAnswers),[{type:'surrender',value:undefined}]);
  assert.equal(await page.getByLabel('เฉลยสถานที่').isDisabled(),true);
  await fixture('GUESS',8,500);
  await page.waitForFunction(()=>document.querySelector('.spy-guess-footer .spy-voting-clock strong').textContent==='0');
  assert.equal(await page.getByRole('button',{name:'ยอมแพ้',exact:true}).isDisabled(),true);
  await fixture('QUESTION');assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.deepEqual(errors, []);
  console.log('PASS: voting and caught-spy popups, 3/8 players, 11 portrait/landscape/desktop/keyboard sizes, visible controls, single answer/surrender submission, expiry, focus and cleanup');
} finally { await browser.close(); }
