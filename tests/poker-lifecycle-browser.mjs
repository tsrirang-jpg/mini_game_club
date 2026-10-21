import { selectOption } from './select-option.mjs';
import { chromium } from 'playwright';
import { Client } from '@colyseus/sdk';
import assert from 'node:assert/strict';
import { checkPokerViewport } from './poker-viewport-check.mjs';
const url = process.env.GAME_URL || 'http://127.0.0.1:2569';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
// Optional diagnostic mode: validate a built client against an existing server
// before deployment. Normal and production verification use the served assets.
if (process.env.POKER_TEST_BUNDLE) {
  for (const context of [desktop, mobile]) await context.route('**/assets/*.js', route => route.fulfill({
    path: process.env.POKER_TEST_BUNDLE, contentType: 'application/javascript',
  }));
  console.log('Diagnostic mode: local client bundle override');
}
await desktop.addInitScript(() => {
  window.testSockets = [];
  window.WebSocket = new Proxy(window.WebSocket, { construct(Target, args) {
    const gameSocket = new URL(args[0]).searchParams.has('sessionId');
    if (gameSocket && window.testBlockSockets) throw new Error('Simulated temporary network outage');
    const socket = new Target(...args); if (gameSocket) window.testSockets.push(socket); return socket;
  } });
});
const a = await desktop.newPage(), b = await mobile.newPage(), errors = [];
for (const page of [a, b]) page.on('pageerror', e => errors.push(e.message));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (!await fn()) { if (Date.now() > end) throw new Error('Poker lifecycle browser timeout'); await pause(80); }
}
async function rejectsJoin(code) {
  await assert.rejects(() => new Client(url.replace(/^http/, 'ws')).joinById(code, { name: 'Late', game: 'poker' }));
}
async function closePanel(page) { await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click(); }
try {
  await a.goto(url + '/poker/rooms/create');
  await a.getByLabel('ชื่อของคุณ').fill('Original Host'); await selectOption(a,'จำนวนบอท','1');
  await a.getByRole('button', { name: 'สร้างห้อง Poker', exact: true }).click(); await a.locator('.room-bar strong').waitFor();
  const code = await a.locator('.room-bar strong').textContent();
  await b.goto(url + '/poker/rooms/join?code=' + code); await b.getByLabel('ชื่อของคุณ').fill('New Host');
  await b.getByRole('button', { name: 'เข้าร่วมห้อง Poker', exact: true }).click();
  await b.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
  await wait(() => a.getByRole('button', { name: 'เริ่มรอบ Poker', exact: true }).isEnabled());
  await a.getByRole('button', { name: 'เริ่มรอบ Poker', exact: true }).click();
  await a.locator('.poker-self .card').nth(1).waitFor(); await pause(1400);
  const cards = await a.locator('.poker-self .card').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
  const points = await a.locator('.poker-self .points').textContent();
  const identity = await a.evaluate(() => new URL(window.testSockets.find(s => s.readyState === 1).url).searchParams.get('sessionId'));
  await a.evaluate(() => {
    window.testBlockSockets = true;
    window.testSockets.filter(s => s.readyState === 1).forEach(s => s.close(4010));
  });
  await wait(async () => (await b.locator('.phase').textContent()).includes('Host: New Host'));
  await wait(async () => (await b.locator('.poker-opponents .player-status').allTextContents()).some(t => t.includes('Reconnect')));
  await a.evaluate(() => { window.testBlockSockets = false; });
  await wait(async () => await a.locator('.connection').getAttribute('aria-label') === 'เชื่อมต่อแล้ว');
  assert.deepEqual(await a.locator('.poker-self .card').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))), cards);
  assert.equal(await a.locator('.poker-self .points').textContent(), points);
  assert.ok((await a.locator('.phase').textContent()).includes('Host: New Host'));
  console.log('PASS: automatic reconnect; testing refresh');
  await a.reload(); await a.locator('.poker-self .card').nth(1).waitFor();
  assert.equal(await a.evaluate(() => new URL(window.testSockets.find(s => s.readyState === 1).url).searchParams.get('sessionId')), identity);
  assert.deepEqual(await a.locator('.poker-self .card').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))), cards);
  await a.getByRole('button', { name: 'จัดการโต๊ะ', exact: true }).click();
  assert.equal(await a.getByRole('button', { name: 'ปิดห้องสำหรับทุกคน', exact: true }).count(), 0); await closePanel(a);
  await a.getByRole('button', { name: 'ออกจากห้อง', exact: true }).click();
  await wait(() => new URL(a.url()).pathname === '/poker/rooms/create'); await pause(1700);
  assert.equal(await a.evaluate(() => sessionStorage.getItem('poker.session.v1')), null);
  assert.equal(await a.locator('.room-bar').count(), 0);
  await wait(async () => !(await b.locator('.poker-opponents .player-status').allTextContents()).some(t => t.includes('Reconnect')));
  for (let n = 0; n < 80 && !(await b.locator('.phase').textContent()).includes('จบรอบ'); n++) {
    const check = b.getByRole('button', { name: 'Check / ผ่าน', exact: true });
    const call = b.getByRole('button', { name: /^Call / });
    if (await check.isVisible()) await check.click(); else if (await call.isVisible()) await call.click();
    await pause(150);
  }
  await wait(async () => (await b.locator('.phase').textContent()).includes('จบรอบ'));
  await checkPokerViewport(b, 'Host transfer landscape after settlement');
  await b.getByRole('button', { name: 'จัดการโต๊ะ', exact: true }).click();
  await b.getByRole('button', { name: 'ปิดห้องสำหรับทุกคน', exact: true }).click();
  await b.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  assert.equal(await b.getByRole('heading', { name: 'จัดการโต๊ะ', exact: true }).isVisible(), true);
  await b.getByRole('button', { name: 'ปิดห้องสำหรับทุกคน', exact: true }).click();
  await b.getByRole('button', { name: 'ยืนยันปิดห้อง', exact: true }).click();
  await wait(async () => (await b.locator('.poker-room-notice').textContent()).includes('ปิดห้องใน'));
  await wait(() => new URL(b.url()).pathname === '/poker/rooms/create');
  assert.equal(await b.evaluate(() => sessionStorage.getItem('poker.session.v1')), null);
  assert.match(await b.getByRole('alert').textContent(), /Host ปิดห้อง Poker แล้ว/);
  await rejectsJoin(code);
  // A deliberate exit while an SDK reconnect is queued must not reopen the room.
  await selectOption(a,'จำนวนบอท','2');
  await a.getByRole('button', { name: 'สร้างห้อง Poker', exact: true }).click(); await a.locator('.room-bar strong').waitFor();
  const emptyCode = await a.locator('.room-bar strong').textContent();
  // Hold the outage until the exit click; foreground recovery now completes
  // before Playwright can target a transient reconnect notice on a healthy link.
  await a.evaluate(() => {
    window.testBlockSockets = true;
    window.testSockets.filter(s => s.readyState === 1).forEach(s => s.close(4010));
  });
  await a.getByRole('button', { name: 'กลับหน้าแรก', exact: true }).waitFor();
  await a.getByRole('button', { name: 'กลับหน้าแรก', exact: true }).evaluate(button => {
    window.testBlockSockets = false; button.click();
  });
  await pause(2500);
  assert.equal(new URL(a.url()).pathname, '/poker/rooms/create');
  assert.equal(await a.evaluate(() => sessionStorage.getItem('poker.session.v1')), null);
  const count = await a.evaluate(() => window.testSockets.filter(s => s.readyState === 1).length);
  assert.equal(count, 0, 'Queued SDK retries must not create an orphan socket after exit');
  await rejectsJoin(emptyCode);
  assert.deepEqual(errors, []);
  console.log('PASS: real browser automatic reconnect + refresh preserve identity/cards/chips; host transfer; intentional exit; close confirmation and cleanup; queued reconnect cancellation');
} catch (error) {
  console.error('Browser state:', new URL(a.url()).pathname, (await a.locator('body').textContent()).slice(0, 1500));
  console.error('Other browser state:', new URL(b.url()).pathname, (await b.locator('body').textContent()).slice(0, 1000));
  throw error;
} finally { await browser.close(); }
