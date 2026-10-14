import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client, Room } from '@colyseus/sdk';
import { PokerRoom } from '../apps/server/src/poker-room';
import { PokerGame } from '../apps/server/src/poker-game';
import { PokRoom } from '../apps/server/src/room';
import type { GameHooks } from '../apps/server/src/game';
import type { PokerSnapshot } from '../packages/shared/src/poker';
import type { Card } from '../packages/shared/src/index';

class LifecycleRoom extends PokerRoom {
  protected reconnectSeconds = 1;
  protected makeGame(code: string, hooks: GameHooks) {
    return new PokerGame(code, hooks, () => 0, { deal: 50, turn: 500, reveal: 20, bot: 40 }, 150);
  }
}
let server: Server, endpoint: string, serial = 0;
const rooms: Room[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn: () => boolean) {
  const end = Date.now() + 4000;
  while (!fn()) { if (Date.now() > end) throw new Error('Poker lifecycle timeout'); await sleep(10); }
}
interface Observer { room: Room; state?: PokerSnapshot; hand: Card[]; errors: string[]; closed: string; left: boolean }
function observe(room: Room): Observer {
  room.reconnection.enabled = false; rooms.push(room);
  const o: Observer = { room, hand: [], errors: [], closed: '', left: false };
  room.onMessage('snapshot', (s: PokerSnapshot) => o.state = s);
  room.onMessage('hand', (h: { cards: Card[] }) => o.hand = h.cards);
  room.onMessage('error', (e: { message: string }) => o.errors.push(e.message));
  room.onMessage('roomClosed', (e: { message: string }) => o.closed = e.message);
  room.onLeave(() => o.left = true); room.send('sync'); return o;
}
function send(o: Observer, type: string, value?: unknown) {
  o.room.send('action', { type, value, roundId: o.state!.roundId, actionId: `lifecycle-${++serial}` });
}
async function pair(botCount = 0) {
  const a = observe(await new Client(endpoint).create('poker', { name: 'Host', botCount }));
  const b = observe(await new Client(endpoint).joinById(a.room.roomId, { name: 'Guest', game: 'poker' }));
  await until(() => a.state?.players.length === 2 + botCount && b.state?.players.length === 2 + botCount);
  return { a, b, code: a.room.roomId };
}
async function start(a: Observer, b: Observer) {
  send(b, 'setReady', true); await until(() => a.state!.players.find(p => p.id === b.room.sessionId)?.ready === true);
  send(a, 'startRound'); await until(() => a.state!.phase === 'PREFLOP' && a.hand.length === 2 && b.hand.length === 2);
}
async function disposed(code: string) {
  await until(() => !matchMaker.getLocalRoomById(code) && !PokRoom.codes.has(code));
  await expect(new Client(endpoint).joinById(code, { name: 'Late', game: 'poker' })).rejects.toThrow();
}
beforeAll(async () => {
  const http = createServer();
  server = new Server({ gracefullyShutdown: false, transport: new WebSocketTransport({ server: http, maxPayload: 4096 }) });
  server.define('poker', LifecycleRoom); await server.listen(0, '127.0.0.1');
  const address = http.address(); if (!address || typeof address === 'string') throw new Error('No server address');
  endpoint = `ws://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await Promise.all(rooms.filter(r => r.connection.isOpen).map(r => Promise.race([r.leave(), sleep(200)])));
  await server.gracefullyShutdown(false);
});

it('intentional host exit transfers control in lobby, invalidates its token, and the guest can start', async () => {
  const { a, b, code } = await pair(1); const token = a.room.reconnectionToken;
  await a.room.leave(); await until(() => b.state!.hostId === b.room.sessionId && b.state!.players.length === 2);
  await expect(new Client(endpoint).reconnect(token)).rejects.toThrow();
  send(b, 'startRound'); await until(() => b.state!.phase === 'PREFLOP');
  await b.room.leave(); await disposed(code);
});
it('intentional exit mid-hand folds immediately and transfers host before settlement', async () => {
  const { a, b, code } = await pair(1); await start(a, b);
  await a.room.leave(); await until(() => b.state!.hostId === b.room.sessionId);
  const departed = b.state!.players.find(p => p.id === a.room.sessionId);
  expect(departed?.folded ?? b.state!.results.some(r => r.id === a.room.sessionId && r.handName === 'Fold')).toBe(true);
  expect(departed?.reconnectUntil ?? 0).toBe(0);
  await until(() => b.state!.phase === 'ROUND_END');
  expect(b.state!.results.reduce((sum, r) => sum + r.delta, 0)).toBe(0);
  send(b, 'prepareRound'); await until(() => b.state!.phase === 'LOBBY');
  await b.room.leave(); await disposed(code);
});
it('network loss preserves identity, cards, chips and deadline while transferring host', async () => {
  const { a, b, code } = await pair(); await start(a, b);
  const token = a.room.reconnectionToken, hand = [...a.hand], deadline = a.state!.deadline;
  const points = a.state!.players.find(p => p.id === a.room.sessionId)!.points;
  a.room.connection.close(4010); await until(() => b.state!.hostId === b.room.sessionId && !b.state!.players.find(p => p.id === a.room.sessionId)!.connected);
  expect(b.state!.deadline).toBe(deadline); expect(b.state!.players.find(p => p.id === a.room.sessionId)!.reconnectUntil).toBeGreaterThan(Date.now());
  const back = observe(await new Client(endpoint).reconnect(token)); await until(() => back.hand.length === 2);
  expect(back.room.sessionId).toBe(a.room.sessionId); expect(back.hand).toEqual(hand);
  expect(back.state!.hostId).toBe(b.room.sessionId); expect(back.state!.players.find(p => p.id === back.room.sessionId)!.points).toBe(points);
  await back.room.leave(); await b.room.leave(); await disposed(code);
});
it('a lone human can reconnect into a bot table, with no bot becoming host', async () => {
  const a = observe(await new Client(endpoint).create('poker', { name: 'Solo', botCount: 2 }));
  await until(() => a.state?.players.length === 3); const code = a.room.roomId, token = a.room.reconnectionToken;
  a.room.connection.close(4010); await until(() => (matchMaker.getLocalRoomById(code) as LifecycleRoom).game.hostId === '');
  const back = observe(await new Client(endpoint).reconnect(token)); await until(() => back.state?.hostId === back.room.sessionId);
  expect(back.state!.players.filter(p => p.isBot)).toHaveLength(2);
  await back.room.leave(); await disposed(code);
});
it('an empty bot table expires after the reconnect window and old tokens cannot revive it', async () => {
  const a = observe(await new Client(endpoint).create('poker', { name: 'Solo', botCount: 3 }));
  await until(() => a.state?.players.length === 4); const code = a.room.roomId, token = a.room.reconnectionToken;
  a.room.connection.close(4010); await sleep(100); expect(matchMaker.getLocalRoomById(code)).toBeDefined();
  await disposed(code); await expect(new Client(endpoint).reconnect(token)).rejects.toThrow();
});
it('when all humans explicitly leave mid-hand, bots and timers are disposed without a grace period', async () => {
  const { a, b, code } = await pair(2); await start(a, b);
  const room = matchMaker.getLocalRoomById(code) as LifecycleRoom;
  await a.room.leave(); await b.room.leave(); await disposed(code);
  const state = room.game.snapshot(); await sleep(600); expect(room.game.snapshot()).toEqual(state);
});
it('remaining humans can continue after the other player reconnect window expires', async () => {
  const { a, b, code } = await pair(1); const token = a.room.reconnectionToken;
  a.room.connection.close(4010); await until(() => !b.state!.players.some(p => p.id === a.room.sessionId));
  await expect(new Client(endpoint).reconnect(token)).rejects.toThrow(); expect(b.state!.hostId).toBe(b.room.sessionId);
  send(b, 'startRound'); await until(() => b.state!.phase === 'PREFLOP'); await b.room.leave(); await disposed(code);
});
it('only host can close a lobby; every client receives the reason and the room is deleted', async () => {
  const { a, b, code } = await pair(); send(b, 'closeRoom'); await until(() => b.errors.some(e => e.includes('host')));
  expect(a.state!.roomClosing).toBe(false); send(a, 'closeRoom');
  await until(() => a.state!.roomClosing && b.state!.closeAt > 0);
  await expect(new Client(endpoint).joinById(code, { name: 'Late', game: 'poker' })).rejects.toThrow();
  await until(() => a.left && b.left); expect(a.closed).toContain('ปิดห้อง'); expect(b.closed).toContain('ปิดห้อง'); await disposed(code);
});
it('scheduled close waits for all-in showdown and settlement, including a disconnected winner', async () => {
  const { a, b, code } = await pair(); await start(a, b); send(a, 'closeRoom');
  await until(() => b.state!.roomClosing); expect(b.state!.closeAt).toBe(0);
  send(a, 'allIn'); await until(() => b.state!.players.find(p => p.id === a.room.sessionId)!.allIn);
  const token = a.room.reconnectionToken; a.room.connection.close(4010);
  send(b, 'allIn'); await until(() => b.state!.phase === 'ROUND_END');
  expect(b.state!.board).toHaveLength(5); expect(b.state!.pots[0].eligible).toContain(a.room.sessionId);
  expect(b.state!.results.reduce((sum, r) => sum + r.payout, 0)).toBe(2000);
  await until(() => b.left); await disposed(code); await expect(new Client(endpoint).reconnect(token)).rejects.toThrow();
});
