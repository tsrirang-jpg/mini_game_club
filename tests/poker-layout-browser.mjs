import { previewPath } from './helpers/preview-path.mjs';
import { selectOption } from './select-option.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { checkPokerViewport } from './poker-viewport-check.mjs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const sizes = [[390,741],[600,741],[700,800],[280,640],[600,800],[900,700],[999,700],[1000,651],[1024,1366],[1280,720],[1920,1080],[844,390],[667,375],[568,320],[740,360],[932,430],[320,480],[320,568],[360,640],[375,667],[390,844],[768,1024],[1366,768],[1024,600]];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(fn, ms = 15000) {
  const until = Date.now() + ms;
  while (!await fn()) { if (Date.now() > until) throw new Error('Poker layout timeout'); await pause(80); }
}
async function fits(label, actions = false) {
  await checkPokerViewport(page, label);
  if (actions) assert.equal(await page.getByRole('button', { name: 'ยืนยัน Raise', exact: true }).isVisible(), true);
}
try {
  await page.goto(url + '/poker/rooms/create');
  await page.getByLabel('ชื่อของคุณ').fill('ผู้เล่นชื่อยาวทดสอบ');
  await selectOption(page,'จำนวนบอท','1');
  await page.getByRole('button', { name: 'สร้างโต๊ะ Poker →', exact: true }).click();
  await page.locator('.poker-seat').nth(1).waitFor();
  for (let count = 2; count <= 6; count++) {
    for (const [width, height] of [[568,320],[844,390],[1366,768]]) {
      await page.setViewportSize({ width, height }); await pause(80);
      await fits('ring with ' + count + ' players at ' + width + 'x' + height);
    }
    if (count < 6) {
      await page.getByRole('button', { name: 'เพิ่มบอท', exact: true }).click();
      await wait(async () => await page.locator('.poker-seat').count() === count + 1);
    }
  }
  for (const [width, height] of sizes) { await page.setViewportSize({ width, height }); await pause(80); await fits('lobby ' + width + 'x' + height); }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'เริ่มรอบ Poker', exact: true }).click();
  await page.locator('.deal-label').waitFor();
  await fits('dealing animation');
  await wait(() => page.getByRole('button', { name: 'ยืนยัน Raise', exact: true }).isVisible());
  await pause(700);
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await pause(80);
    await fits('raise ' + width + 'x' + height, true);
    const legal = page.locator('.chip-choice:not(:disabled)').first();
    await legal.click(); await fits('chip click ' + width + 'x' + height, true);
    if ((width === 844 && height === 390) || width === 360 || width === 1366) {
      await page.screenshot({ path: previewPath('preview-poker-fit-' + width + 'x' + height + '.png') });
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
  console.log('PASS: six players, lobby/raise/results, 24 portrait/landscape/tablet/desktop sizes including SE phones, no horizontal scroll or clipped controls; short screens scroll vertically, dialogs and exit');
} catch (error) {
  await page.screenshot({ path: previewPath('preview-debug.png') });
  throw error;
} finally { await browser.close(); }
