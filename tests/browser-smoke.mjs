import { previewPath } from './helpers/preview-path.mjs';
import { selectOption } from './select-option.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Run against npm run dev. Uses installed Edge, no browser download required.
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const errors = [];
const desktop = await browser.newContext({ viewport: { width: 1366, height: 960 } });
const mobile = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
const a = await desktop.newPage(); const b = await mobile.newPage();
for (const page of [a, b]) page.on('pageerror', error => errors.push(error.message));
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(predicate, timeout = 15000) {
  const end = Date.now() + timeout;
  while (!await predicate()) { if (Date.now() > end) throw new Error('Browser test timeout'); await delay(100); }
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Horizontal overflow');
}
try {
  await a.goto(url); await a.getByRole('button', { name: /เลือกป๊อกเด้ง/ }).click(); await a.getByLabel('ชื่อของคุณ').fill('เจ้าบ้าน');
  await a.getByRole('button', { name: 'วิธีเล่น', exact: true }).click();
  assert.match(await a.locator('dialog:modal .rules').textContent(), /คู่หรือสองใบดอกเดียวกัน = 2 เด้ง/);
  assert.match(await a.locator('dialog:modal .rules').textContent(), /เรียงฟลัชและตอง = 5 เด้ง/);
  await a.keyboard.press('Escape');
  await a.getByRole('button', { name: 'เลือกเกมอื่น', exact: true }).click();
  assert.equal(new URL(a.url()).pathname, '/games');
  await a.getByRole('button', { name: /เลือกป๊อกเด้ง/ }).click();
  await a.getByLabel('ชื่อของคุณ').fill('เจ้าบ้าน');
  await a.screenshot({ path: previewPath('preview-home.png'), fullPage: true });
  await a.getByRole('button', { name: 'สร้างห้อง ป๊อกเด้ง' }).click();
  await a.locator('.room-bar strong').waitFor();
  assert.match(new URL(a.url()).pathname, /^\/play\/[A-F0-9]{10}$/);
  assert.equal(await a.locator('.room-entry-page').count(), 0);
  await a.goBack();
  assert.equal(new URL(a.url()).pathname, '/rooms/create');
  assert.equal(await a.locator('.table').count(), 0);
  await a.getByRole('button', { name: 'กลับไปเล่น', exact: true }).click();
  await a.locator('.room-bar strong').waitFor();
  const code = await a.locator('.room-bar strong').textContent();
  await b.goto(url); await b.getByRole('button', { name: /เลือกป๊อกเด้ง/ }).click(); await b.getByRole('button', { name: 'เข้าห้องเพื่อน', exact: true }).click();
  assert.equal(new URL(b.url()).pathname, '/rooms/join');
  await b.getByLabel('ชื่อของคุณ').fill('เพื่อน'); await b.getByLabel('รหัสห้อง').fill(code);
  await b.getByRole('button', { name: 'เข้าร่วมห้อง ป๊อกเด้ง' }).click();
  await b.locator('.room-bar strong').waitFor();
  await wait(async () => await a.locator('.seat').count() === 2);
  await noOverflow(a); await noOverflow(b);
  let refreshed = false;
  for (let round = 0; round < 8 && !refreshed; round++) {
    await b.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
    await wait(() => a.getByRole('button', { name: 'เริ่มรอบ', exact: true }).isEnabled());
    await a.getByRole('button', { name: 'เริ่มรอบ', exact: true }).click();
    await wait(async () => !(await a.locator('.phase').textContent()).includes('รอเพื่อนพร้อม'));
    const end = Date.now() + 45000;
    while (Date.now() < end) {
      const phase = await a.locator('.phase').textContent();
      if (phase.includes('จบรอบ')) break;
      if (!refreshed && (phase.includes('ผู้เล่นตัดสินใจ') || phase.includes('เจ้ามือตัดสินใจ'))) {
        await wait(async () => await b.locator('.seat.own .card:not(.back)').count() === 2);
        const original = await b.locator('.seat.own .card').allTextContents();
        assert.equal(await b.locator('.seat:not(.own) .card.back').count(), 2);
        assert.equal(await b.locator('.pok-own-value').isVisible(), true);
        await a.screenshot({ path: previewPath('preview-table.png'), fullPage: true });
        await b.screenshot({ path: previewPath('preview-mobile.png'), fullPage: true });
        await b.reload();
        await wait(async () => await b.locator('.seat.own .card:not(.back)').count() === 2 && await b.locator('.connection').textContent() === 'เชื่อมต่อแล้ว');
        assert.deepEqual(await b.locator('.seat.own .card').allTextContents(), original);
        assert.match(new URL(b.url()).pathname, /^\/play\/[A-F0-9]{10}$/);
        assert.equal(await b.locator('.room-entry-page').count(), 0);
        refreshed = true;
      }
      for (const page of [b, a]) {
        const stand = page.getByRole('button', { name: 'อยู่', exact: true });
        if (await stand.isVisible() && await stand.isEnabled()) await stand.click();
      }
      await delay(120);
    }
    assert.match(await a.locator('.phase').textContent(), /จบรอบ/);
    assert.equal(await a.locator('.result').count(), 2);
    const amounts = await a.locator('.points').allTextContents();
    assert.equal(amounts.reduce((sum, text) => sum + Number(text.replace(/[^\d]/g, '')), 0), 2000);
    await noOverflow(a); await noOverflow(b);
    await a.getByRole('button', { name: 'เตรียมรอบใหม่', exact: true }).click();
    await wait(async () => (await b.locator('.phase').textContent()).includes('รอเพื่อนพร้อม'));
  }
  assert.equal(refreshed, true, 'No actionable round available to test reload');
  assert.deepEqual(errors, [], 'Unexpected browser exception');
  await b.getByRole('button', { name: 'ออกจากห้อง', exact: true }).click();
  await a.getByRole('button', { name: 'จัดการโต๊ะป๊อกเด้ง', exact: true }).click();
  await a.getByRole('button', { name: '← กลับหน้าแรก', exact: true }).click();
  assert.equal(new URL(a.url()).pathname, '/games');
  await a.getByRole('button', { name: /เลือกป๊อกเด้ง/ }).click();
  assert.equal(new URL(a.url()).pathname, '/rooms/create');
  await selectOption(a,'จำนวนบอท','2');
  await a.getByRole('button', { name: 'สร้างห้อง ป๊อกเด้ง' }).click();
  await wait(async () => await a.locator('.seat').count() === 3);
  assert.equal(await a.locator('.bot-badge').count(), 2);
  await a.getByRole('button', { name: 'จัดการโต๊ะป๊อกเด้ง', exact: true }).click();
  const botNames = await a.locator('.bot-row span').allTextContents();
  await a.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await a.reload(); await wait(async () => await a.locator('.bot-badge').count() === 2);
  await a.getByRole('button', { name: 'จัดการโต๊ะป๊อกเด้ง', exact: true }).click();
  assert.deepEqual(await a.locator('.bot-row span').allTextContents(), botNames);
  await a.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await a.getByRole('button', { name: 'เริ่มรอบ', exact: true }).click();
  await wait(async () => !(await a.locator('.phase').textContent()).includes('รอเพื่อนพร้อม'));
  const botEnd = Date.now() + 45000;
  while (!(await a.locator('.phase').textContent()).includes('จบรอบ') && Date.now() < botEnd) {
    const stand = a.getByRole('button', { name: 'อยู่', exact: true });
    if (await stand.isVisible() && await stand.isEnabled()) await stand.click();
    await delay(100);
  }
  assert.match(await a.locator('.phase').textContent(), /จบรอบ/);
  assert.equal(await a.locator('.result').count(), 3);
  assert.equal((await a.locator('.points').allTextContents()).reduce((sum, text) => sum + Number(text.replace(/[^\d]/g, '')), 0), 3000);
  await a.screenshot({ path: previewPath('preview-bots.png'), fullPage: true });
  await a.getByRole('button', { name: 'เตรียมรอบใหม่', exact: true }).click();
  await wait(() => a.getByRole('button', { name: 'เริ่มรอบ', exact: true }).isEnabled());
  await a.getByRole('button', { name: 'จัดการโต๊ะป๊อกเด้ง', exact: true }).click();
  await a.locator('.bot-row button').first().click();
  await wait(async () => await a.locator('.bot-badge').count() === 1);
  await a.getByRole('button', { name: 'เพิ่มบอท', exact: true }).click();
  await wait(async () => await a.locator('.bot-badge').count() === 2);
  await a.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await a.getByRole('button', { name: 'ออกจากห้อง', exact: true }).click();
  // Direct game URL without a session must show an entry link, never the creation form.
  await b.goto(url + '/play/ABCDEF0123');
  await b.getByRole('button', { name: 'เข้าห้องนี้', exact: true }).waitFor();
  assert.equal(await b.locator('.room-entry-page').count(), 0);
  await b.getByRole('button', { name: 'เข้าห้องนี้', exact: true }).click();
  assert.equal(await b.getByLabel('รหัสห้อง').inputValue(), 'ABCDEF0123');
  assert.deepEqual(errors, [], 'Unexpected browser exception');
  console.log('PASS: distinct create/join/play routes, back/resume, human multiplayer, bot solo/full round, refresh, bot add/remove, privacy, point conservation, desktop/mobile layout');
} catch (error) {
  console.error('Browser exceptions:', errors);
  console.error('Page body:', (await a.locator('body').textContent()).slice(0, 2000));
  await a.screenshot({ path: previewPath('preview-debug.png'), fullPage: true });
  throw error;
} finally { await browser.close(); }
