import { chromium } from 'playwright';
import { Client } from '@colyseus/sdk';
import assert from 'node:assert/strict';
import { selectOption } from './select-option.mjs';
import { checkPokerViewport } from './poker-viewport-check.mjs';
import { previewPath } from './helpers/preview-path.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
const rooms = [], observed = [], errors = [];
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const endpoint = process.env.GAME_WS || 'ws://127.0.0.1:2567';
page.on('pageerror', error => errors.push(error.message));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(predicate) {
  const until = Date.now() + 15000;
  while (!await predicate()) {
    if (Date.now() > until) throw new Error('Clean Row browser timeout');
    await pause(60);
  }
}
try {
  await page.goto(url + '/poker/rooms/create');
  await page.getByLabel('ชื่อของคุณ').fill('Game');
  await selectOption(page, 'จำนวนบอท', '0');
  await page.getByRole('button', { name: 'สร้างห้อง Poker', exact: true }).click();
  await page.locator('.room-bar strong').waitFor();
  const code = await page.locator('.room-bar strong').textContent();
  for (let i = 0; i < 5; i++) {
    const room = await new Client(endpoint).joinById(code, { name: 'Poker ' + (i + 1), game: 'poker' });
    rooms.push(room);
    room.reconnection.enabled = false;
    let last = '';
    room.onMessage('hand', () => {});
    room.onMessage('error', error => errors.push(error.message));
    room.onMessage('snapshot', snapshot => {
      if (i === 0) observed.push(snapshot);
      const me = snapshot.players.find(player => player.id === room.sessionId);
      if (snapshot.phase === 'LOBBY' && !me?.ready) room.send('action', { type: 'setReady', value: true, roundId: snapshot.roundId, actionId: 'ready-' + snapshot.roundId });
      const key = [snapshot.roundId, snapshot.phase, snapshot.currentBet, me?.streetBet].join('-');
      if (snapshot.turnId === room.sessionId && last !== key) {
        last = key;
        const type = snapshot.phase === 'RIVER' && snapshot.currentBet === 0 ? 'raise' : me.streetBet < snapshot.currentBet ? 'call' : 'check';
        room.send('action', { type, ...(type === 'raise' ? {value:20} : {}), roundId: snapshot.roundId, actionId: 'act-' + key });
      }
    });
    room.send('sync');
  }
  await wait(() => page.getByRole('button', { name: 'เริ่มรอบ Poker', exact: true }).isEnabled());
  await page.getByRole('button', { name: 'เริ่มรอบ Poker', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยัน Raise', exact: true }).waitFor();
  const input = page.getByLabel('Raise รวมเป็น');
  const confirm = page.getByRole('button', { name: 'ยืนยัน Raise', exact: true });
  await input.fill('');
  assert.equal(await input.inputValue(), '', 'Clearing must remain empty, not become zero');
  assert.equal(await confirm.isDisabled(), true);
  await input.pressSequentially('40');
  assert.equal(await input.inputValue(), '40');
  assert.equal(await input.evaluate(element => element.valueAsNumber), 40);
  for (const text of ['040', '00040']) {
    await input.fill(text);
    assert.equal(await input.inputValue(), '40', 'Pasted leading zeroes are normalized');
    assert.equal(await input.evaluate(element => element.valueAsNumber), 40);
  }
  await input.fill('0');
  await input.press('Backspace');
  assert.equal(await input.inputValue(), '');
  await input.pressSequentially('40');
  await input.press('ArrowUp');
  assert.equal(await input.inputValue(), '41', 'Native numeric step behavior is preserved');
  await input.fill('40');
  await input.blur();
  for (const [width, height] of [[1672,941],[1366,768],[1000,651],[1920,1080],[2560,1440],[1366,590],[1024,600],[952,442],[900,600],[900,400],[1280,500],[1920,442]]) {
    await page.setViewportSize({ width, height });
    await page.locator('.clean-row-desktop .poker-console > .poker-self').waitFor();
    await checkPokerViewport(page, 'Clean Row betting ' + width + 'x' + height);
    if (width === 952 || (width === 900 && height === 400)) await page.screenshot({path: previewPath('poker-desktop-fit-' + width + 'x' + height + '.png')});
    if (width === 1366 && height === 590) await page.screenshot({path: previewPath('clean-row-short-desktop.png'), fullPage: true});
  }
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.screenshot({ path: previewPath('clean-row-desktop-betting.png') });
  await confirm.click();
  await wait(() => observed.some(snapshot => snapshot.currentBet === 40 && snapshot.players.some(player => player.seat === 0 && player.streetBet === 40 && player.points === 960)));
  assert.equal(await page.locator('.error').count(), 0, 'The server accepts the numeric raise of 40');
  // Verify the shared editing fix on mobile, while its original hand placement remains.
  await wait(() => page.getByRole('button', { name: 'Check / ผ่าน', exact: true }).isVisible());
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.clean-row-desktop').count(), 0);
  assert.equal(await page.locator('.poker-table > .poker-self').count(), 1);
  await input.fill(''); await input.pressSequentially('40');
  assert.equal(await input.inputValue(), '40');
  assert.equal(await input.evaluate(element => element.valueAsNumber), 40);
  await page.setViewportSize({ width: 1672, height: 941 });
  const until = Date.now() + 15000;
  let capturedRiver = false;
  while (!(await page.locator('.phase').textContent()).includes('จบรอบ')) {
    assert.ok(Date.now() < until, 'Complete the hand');
    const check = page.getByRole('button', { name: 'Check / ผ่าน', exact: true });
    const call = page.getByRole('button', { name: /^Call / });
    if (!capturedRiver && (await page.locator('.phase').textContent()).includes('River') && (await check.isVisible() || await call.isVisible())) {
      await checkPokerViewport(page, 'Clean Row river actions');
      await page.screenshot({path:previewPath('clean-row-desktop-river.png')});
      capturedRiver = true;
    }
    if (await check.isVisible()) await check.click();
    else if (await call.isVisible()) await call.click();
    await pause(70);
  }
  await checkPokerViewport(page, 'Clean Row showdown');
  await page.screenshot({ path: previewPath('clean-row-desktop-showdown.png') });
  assert.deepEqual(errors, []);
  await page.getByRole('button', { name: 'ออกจากห้อง', exact: true }).click();
  console.log('PASS: desktop reference layout, twelve desktop screen sizes without scrolling, clear/type/paste/step Raise editing, numeric 40 accepted by server, unchanged mobile hand placement, full round');
} catch (error) {
  await page.screenshot({ path: previewPath('clean-row-debug.png'), fullPage: true });
  throw error;
} finally {
  for (const room of rooms) await room.leave().catch(() => {});
  await browser.close();
}
