import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../apps/server/src/game';
import { DEFAULT_RULES } from '../packages/shared/src/index';
import type { ActionType, Card } from '../packages/shared/src/index';
let game: Game; let privateHands: Record<string, Card[]>;
let serial = 0;
function act(id: string, type: ActionType, value?: string | number | boolean, roundId = game.roundId, actionId = `a-${++serial}`) {
  game.action(id, { type, value, roundId, actionId });
}
function start() { act('p', 'setReady', true); act('d', 'startRound'); vi.advanceTimersByTime(100); }
beforeEach(() => {
  vi.useFakeTimers(); privateHands = {};
  game = new Game('TEST', { changed() {}, privateHand(id, cards) { privateHands[id] = [...cards]; } },
    { ...DEFAULT_RULES, dealMs: 100, actionMs: 1000, revealMs: 100, settlementMs: 100 }, () => 0);
  game.add('Dealer', 'd'); game.add('Player', 'p');
});
afterEach(() => { game.dispose(); vi.useRealTimers(); });
describe('state machine', () => {
  it('plays alone with a bot, settles points and keeps bot ready next round', () => {
    game.expire('p');
    const bot = game.addBot();
    expect(game.players.get(bot)?.ready).toBe(true);
    act('d', 'startRound'); vi.advanceTimersByTime(600);
    expect(game.phase).toBe('DEALER_ACTION');
    expect(game.players.get(bot)?.cardCount).toBe(3);
    expect(game.snapshot().results).toEqual([]);
    act('d', 'stand'); vi.advanceTimersByTime(200);
    expect(game.phase).toBe('ROUND_END');
    expect(game.snapshot().players.reduce((sum, p) => sum + p.points, 0)).toBe(2000);
    act('d', 'prepareRound'); expect(game.players.get(bot)?.ready).toBe(true);
  });
  it('bot can deal automatically and can never become host', () => {
    game.expire('p'); const bot = game.addBot();
    act('d', 'selectDealer', bot); act('d', 'startRound'); vi.advanceTimersByTime(100);
    act('d', 'stand'); vi.advanceTimersByTime(500);
    expect(game.phase).toBe('REVEAL'); expect(game.players.get(bot)?.cardCount).toBe(3);
    vi.advanceTimersByTime(200); game.disconnect('d');
    expect(game.hostId).toBe('');
    game.reconnect('d'); expect(game.hostId).toBe('d');
  });
  it('only host manages bots before the round, and human seats cannot be removed', () => {
    expect(() => act('p', 'addBot')).toThrow('เฉพาะ');
    act('d', 'addBot'); const bot = game.snapshot().players.find(p => p.isBot)!;
    expect(() => act('d', 'removeBot', 'p')).toThrow('บอท');
    act('d', 'removeBot', bot.id); expect(game.players.has(bot.id)).toBe(false);
    act('d', 'addBot'); act('p', 'setReady', true); act('d', 'startRound');
    expect(() => act('d', 'removeBot', game.snapshot().players.find(p => p.isBot)!.id)).toThrow();
    game.dispose(); vi.advanceTimersByTime(2000); expect(game.phase).toBe('DEALING');
  });
  it('supports six seats, deals unique cards and resolves dealer pok without actions', () => {
    for (let n = 0; n < 4; n++) game.add(`Friend ${n}`, `f${n}`);
    expect(() => game.add('Seventh', 'extra')).toThrow('ห้องเต็ม');
    for (const p of game.players.values()) if (p.id !== 'd') act(p.id, 'setReady', true);
    act('d', 'startRound');
    expect(Object.values(privateHands).flat()).toHaveLength(12);
    expect(new Set(Object.values(privateHands).flat().map(c => `${c.suit}:${c.rank}`)).size).toBe(12);
    vi.advanceTimersByTime(100);
    expect(game.phase).toBe('REVEAL');
    expect(game.snapshot().results.find(r => r.id === 'd')?.pok).toBe(true);
    vi.advanceTimersByTime(200);
    expect(game.phase).toBe('ROUND_END');
    expect(game.snapshot().players.reduce((sum, p) => sum + p.points, 0)).toBe(6000);
  });
  it('plays a full round and prepares another round', () => {
    start(); expect(game.phase).toBe('PLAYER_ACTIONS');
    expect(privateHands.p).toHaveLength(2);
    act('p', 'draw'); expect(game.phase).toBe('DEALER_ACTION');
    expect(privateHands.p).toHaveLength(3);
    act('d', 'stand'); expect(game.phase).toBe('REVEAL');
    vi.advanceTimersByTime(200);
    expect(game.phase).toBe('ROUND_END'); expect(game.snapshot().settled).toBe(true);
    expect(game.snapshot().players.reduce((sum, p) => sum + p.points, 0)).toBe(2000);
    act('d', 'prepareRound'); expect(game.phase).toBe('LOBBY'); expect(game.snapshot().results).toEqual([]);
    expect(privateHands.p).toEqual([]); start(); expect(game.roundId).toBe(2);
  });
  it('rejects wrong roles, phases, stale rounds and duplicate draw', () => {
    expect(() => act('p', 'startRound')).toThrow('เฉพาะ');
    expect(() => act('p', 'draw')).toThrow(); start();
    expect(() => act('d', 'draw')).toThrow();
    expect(() => act('p', 'stand', undefined, 0)).toThrow('รอบเก่า');
    act('p', 'draw', undefined, 1, 'same');
    act('p', 'draw', undefined, 1, 'same'); expect(privateHands.p).toHaveLength(3);
    expect(() => act('p', 'draw')).toThrow();
  });
  it('automatically stands at both deadlines', () => {
    start(); vi.advanceTimersByTime(1000); expect(game.phase).toBe('DEALER_ACTION');
    vi.advanceTimersByTime(1000); expect(game.phase).toBe('REVEAL');
    expect(game.snapshot().results.every(r => r.cards.length === 2)).toBe(true);
  });
  it('does not publish private hands or deck before reveal', () => {
    start(); const snapshot = game.snapshot();
    expect(snapshot.results).toEqual([]);
    expect(snapshot.players.every(p => !('cards' in p))).toBe(true);
    expect('hands' in snapshot).toBe(false); expect('stock' in snapshot).toBe(false);
    expect(new Set(Object.values(privateHands).flat().map(c => `${c.suit}:${c.rank}`)).size).toBe(4);
  });
  it('restores original hand on reconnect and settles expired players before removal', () => {
    start(); const original = [...privateHands.p];
    game.disconnect('p'); game.reconnect('p'); expect(privateHands.p).toEqual(original);
    game.disconnect('p'); game.expire('p'); expect(game.players.has('p')).toBe(true);
    vi.advanceTimersByTime(2200);
    expect(game.phase).toBe('ROUND_END'); expect(game.players.has('p')).toBe(false);
    expect(game.snapshot().results.some(r => r.id === 'p')).toBe(true);
    expect(game.snapshot().settled).toBe(true);
  });
  it('requires collateral and all players connected', () => {
    game.players.get('p')!.points = 1; act('p', 'setReady', true);
    expect(() => act('d', 'startRound')).toThrow('แต้มไม่พอ');
    game.players.get('p')!.points = 1000; game.players.get('d')!.points = 1;
    expect(() => act('d', 'startRound')).toThrow('เจ้ามือ');
  });
  it('retains connected seats and transfers host when host leaves', () => {
    game.disconnect('d'); expect(game.hostId).toBe('p'); expect(game.dealerId).toBe('p');
    game.expire('d'); expect(game.players.size).toBe(1);
    game.add('New', 'n'); expect(game.players.get('n')!.seat).toBe(0);
  });
  it('rejects invalid payloads without changing state', () => {
    for (const payload of [null, [], {}, { roundId: 0, actionId: 'id', type: 'fake' }]) expect(() => game.action('p', payload)).toThrow();
    expect(game.phase).toBe('LOBBY');
  });
});
