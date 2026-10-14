import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client, Room } from '@colyseus/sdk';
import { PokRoom } from '../apps/server/src/room';
import { PokerRoom } from '../apps/server/src/poker-room';
import { PokerGame } from '../apps/server/src/poker-game';
import type { PokerSnapshot } from '../packages/shared/src/poker';
import { Game } from '../apps/server/src/game';
import type { GameHooks } from '../apps/server/src/game';
import { DEFAULT_RULES } from '../packages/shared/src/index';
import type { Snapshot, Card } from '../packages/shared/src/index';

class TestRoom extends PokRoom {
  protected makeGame(code: string, hooks: GameHooks) {
    return new Game(code, hooks, { ...DEFAULT_RULES, dealMs: 50, revealMs: 50, settlementMs: 50, actionMs: 5000, reconnectSeconds: 2 }, () => 0);
  }
}
class TestPokerRoom extends PokerRoom {
  protected makeGame(code: string, hooks: GameHooks) {
    return new PokerGame(code, hooks, () => 0, { deal: 50, turn: 2000, reveal: 20, bot: 40 });
  }
}
let server: Server; let endpoint: string;
const rooms: Room[] = [];
interface Observer { room: Room; snapshots: Snapshot[]; hands: { roundId: number; cards: Card[] }[]; errors: { code: string }[] }
function observe(room: Room): Observer {
  room.reconnection.enabled = false;
  rooms.push(room);
  const observer: Observer = { room, snapshots: [], hands: [], errors: [] };
  room.onMessage('snapshot', (s: Snapshot) => observer.snapshots.push(s));
  room.onMessage('hand', (h: { roundId: number; cards: Card[] }) => observer.hands.push(h));
  room.onMessage('error', (e: { code: string }) => observer.errors.push(e));
  room.send('sync'); return observer;
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, timeout = 4000) {
  const end = Date.now() + timeout;
  while (!predicate()) { if (Date.now() > end) throw new Error('Network test timed out'); await sleep(15); }
}
function latest(o: Observer) { return o.snapshots[o.snapshots.length - 1]; }
let actionId = 0;
function send(o: Observer, type: string, value?: unknown, roundId?: number, id?: string) {
  o.room.send('action', { type, value, roundId: roundId ?? latest(o).roundId, actionId: id ?? `test-${++actionId}` });
}
beforeAll(async () => {
  const http = createServer();
  server = new Server({ gracefullyShutdown: false, transport: new WebSocketTransport({ server: http, maxPayload: 4096 }) });
  server.define('test', TestRoom);
  server.define('poker', TestPokerRoom);
  await server.listen(0, '127.0.0.1');
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  endpoint = `ws://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await Promise.all(rooms.map(room => Promise.race([room.leave().catch(() => {}), sleep(200)])));
  await server.gracefullyShutdown(false);
});
describe('real WebSocket clients', () => {
  it('Poker room reconnects a human, isolates private hands, rejects wrong game and plays with bots', async () => {
    let room = await new Client(endpoint).create('poker', { name: 'Poker Host', botCount: 2 });
    rooms.push(room); room.reconnection.enabled = false;
    let snapshot: PokerSnapshot | undefined; let hand: Card[] = []; let lastRound = -1; let lastTurn = '';
    const attach = (r: Room) => {
      r.onMessage('snapshot', (s: PokerSnapshot) => { snapshot = s; });
      r.onMessage('hand', (h: { cards: Card[] }) => { hand = h.cards; });
      r.onMessage('error', () => {}); r.send('sync');
    };
    attach(room); await until(() => snapshot?.players.length === 3);
    await expect(new Client(endpoint).joinById(room.roomId, { name: 'Wrong game', game: 'pok' })).rejects.toThrow('Poker');
    room.send('action', { type: 'startRound', roundId: 0, actionId: 'poker-start' });
    await until(() => snapshot?.phase === 'PREFLOP' && hand.length === 2);
    expect(snapshot!.results).toEqual([]); expect(snapshot!.players.every(p => !('cards' in p))).toBe(true);
    const original = [...hand]; const oldId = room.sessionId; const token = room.reconnectionToken;
    room.connection.close(4010); await sleep(60); // No second human connection exists to observe the disconnected snapshot.
    room = await new Client(endpoint).reconnect(token); room.reconnection.enabled = false; rooms.push(room); attach(room);
    await until(() => snapshot?.players.find(p => p.id === oldId)?.connected === true);
    expect(room.sessionId).toBe(oldId); expect(hand).toEqual(original);
    const end = Date.now() + 5000;
    while (snapshot?.phase !== 'ROUND_END' && Date.now() < end) {
      if (snapshot?.turnId === room.sessionId && (lastRound !== snapshot.roundId || lastTurn !== snapshot.phase)) {
        const me = snapshot.players.find(p => p.id === room.sessionId)!;
        room.send('action', { type: me.streetBet < snapshot.currentBet ? 'call' : 'check', roundId: snapshot.roundId, actionId: `poker-${++actionId}` });
        lastRound = snapshot.roundId; lastTurn = snapshot.phase;
      }
      await sleep(10);
    }
    expect(snapshot!.phase).toBe('ROUND_END'); expect(snapshot!.board).toHaveLength(5);
    expect(snapshot!.players.reduce((sum, p) => sum + p.points, 0)).toBe(3000);
    await room.leave();
  });
  it('creates a solo bot room, automatically plays dealer and keeps private bot cards hidden', async () => {
    const a = observe(await new Client(endpoint).create('test', { name: 'Solo', botCount: 1 }));
    await until(() => latest(a)?.players.length === 2);
    const bot = latest(a).players.find(p => p.isBot)!;
    expect(latest(a).dealerId).toBe(bot.id); expect(bot.ready).toBe(true);
    send(a, 'startRound'); await until(() => latest(a).phase === 'PLAYER_ACTIONS');
    expect(latest(a).results).toEqual([]); expect(a.hands.at(-1)?.cards).toHaveLength(2);
    expect(latest(a).players.every(p => !('cards' in p))).toBe(true);
    send(a, 'stand'); await until(() => latest(a).phase === 'ROUND_END');
    expect(latest(a).players.reduce((sum, p) => sum + p.points, 0)).toBe(2000);
    expect(latest(a).results.find(r => r.id === bot.id)?.cards).toHaveLength(3);
    send(a, 'prepareRound'); await until(() => latest(a).phase === 'LOBBY');
    send(a, 'removeBot', bot.id); await until(() => latest(a).players.length === 1);
    send(a, 'addBot'); await until(() => latest(a).players.length === 2);
    await a.room.leave();
  });
  it('rejects invalid bot counts before creating a room', async () => {
    for (const botCount of [-1, 6, 1.5, '2']) {
      await expect(new Client(endpoint).create('test', { name: 'Invalid', botCount })).rejects.toThrow();
    }
  });
  it('joins, hides opponents cards, rejects invalid actions, reconnects and settles once', async () => {
    const a = observe(await new Client(endpoint).create('test', { name: 'Dealer' }));
    const b = observe(await new Client(endpoint).joinById(a.room.roomId, { name: 'Player' }));
    await until(() => latest(a)?.players.length === 2 && latest(b)?.players.length === 2);
    send(b, 'startRound'); await until(() => b.errors.some(e => e.code === 'NOT_HOST'));
    send(b, 'setReady', true); await until(() => latest(a).players.find(p => p.id === b.room.sessionId)?.ready === true);
    send(a, 'startRound'); await until(() => latest(a).phase === 'PLAYER_ACTIONS' && b.hands.some(h => h.cards.length === 2));
    expect(latest(a).results).toEqual([]); expect(latest(b).results).toEqual([]);
    const dealerHand = a.hands.at(-1)!.cards;
    const playerHand = b.hands.at(-1)!.cards;
    expect(dealerHand).not.toEqual(playerHand);
    expect(new Set([...dealerHand, ...playerHand].map(c => `${c.suit}:${c.rank}`)).size).toBe(4);
    expect(latest(b).players.every(p => !('cards' in p))).toBe(true);
    send(a, 'draw'); await until(() => a.errors.some(e => e.code === 'WRONG_PHASE'));
    send(b, 'draw', undefined, 0); await until(() => b.errors.some(e => e.code === 'STALE_ROUND'));
    const token = b.room.reconnectionToken;
    b.room.connection.close(4010);
    await until(() => latest(a).players.find(p => p.id === b.room.sessionId)?.connected === false);
    const reconnected = observe(await new Client(endpoint).reconnect(token));
    await until(() => reconnected.hands.some(h => h.cards.length === 2));
    expect(reconnected.room.sessionId).toBe(b.room.sessionId);
    expect(reconnected.hands.at(-1)!.cards).toEqual(playerHand);
    send(reconnected, 'draw', undefined, 1, 'duplicate');
    send(reconnected, 'draw', undefined, 1, 'duplicate');
    await until(() => latest(a).phase === 'DEALER_ACTION');
    expect(reconnected.hands.at(-1)!.cards).toHaveLength(3);
    send(a, 'stand'); await until(() => latest(a).phase === 'ROUND_END');
    expect(latest(a).settled).toBe(true);
    expect(latest(a).players.reduce((sum, p) => sum + p.points, 0)).toBe(2000);
    const balances = latest(a).players.map(p => p.points);
    send(a, 'stand'); await until(() => a.errors.filter(e => e.code === 'WRONG_PHASE').length >= 2);
    expect(latest(a).players.map(p => p.points)).toEqual(balances);
    send(a, 'prepareRound'); await until(() => latest(reconnected).phase === 'LOBBY');
    expect(latest(a).results).toEqual([]);
    await reconnected.room.leave(); await a.room.leave();
  });
});
