import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const sizes = [[844,390],[667,375],[568,320],[740,360],[932,430],[320,568],[360,640],[390,844],[768,1024],[1366,768],[1024,600]];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(fn, ms = 15000) {
  const until = Date.now() + ms;
  while (!await fn()) { if (Date.now() > until) throw new Error('Poker layout timeout'); await pause(80); }
}
async function fits(label, actions = false) {
  const report = await page.evaluate(() => {
    const clipped = [];
    const selectors = ['.room-bar', '.poker-seat', '.community', '.pot-display', '.poker-self', '.poker-action-dock', '.poker-actions button', '.raise-controls input'];
    for (const element of document.querySelectorAll(selectors.join(','))) {
      const r = element.getBoundingClientRect();
      if (r.width && r.height && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) {
        clipped.push({ element: element.className, text: element.textContent.slice(0, 60), x: r.x, y: r.y, width: r.width, height: r.height });
      }
    }
    const table = document.querySelector('.poker-table').getBoundingClientRect();
    const dock = document.querySelector('.poker-action-dock').getBoundingClientRect();
    const items = [...document.querySelectorAll('.poker-seat,.poker-center')].map(e => {
      const r = e.getBoundingClientRect();
      return { element: e.className, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    const tableItems = items.filter(r => r.top < table.top - 1 || r.bottom > table.bottom + 1 || r.left < table.left - 1 || r.right > table.right + 1);
    const overlaps = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1 && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1) overlaps.push([a, b]);
    }
    const shell = document.querySelector('.poker-shell');
    return { clipped, tableItems, overlaps, tableDockOverlap: table.bottom > dock.top, width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      shellOverflow: shell.scrollHeight > shell.clientHeight + 1, scrollY, shellScroll: shell.scrollTop };
  });
  assert.deepEqual(report.clipped, [], label + ': viewport clipping ' + JSON.stringify(report));
  assert.deepEqual(report.tableItems, [], label + ': seats must remain inside table ' + JSON.stringify(report));
  assert.deepEqual(report.overlaps, [], label + ': seats/board must not overlap');
  assert.equal(report.tableDockOverlap, false, label + ': table/actions overlap');
  assert.equal(report.shellOverflow, false, label + ': hidden overflow is not a substitute for fitting');
  assert.ok(report.scrollWidth <= report.width && report.scrollHeight <= report.height, label + ': page scroll');
  assert.equal(report.scrollY + report.shellScroll, 0, label + ': browser scrolled to reach controls');
  if (actions) assert.equal(await page.getByRole('button', { name: 'ยืนยัน Raise', exact: true }).isVisible(), true);
}
try {
  await page.goto(url + '/poker/rooms/create');
  await page.getByLabel('ชื่อของคุณ').fill('ผู้เล่นชื่อยาวทดสอบ');
  await page.getByLabel('จำนวนบอท').selectOption('5');
  await page.getByRole('button', { name: 'สร้างโต๊ะ Poker →', exact: true }).click();
  await page.locator('.poker-seat').nth(5).waitFor();
  for (const [width, height] of sizes) { await page.setViewportSize({ width, height }); await pause(80); await fits('lobby ' + width + 'x' + height); }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'เริ่มรอบ Poker', exact: true }).click();
  await wait(() => page.getByRole('button', { name: 'ยืนยัน Raise', exact: true }).isVisible());
  await pause(700);
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await pause(80);
    await fits('raise ' + width + 'x' + height, true);
    const legal = page.locator('.chip-choice:not(:disabled)').first();
    await legal.click(); await fits('chip click ' + width + 'x' + height, true);
    if ((width === 844 && height === 390) || width === 360 || width === 1366) {
      await page.screenshot({ path: fileURLToPath(new URL('../preview-poker-fit-' + width + 'x' + height + '.png', import.meta.url)) });
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'กติกา Poker', exact: true }).click();
  await page.locator('.poker-rules summary').click();
  assert.equal(await page.locator('.rank-example').count(), 10);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').count(), 0);
  await fits('after dismissing rules', true);
  await page.getByRole('button', { name: 'Fold / หมอบ', exact: true }).click();
  await wait(async () => (await page.locator('.phase').textContent()).includes('จบรอบ'), 60000);
  for (const [width, height] of sizes) { await page.setViewportSize({ width, height }); await pause(80); await fits('results ' + width + 'x' + height); }
  await page.getByRole('button', { name: 'ดูผลและสรุป Pot', exact: true }).click();
  assert.equal(await page.locator('.poker-result-list p').count(), 6);
  await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await page.getByRole('button', { name: 'เตรียมรอบใหม่', exact: true }).click();
  await page.getByRole('button', { name: 'จัดการโต๊ะ', exact: true }).click();
  await page.locator('.bot-row button').first().click();
  await wait(async () => await page.locator('.bot-row').count() === 4);
  await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await fits('back from management');
  await page.getByRole('button', { name: 'ออกจากห้อง', exact: true }).click();
  assert.equal(await page.locator('.poker-shell').count(), 0);
  assert.equal(await page.locator('.top').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: six players, lobby/raise/results, 11 portrait/landscape/tablet/desktop sizes, no scroll or clipped controls, dialogs and exit');
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('../preview-debug.png', import.meta.url)) });
  throw error;
} finally { await browser.close(); }
