import { Client } from '@colyseus/sdk';
import assert from 'node:assert/strict';
const endpoint = process.env.PRODUCTION_GAME_URL || 'ws://127.0.0.1:2568';
const watchdog = setTimeout(() => {
  console.error('FAIL: production smoke exceeded 60 seconds');
  process.exit(1);
}, 60_000);
watchdog.unref();
const httpUrl = endpoint.replace(/^ws/, 'http').replace(/\/$/, '');
const health = await fetch(`${httpUrl}/health`);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: 'ok' });
let html;
for (const path of ['/', '/games', '/rooms/create', '/play/ABC123', '/poker/rooms/create', '/poker/play/ABC123', '/spyfall/rooms/create', '/spyfall/play/ABC123', '/oldmaid/rooms/create', '/oldmaid/play/ABC123', '/whoami/rooms/create', '/whoami/play/ABC123']) {
  const response = await fetch(`${httpUrl}${path}`);
  assert.equal(response.status, 200, `SPA route ${path}`);
  assert.match(response.headers.get('content-type'), /text\/html/);
  html = await response.text();
  assert.match(html, /id="root"/);
}
const script = html.match(/src="(\/assets\/[^"\s]+\.js)"/)[1];
const asset = await fetch(`${httpUrl}${script}`);
assert.equal(asset.status, 200);
assert.match(asset.headers.get('content-type'), /javascript/);
assert.match(asset.headers.get('cache-control'), /immutable/);
for (const path of ['/assets/missing.js', '/.env', '/package.json', '/unknown-api']) {
  assert.equal((await fetch(`${httpUrl}${path}`)).status, 404, `Missing path ${path}`);
}
console.log('PASS: production health, deep links, cached assets, and missing-file responses');
for (const game of ['pok', 'poker', 'spyfall', 'oldmaid', 'whoami']) {
  let snapshot;
  const a = await new Client(endpoint).create(game, { name: 'Production Host' });
  a.onMessage('snapshot', message => { snapshot = message; }); a.onMessage('hand', () => {});
  a.onMessage('secret', () => {}); a.onMessage('identities', () => {});
  const b = await new Client(endpoint).joinById(a.roomId, { name: 'Production Friend', game });
  b.onMessage('snapshot', () => {}); b.onMessage('hand', () => {});
  b.onMessage('secret', () => {}); b.onMessage('identities', () => {});
  try {
    assert.notEqual(a.sessionId, b.sessionId);
    assert.match(a.roomId, /^[A-F0-9]{10}$/);
    console.log(`PASS: compiled ${game} server creates a room and accepts two clients`);
  } finally {
    for (const room of [b, a]) {
      room.reconnection.enabled = false;
      const left = room.leave();
      room.connection.close(1000);
      // Colyseus can acknowledge consent with 4000 before our normal socket close.
      // Both are intentional exits; an abnormal 1006 or reconnect remains a failure.
      assert.ok([1000, 4000].includes(await left), `Intentional ${game} exit must close normally`);
      if (room === b) {
        const until = Date.now() + 5000;
        while (snapshot?.players.length !== 1 && Date.now() < until) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(snapshot?.players.length, 1, `Consented ${game} exit removes the seat immediately`);
      }
    }
  }
}
clearTimeout(watchdog);
