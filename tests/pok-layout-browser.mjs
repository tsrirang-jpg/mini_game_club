import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const sizes = [[320,480],[320,568],[360,640],[375,667],[390,844],[768,1024],[568,320],[667,375],[740,360],[844,390],[932,430],[1024,600],[1366,768]];

// Deterministic public/private snapshots cover three cards and every UI phase.
// Real room actions and reconnection are covered by browser-smoke.mjs.
async function fixture(phase, count = 6, dealer = 'p1', host = 'p0', disconnected = false, catchCount = 0, special = '') {
  await page.evaluate(async ({ phase, count, dealer, host, disconnected, catchCount, special }) => {
    const { session } = await import('/src/session.ts');
    const { navigate } = await import('/src/router.ts');
    const cards = special === 'straightFlush' ? [{rank:12,suit:'clubs'},{rank:13,suit:'clubs'},{rank:1,suit:'clubs'}] : [{ rank: 10, suit: 'hearts' }, { rank: 13, suit: 'spades' }, { rank: 8, suit: 'diamonds' }];
    const value = special ? {score:1,pok:false,multiplier:5,special,highCard:14} : {score:8,pok:false,multiplier:3};
    const players = Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: i === 0 ? 'ผู้เล่นชื่อยาวทดสอบ' : 'ผู้เล่น ' + i, seat: i, points: 1000, bet: 50, isBot: i > 0, ready: true, connected: !(disconnected && i === 1), acted: false, cardCount: phase === 'LOBBY' ? 0 : phase === 'DEALER_ACTION' && 'p' + i === dealer ? 2 : 3 }));
    const revealed = ['REVEAL', 'SETTLEMENT', 'ROUND_END'].includes(phase);
    session.update({ status: 'connected', playerId: 'p0', hand: phase === 'DEALER_ACTION' && dealer === 'p0' ? cards.slice(0,2) : cards, handRound: 1, error: '', snapshot: {
      code: 'ABCDEF0123', phase, roundId: 1, deadline: ['PLAYER_ACTIONS', 'DEALER_ACTION'].includes(phase) ? Date.now() + 600000 : 0,
      hostId: host, dealerId: dealer, players, settled: phase === 'ROUND_END',
      results: revealed ? players.map(p => ({ id: p.id, cards, ...value, outcome: p.id === dealer ? 'DEALER' : 'WIN', delta: p.id === dealer ? -750 : 150 })) : [],
      catches: players.filter(p => p.id !== dealer).slice(0,catchCount).map(p => ({ id:p.id, cards, ...value,outcome:'WIN',delta:50,caught:true,dealerCards:cards.slice(0,2),dealerValue:{score:0,pok:false,multiplier:1} })),
      rules: { actionMs: 30000, dealMs: 900, revealMs: 1800, settlementMs: 500, reconnectSeconds: 60, initialPoints: 1000, maxPlayers: 6, bets: [10,20,50], pairMultiplier: 2, suitedTwoMultiplier: 2, suitedThreeMultiplier: 3, yellowMultiplier:3,tripleMultiplier:5,straightMultiplier:3,straightFlushMultiplier:5 },
    } });
    navigate('/play/ABCDEF0123');
  }, { phase, count, dealer, host, disconnected, catchCount, special });
  await page.locator('.pok-shell .seat').nth(count - 1).waitFor();
}
async function pokDefectFixture(phase) {
  await fixture(phase,5,'p0');
  await page.evaluate(async phase => {
    const { session } = await import('/src/session.ts');
    const state = session.getSnapshot(), s = state.snapshot;
    const dealerCards = [{rank:6,suit:'clubs'},{rank:1,suit:'diamonds'},{rank:1,suit:'spades'}];
    const caught = {id:'p1',cards:[{rank:9,suit:'clubs'},{rank:5,suit:'hearts'},{rank:4,suit:'hearts'}],score:8,pok:false,multiplier:1,outcome:'TIE',delta:0,caught:true,catchRecompared:true,dealerCards,dealerValue:{score:8,pok:false,multiplier:1}};
    const revealedHands = [{id:'p2',cards:[{rank:2,suit:'spades'},{rank:7,suit:'spades'}],score:9,pok:true,multiplier:2},{id:'p3',cards:[{rank:8,suit:'diamonds'},{rank:12,suit:'diamonds'}],score:8,pok:true,multiplier:2}];
    const ended = phase === 'ROUND_END';
    session.update({hand:ended ? dealerCards : dealerCards.slice(0,2),snapshot:{...s,revealedHands,
      players:s.players.map(p => ({...p,cardCount:ended && ['p0','p1'].includes(p.id) ? 3 : 2,acted:['p2','p3'].includes(p.id)})),
      catches:ended ? [caught] : [],
      results:ended ? [caught,{...revealedHands[0],outcome:'WIN',delta:20},{...revealedHands[1],outcome:'TIE',delta:0},
        {id:'p4',cards:[{rank:1,suit:'hearts'},{rank:5,suit:'spades'}],score:6,pok:false,multiplier:1,outcome:'LOSE',delta:-10},
        {id:'p0',cards:dealerCards,score:8,pok:false,multiplier:1,outcome:'DEALER',delta:-10}] : []}});
  },phase);
}

