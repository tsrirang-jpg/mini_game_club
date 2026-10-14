import { Client } from '@colyseus/sdk';
import assert from 'node:assert/strict';
const endpoint = process.env.PRODUCTION_GAME_URL || 'ws://127.0.0.1:2568';
const httpUrl = endpoint.replace(/^ws/, 'http').replace(/\/$/, '');
const health = await fetch(`${httpUrl}/health`);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: 'ok' });
let html;
for (const path of ['/', '/games', '/rooms/create', '/play/ABC123', '/poker/rooms/create', '/poker/play/ABC123', '/spyfall/rooms/create', '/spyfall/play/ABC123']) {
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
for (const game of ['pok', 'poker', 'spyfall']) {
  const a = await new Client(endpoint).create(game, { name: 'Production Host' });
  a.onMessage('snapshot', () => {}); a.onMessage('hand', () => {});
  a.onMessage('secret', () => {});
  const b = await new Client(endpoint).joinById(a.roomId, { name: 'Production Friend', game });
  b.onMessage('snapshot', () => {}); b.onMessage('hand', () => {});
  b.onMessage('secret', () => {});
  try {
    assert.notEqual(a.sessionId, b.sessionId);
    assert.match(a.roomId, /^[A-F0-9]{10}$/);
    console.log(`PASS: compiled ${game} server creates a room and accepts two clients`);
  } finally { await b.leave(); await a.leave(); }
}
