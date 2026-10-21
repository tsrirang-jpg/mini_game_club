import { previewPath } from './helpers/preview-path.mjs';
import { selectOption } from './select-option.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { checkPokerViewport } from './poker-viewport-check.mjs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const desktopOnly = process.env.POKER_DESKTOP_TEST === '1';
const contexts = await Promise.all(Array.from({ length: 6 }, () => browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: !desktopOnly, hasTouch: !desktopOnly })));
const pages = await Promise.all(contexts.map(context => context.newPage()));
const [a,b,c,d,e,f] = pages;
const errors = [];
for (const page of pages) page.on('pageerror', error => errors.push(error.message));
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const sizes = desktopOnly ? [[900,400],[952,442],[1280,500],[1366,590],[1024,600],[1147,650],[1366,768],[1920,1080]] : [[390,741],[600,741],[700,800],[280,640],[600,800],[900,700],[999,700],[1000,651],[1024,1366],[1280,720],[1920,1080],[844,390],[667,375],[568,320],[740,360],[932,430],[320,480],[320,568],[360,640],[375,667],[390,844],[768,1024],[1366,768],[1024,600],[1903,885],[2560,1080],[2560,1440],[3440,1440],[3840,2160]];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(fn, ms = 15000) {
  const until = Date.now() + ms;
  while (!await fn()) { if (Date.now() > until) throw new Error('Poker pots browser timeout'); await pause(80); }
}
async function action(page, type, value) {
  if (type === 'raise') {
    await page.getByLabel('Raise รวมเป็น').waitFor();
    await page.getByLabel('Raise รวมเป็น').fill(String(value));
    await page.getByRole('button', { name: 'ยืนยัน Raise', exact: true }).click();
  } else await page.getByRole('button', { name: type === 'fold' ? 'Fold / หมอบ' : type === 'check' ? 'Check / ผ่าน' : type === 'allIn' ? /^All-in \d/ : /^Call /, exact: typeof type === 'string' && ['fold','check'].includes(type) }).click();
}
async function start() {
  for (const page of pages.slice(1)) await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
  await a.getByRole('button', { name: 'เริ่มรอบ Poker', exact: true }).click();
}
const seatBaselines = new Map();
async function seatGeometry() {
  return a.locator('.poker-seat').evaluateAll(seats => Object.fromEntries(seats.map(seat => {
    const box = seat.getBoundingClientRect();
    return [seat.dataset.seat, { width: box.width, height: box.height }];
  })));
}
async function assertStableSeats(label, width, height) {
  const expected = seatBaselines.get(width + 'x' + height);
  const actual = await seatGeometry();
  for (const [seat, box] of Object.entries(actual)) {
    assert.ok(Math.abs(box.width - expected[seat].width) <= 1 && Math.abs(box.height - expected[seat].height) <= 1,
      label + ': player ' + seat + ' changed size with pot count: ' + JSON.stringify({ expected: expected[seat], actual: box }));
  }
}
const numbers = async () => Promise.all(['A','B','C','D','E','F'].map(async name => Number((await a.locator('article[aria-label="ผู้เล่น Player ' + name + '"] .points').textContent()).replace(/[^\d]/g, ''))));
try {
  await a.goto(url + '/poker/rooms/create');
  await a.getByLabel('ชื่อของคุณ').fill('Player A'); await selectOption(a,'จำนวนบอท','0');
  await a.getByRole('button', { name: 'สร้างห้อง Poker', exact: true }).click();
  await a.locator('.room-bar strong').waitFor(); const code = await a.locator('.room-bar strong').textContent();
  for (let i = 1; i < pages.length; i++) {
    const page = pages[i]; await page.goto(url + '/poker/rooms/join');
    await page.getByLabel('ชื่อของคุณ').fill('Player ' + ['A','B','C','D','E','F'][i]);
    await page.getByLabel('รหัสห้อง').fill(code);
    await page.getByRole('button', { name: 'เข้าร่วมห้อง Poker', exact: true }).click();
    await page.locator('.room-bar strong').waitFor();
  }
  await start();
  // Real betting creates six distinct stacks without any test-only server commands.
  await action(d,'call'); await action(e,'raise',40); await action(f,'fold');
  await action(a,'raise',60); await action(b,'call'); await action(c,'fold'); await action(d,'call'); await action(e,'call');
  await action(b,'raise',40); await action(d,'fold'); await action(e,'call'); await action(a,'raise',80); await action(b,'call'); await action(e,'fold');
  await action(b,'check'); await action(a,'fold');
  await wait(async () => (await a.locator('.phase').textContent()).includes('จบรอบ'));
  assert.deepEqual(await numbers(), [860,1320,980,940,900,1000]);
  await a.getByRole('button', { name: 'เตรียมรอบใหม่', exact: true }).click(); await start();
  await wait(async () => !(await a.locator('.poker-table').getAttribute('class')).includes('dealing'));
  assert.equal(await a.locator('.pot-entry').count(), 1, 'Main pot rail remains mounted before side pots');
  for (const [width, height] of sizes) {
    await a.setViewportSize({ width, height }); await pause(80);
    await checkPokerViewport(a, 'single pot ' + width + 'x' + height);
    seatBaselines.set(width + 'x' + height, await seatGeometry());
  }
  await action(e,'allIn'); await action(f,'allIn'); await action(a,'allIn'); await action(b,'allIn'); await action(c,'allIn');
  await wait(async () => await a.locator('.pot-entry').count() === 5);
  assert.equal(await a.locator('.pot-entry').filter({ hasText: 'คืนชิป' }).count(), 0, 'Refund is not promised before settlement');
  for (const [width,height] of sizes) { await a.setViewportSize({width,height}); await pause(80); await checkPokerViewport(a,'live pots ' + width + 'x' + height); await assertStableSeats('live pots', width, height); }
  await a.getByRole('button',{name:/^Main Pot \d+ ชิป$/}).click();
  assert.match(await a.locator('.pot-detail').first().textContent(), /Player A.*Player B.*Player C.*Player D.*Player E.*Player F/);
  assert.equal(await a.locator('.pot-awards').count(), 0, 'No private winner prediction');
  await a.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
  await action(d,'allIn');
  await wait(async () => (await a.locator('.phase').textContent()).includes('จบรอบ'));
  assert.deepEqual(await a.locator('.pot-entry strong').allTextContents(), ['5,160','200','160','120','40','320']);
  assert.equal(await a.getByRole('button',{name:'คืนชิป 320 ชิป',exact:true}).count(), 1);
  assert.equal(await a.locator('.pot-display strong').textContent(), '5,680', 'Contested total excludes the 320-chip refund');
  assert.equal((await numbers()).reduce((sum,number) => sum + number,0), 6000);
  for (const [width,height] of sizes) {
    await a.setViewportSize({width,height}); await pause(80); await checkPokerViewport(a,'settled pots ' + width + 'x' + height); await assertStableSeats('settled pots', width, height);
    if (width === 1903 || width === 844 || width === 360) await a.screenshot({path:previewPath('preview-poker-pots-' + width + 'x' + height + '.png')});
  }
  await a.getByRole('button',{name:'Side Pot 4 40 ชิป',exact:true}).click();
  const details = a.locator('.pot-detail'); assert.equal(await details.count(),6);
  assert.match(await details.nth(4).locator('.pot-eligible').textContent(), /Player B.*Player F/);
  assert.doesNotMatch(await details.nth(4).locator('.pot-eligible').textContent(), /Player A|Player C|Player D|Player E/);
  assert.match(await details.nth(5).textContent(), /Player B.*คืน 320 ชิป/);
  const credited = Object.fromEntries(['A','B','C','D','E','F'].map(name => [name,0]));
  for (const li of await a.locator('.pot-awards li').all()) {
    const name = (await li.locator('span').textContent()).match(/Player ([A-F])/)[1];
    credited[name] += Number((await li.locator('b').textContent()).replace(/[^\d]/g,''));
  }
  assert.deepEqual(Object.values(credited), await numbers(), 'Per-pot awards match actual final stacks');
  await a.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
  for (const page of pages) await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('PASS: 6 real players, unequal all-ins, live eligibility, 5 pots + refund, stable player sizes from one to six pot entries, exact per-player awards, ' + sizes.length + ' viewport sizes (' + (desktopOnly ? 'desktop without scrolling' : 'phone/tablet/desktop') + ')');
} catch(error) {
  await a.screenshot({path:previewPath('preview-debug.png')}); throw error;
} finally { await browser.close(); }
