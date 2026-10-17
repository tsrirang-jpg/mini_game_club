import { previewPath } from './helpers/preview-path.mjs';
import { selectOption, countOptions } from './select-option.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
const viewports=process.env.DESKTOP_UI?[[1366,768],[1280,700],[1000,651]]:[[375,667],[844,390],[320,568]];
const contexts = await Promise.all(viewports.map(([width,height]) => browser.newContext({viewport:{width,height},isMobile:!process.env.DESKTOP_UI,hasTouch:!process.env.DESKTOP_UI})));
const [a,b,c] = await Promise.all(contexts.map(context => context.newPage()));
const errors = [];
for (const page of [a,b,c]) page.on('pageerror',e => errors.push(e.message));
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const snapshot = page => page.evaluate(async () => (await import('/src/session.ts')).session.getSnapshot().snapshot);
async function wait(fn,ms = 15000) { const end = Date.now() + ms; while (!await fn()) { if (Date.now() > end) throw new Error('Catch browser timeout'); await pause(60); } }
try {
  await a.goto(url + '/rooms/create'); await a.getByLabel('ชื่อของคุณ').fill('เจ้ามือจับ'); await selectOption(a,'จำนวนบอท','0');
  await a.getByRole('button',{name:'สร้างโต๊ะใหม่ →',exact:true}).click(); await a.locator('.room-bar strong').waitFor();
  const code = await a.locator('.room-bar strong').textContent();
  for (const [page,name] of [[b,'ผู้เล่นจั่ว'],[c,'ผู้เล่นอยู่']]) {
    await page.goto(url + '/rooms/join'); await page.getByLabel('ชื่อของคุณ').fill(name); await page.getByLabel('รหัสห้อง').fill(code);
    await page.getByRole('button',{name:'เข้าร่วมโต๊ะ →',exact:true}).click(); await page.locator('.room-bar strong').waitFor();
  }
  let available = false;
  // A Pok ends immediately; retry normal rounds until the dealer can catch.
  for (let round = 0; round < 10 && !available; round++) {
    for (const page of [b,c]) await page.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();
    await a.getByRole('button',{name:'เริ่มรอบ',exact:true}).click();
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if ((await snapshot(a)).phase === 'ROUND_END') break;
      if (await b.getByRole('button',{name:'จั่วอีกใบ',exact:true}).isVisible()) await b.getByRole('button',{name:'จั่วอีกใบ',exact:true}).click();
      if (await c.getByRole('button',{name:'อยู่',exact:true}).isVisible()) await c.getByRole('button',{name:'อยู่',exact:true}).click();
      if (await a.getByRole('button',{name:'จับด้วยไพ่ 2 ใบ',exact:true}).isVisible()) { available = true; break; }
      if (await a.getByRole('button',{name:'อยู่',exact:true}).isVisible()) await a.getByRole('button',{name:'อยู่',exact:true}).click();
      await pause(80);
    }
    if (!available) {
      await wait(async () => (await snapshot(a)).phase === 'ROUND_END');
      await a.getByRole('button',{name:'เตรียมรอบใหม่',exact:true}).click();
      await b.getByRole('button',{name:'พร้อมเล่น',exact:true}).waitFor();
    }
  }
  assert.equal(available,true,'An eligible three-card player must appear');
  const dealerCards = await a.locator('.seat.own .card').evaluateAll(cards => cards.map(e => e.getAttribute('aria-label')));
  assert.equal(dealerCards.length,2);
  assert.equal(await c.locator('article[aria-label="ผู้เล่น ผู้เล่นจั่ว"] .card.back').count(),3);
  assert.equal(await countOptions(a,'จับผู้เล่น 3 ใบ'),1);
  const beforeCatch = await snapshot(a);
  assert.equal(beforeCatch.rules.actionMs,30000);
  await a.waitForTimeout(1100);
  await a.getByRole('button',{name:'จับด้วยไพ่ 2 ใบ',exact:true}).click();
  await wait(async () => (await snapshot(a)).catches.length === 1 && (await snapshot(c)).catches.length === 1);
  const caught = (await snapshot(a)).catches[0];
  const resetDeadline = (await snapshot(a)).deadline;
  assert.ok(resetDeadline > beforeCatch.deadline);
  assert.ok(resetDeadline - Date.now() > 29000);
  assert.equal(await a.getByRole('progressbar',{name:'เวลาตัดสินใจ'}).getAttribute('aria-valuemax'),'30');
  await wait(async () => Number(await a.getByRole('progressbar',{name:'เวลาตัดสินใจ'}).getAttribute('aria-valuenow')) >= 29);
  assert.equal(caught.dealerCards.length,2); assert.equal(caught.cards.length,3);
  assert.equal(await a.locator('.pok-catch-controls').count(),0);
  assert.equal(await c.locator('article[aria-label="ผู้เล่น ผู้เล่นจั่ว"] .card:not(.back)').count(),3);
  const standingPlayer = beforeCatch.players.find(p => p.name === 'ผู้เล่นอยู่');
  const standingPok = beforeCatch.revealedHands.some(r => r.id === standingPlayer.id);
  assert.equal(await a.locator('article[aria-label="ผู้เล่น ผู้เล่นอยู่"] .card.back').count(),standingPok ? 0 : 2);
  await a.getByRole('button',{name:'ดูผลจับ ผู้เล่นจั่ว',exact:true}).click();
  assert.equal(await a.locator('.pok-catch-detail .card').count(),5);
  await a.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
  await a.reload(); await a.getByRole('button',{name:'จั่วอีกใบ',exact:true}).waitFor();
  assert.deepEqual((await snapshot(a)).catches[0],caught);
  assert.equal((await snapshot(a)).deadline,resetDeadline);
  assert.deepEqual(await a.locator('.seat.own .card').evaluateAll(cards => cards.map(e => e.getAttribute('aria-label'))),dealerCards);
  await a.waitForTimeout(650);
  await a.screenshot({path:previewPath('preview-pok-catch.png'),scale:'css'});
  await a.getByRole('button',{name:'จั่วอีกใบ',exact:true}).click();
  await wait(async () => (await snapshot(a)).phase === 'ROUND_END');
  const ended = await snapshot(a);
  const finalCaught = ended.results.find(r => r.id === caught.id);
  const finalDealer = ended.results.find(r => r.outcome === 'DEALER');
  assert.deepEqual(ended.catches[0],finalCaught);
  if (finalDealer.score >= 8 && !finalDealer.special) {
    assert.equal(finalCaught.catchRecompared,true);
    assert.deepEqual(finalCaught.dealerCards,finalDealer.cards);
    if (!finalCaught.special && finalCaught.score === finalDealer.score) { assert.equal(finalCaught.outcome,'TIE'); assert.equal(finalCaught.delta,0); }
  } else {
    assert.equal(finalCaught.delta,caught.delta);
    assert.deepEqual(finalCaught.dealerCards,caught.dealerCards);
  }
  assert.equal(finalDealer.cards.length,3);
  assert.equal(ended.players.reduce((sum,p) => sum + p.points,0),3000);
  for (const page of [a,b,c]) assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight),true);
  for (const page of [c,b,a]) await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('PASS: three real browsers, eligible catch target, Pok/catch reveal, refresh, dealer draw, final catch comparison, conserved balances and no page scroll');
} catch (error) { await a.screenshot({path:previewPath('preview-pok-catch-debug.png')}); throw error; }
finally { await browser.close(); }