async function fits(label) {
  const report = await page.evaluate(() => {
    const box = e => e.getBoundingClientRect();
    const table = box(document.querySelector('.pok-game .table'));
    const clipped = [...document.querySelectorAll('.pok-game .room-bar,.pok-game .seat,.pok-game .hand,.pok-game .points,.pok-game .result,.pok-game .pok-own-value,.pok-game .player-status,.pok-action-dock,.pok-action-dock button,.pok-action-dock select')].filter(e => {
      const r = box(e); return r.width && r.height && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
    }).map(e => e.className || e.tagName);
    const outside = [...document.querySelectorAll('.pok-game .seat,.pok-game .hand,.pok-game .card')].filter(e => {
      const r = box(e); return r.left < table.left || r.right > table.right || r.top < table.top || r.bottom > table.bottom;
    }).map(e => e.className);
    const cardErrors = [];
    for (const card of document.querySelectorAll('.pok-game .card:not(.back)')) {
      const label = card.querySelector('span:not(.bottom)'), suit = label.querySelector('small');
      const rankRange = document.createRange(); rankRange.selectNodeContents(label.firstChild);
      const suitRange = document.createRange(); suitRange.selectNodeContents(suit);
      const rank = rankRange.getBoundingClientRect(), glyph = suitRange.getBoundingClientRect(), c = box(card);
      const hit = document.elementFromPoint((rank.left + rank.right) / 2, (rank.top + rank.bottom) / 2);
      if (rank.bottom > glyph.top + 1 || rank.left < c.left || rank.right > c.right || rank.top < c.top || glyph.bottom > c.bottom || glyph.left < c.left || glyph.right > c.right || !label.contains(hit)) cardErrors.push({ label: card.getAttribute('aria-label'), rank: rank.toJSON(), suit: glyph.toJSON(), card: c.toJSON(), hit: hit?.className || hit?.tagName });
    }
    const contentOverflow = [...document.querySelectorAll('.pok-game .seat,.pok-game .hand,.pok-action-dock')].filter(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map(e => ({ element: e.className, width: e.clientWidth, scrollWidth: e.scrollWidth, height: e.clientHeight, scrollHeight: e.scrollHeight }));
    const own = box(document.querySelector('.pok-self'));
    const ownSeparate = document.querySelectorAll('.pok-self .seat.own').length === 1 && document.querySelectorAll('.pok-opponents .seat.own').length === 0;
    const opponentsAboveOwn = [...document.querySelectorAll('.pok-opponents .seat')].every(e => box(e).bottom <= own.top + 1);
    const ownCenter = Math.abs((own.left + own.right - table.left - table.right) / 2);
    const ownBottomGap = table.bottom - own.bottom;
    const ownValue = document.querySelector('.pok-self .pok-own-value');
    let ownMetaOverlap = false;
    if (ownValue) {
      const range = document.createRange(); range.selectNodeContents(document.querySelector('.pok-self .points'));
      ownMetaOverlap = range.getBoundingClientRect().right > box(ownValue).left - 2;
    }
    return { clipped, outside, cardErrors, contentOverflow, ownSeparate, opponentsAboveOwn, ownCenter, ownBottomGap, ownMetaOverlap, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, width: innerWidth, height: innerHeight, tableDockOverlap: table.bottom > box(document.querySelector('.pok-action-dock')).top, scrollY };
  });
  assert.deepEqual(report.clipped, [], label + ': clipped controls ' + JSON.stringify(report));
  assert.deepEqual(report.outside, [], label + ': outside table ' + JSON.stringify(report));
  assert.deepEqual(report.contentOverflow, [], label + ': content must fit, not be hidden ' + JSON.stringify(report));
  assert.deepEqual(report.cardErrors, [], label + ': ranks and suits must remain separate and visible');
  assert.ok(report.scrollWidth <= report.width && report.scrollHeight <= report.height, label + ': page must not scroll');
  assert.equal(report.tableDockOverlap, false, label + ': table overlaps actions');
  assert.equal(report.scrollY, 0, label + ': no scrolling to reach controls');
  assert.equal(report.width, page.viewportSize().width, label + ': mobile layout must not shrink to fit overflow');
  assert.equal(report.ownSeparate, true, label + ': own hand has a separate seat');
  assert.equal(report.opponentsAboveOwn, true, label + ': opponents stay above own hand');
  assert.ok(report.ownCenter <= 1 && report.ownBottomGap <= 24, label + ': own hand stays at bottom center');
  assert.equal(await page.locator('.pok-self .pok-own-badge').isVisible(), true, label + ': own hand is clearly labelled');
  assert.equal(report.ownMetaOverlap, false, label + ': own balance and hand value remain separate');
}

try {
  await page.goto(url + '/rooms/create');
  for (const phase of ['LOBBY','DEALING','PLAYER_ACTIONS','DEALER_ACTION','REVEAL','SETTLEMENT','ROUND_END']) {
    await fixture(phase, 6, phase === 'DEALER_ACTION' ? 'p0' : 'p1');
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await fits(phase + ' ' + width + 'x' + height);
      if (phase === 'ROUND_END' && [375,844,1366].includes(width)) await page.screenshot({ path: fileURLToPath(new URL('../preview-pok-fit-' + width + 'x' + height + '.png', import.meta.url)), scale: 'css' });
    }
    console.log('PASS: ' + phase + ' at 13 viewports');
  }
  for (const count of [2,3,4,5]) for (const [width, height] of [[320,480],[375,667],[568,320]]) {
    await page.setViewportSize({ width, height }); await fixture('ROUND_END', count); await fits(count + ' players ' + width + 'x' + height);
  }
  for (const phase of ['DEALING','PLAYER_ACTIONS','ROUND_END']) {
    await pokDefectFixture(phase);
    for (const [width,height] of sizes) { await page.setViewportSize({width,height}); await fits('reported Pok defect ' + phase + ' ' + width + 'x' + height); }
    for (const id of [2,3]) assert.equal(await page.getByRole('article',{name:'ผู้เล่น ผู้เล่น ' + id,exact:true}).locator('.card:not(.back)').count(),2);
    if (phase !== 'ROUND_END') {
      assert.match(await page.getByRole('article',{name:'ผู้เล่น ผู้เล่น 2',exact:true}).textContent(),/ป๊อก 9/);
      assert.match(await page.getByRole('article',{name:'ผู้เล่น ผู้เล่น 3',exact:true}).textContent(),/ป๊อก 8/);
      assert.equal(await page.getByRole('article',{name:'ผู้เล่น ผู้เล่น 1',exact:true}).locator('.card.back').count(),2);
      assert.equal(await page.locator('.pok-game .result').count(),0);
    } else {
      await page.getByRole('button',{name:'ดูผลจับ ผู้เล่น 1',exact:true}).click();
      assert.equal(await page.locator('.pok-catch-detail .card').count(),6);
      assert.match(await page.locator('.pok-catch-detail').textContent(),/เทียบหลังจั่ว/);
      assert.match(await page.locator('.pok-catch-detail').textContent(),/เสมอ/);
      await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
      await page.setViewportSize({width:844,height:390});
      await page.screenshot({path:fileURLToPath(new URL('../preview-pok-recompared.png',import.meta.url)),scale:'css'});
    }
  }
  console.log('PASS: immediate Pok8/9 faces, private other hands and reported re-compared catch at 13 viewports');
  await fixture('DEALER_ACTION',6,'p0','p0',false,2);
  for (const [width,height] of sizes) { await page.setViewportSize({width,height}); await fits('partial catches ' + width + 'x' + height); }
  assert.equal(await page.getByLabel('จับผู้เล่น 3 ใบ').locator('option').count(),3);
  await page.getByRole('button',{name:'ดูผลจับ ผู้เล่น 1',exact:true}).click();
  assert.equal(await page.locator('.pok-catch-detail').count(),2);
  assert.equal(await page.locator('.pok-catch-detail').first().locator('.card').count(),5);
  await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
  for (const phase of ['PLAYER_ACTIONS','DEALER_ACTION','REVEAL']) {
    await fixture(phase,6,phase === 'DEALER_ACTION' ? 'p0' : 'p1','p0',false,phase === 'DEALER_ACTION' ? 2 : 0,'straightFlush');
    for (const [width,height] of sizes) { await page.setViewportSize({width,height}); await fits('special hands ' + phase + ' ' + width + 'x' + height); }
  }
  await page.setViewportSize({ width: 320, height: 480 });
  await fixture('LOBBY', 6, 'p1', 'p1'); await fits('non-host bets and ready');
  await fixture('PLAYER_ACTIONS', 6, 'p1', 'p0', true); await fits('disconnected player');
  await page.getByRole('button', { name: 'กติกาป๊อกเด้ง', exact: true }).click();
  await page.locator('dialog .rules summary').click();
  assert.match(await page.locator('dialog .rules').textContent(), /คู่หรือสองใบดอกเดียวกัน = 2 เด้ง/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').count(), 0);
  await fixture('LOBBY');
  await page.getByRole('button', { name: 'จัดการโต๊ะป๊อกเด้ง', exact: true }).click();
  assert.equal(await page.locator('.bot-row').count(), 5);
  await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await fits('after dismissing settings');
  await page.getByRole('button', { name: 'ออกจากห้อง', exact: true }).click();
  assert.equal(await page.locator('.pok-shell').count(), 0);
  assert.equal(await page.locator('.top').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: 2–6 players, all phases, three cards, no page scrolling or overlapping ranks/suits, settings/rules dialogs and exit');
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('../preview-pok-debug.png', import.meta.url)), fullPage: true });
  throw error;
} finally { await browser.close(); }
