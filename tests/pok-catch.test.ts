import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../apps/server/src/game';
import { DEFAULT_RULES } from '../packages/shared/src/index';
import type { Card, Suit, ActionType } from '../packages/shared/src/index';
import { dealRandom } from './pok-test-deck';
const c = (rank: number, suit: Suit = 'clubs'): Card => ({ rank, suit });
const sequence = [c(2),c(1),c(2,'hearts'),c(3),c(3,'hearts'),c(4,'spades'),c(12,'diamonds'),c(9,'diamonds')];
let game: Game, hands: Record<string, Card[]>;
let serial = 0;
const act = (id: string, type: ActionType, value?: string, roundId = game.roundId, actionId = 'catch-test-' + ++serial) => game.action(id, { type, value, roundId, actionId });
function start() {
  for (const id of ['p','q']) game.action(id, { type: 'setReady', value: true, roundId: 0, actionId: 'ready-' + id });
  act('d','startRound'); vi.advanceTimersByTime(100);
}
function dealerTurn() { start(); act('p','draw'); act('q','stand'); expect(game.phase).toBe('DEALER_ACTION'); }
beforeEach(() => {
  vi.useFakeTimers(); hands = {};
  game = new Game('CATCH', { changed() {}, privateHand(id, cards) { hands[id] = cards.map(c => ({ ...c })); } },
    { ...DEFAULT_RULES, dealMs: 100, actionMs: 1000, revealMs: 100, settlementMs: 100 }, dealRandom(sequence));
  for (const [id,name] of [['d','Dealer'],['p','Draws'],['q','Stands']]) game.add(name,id);
});
afterEach(() => { game.dispose(); vi.useRealTimers(); });
describe('dealer catch', () => {
  it('locks a three-card match against two dealer cards, then draws for remaining players', () => {
    dealerTurn(); const two = hands.d.map(c => ({ ...c })); const deadline = game.deadline;
    vi.advanceTimersByTime(400);
    act('d','catch','p',game.roundId,'once');
    expect(game.phase).toBe('DEALER_ACTION'); expect(game.deadline).toBe(deadline + 400);
    expect(game.players.get('d')!.acted).toBe(false); expect(hands.d).toHaveLength(2);
    const caught = game.snapshot().catches[0];
    expect(caught).toMatchObject({ id: 'p', caught: true, delta: -20, outcome: 'LOSE', dealerValue: { score: 5, multiplier: 2 } });
    expect(caught.dealerCards).toEqual(two); expect(caught.cards).toHaveLength(3);
    expect(game.snapshot().results).toEqual([]); expect(game.players.get('p')!.points).toBe(1000);
    const resetDeadline = game.deadline;
    vi.advanceTimersByTime(100);
    act('d','catch','p',game.roundId,'once'); expect(game.snapshot().catches).toHaveLength(1);
    expect(() => act('d','catch','p')).toThrow('ถูกจับแล้ว');
    expect(game.deadline).toBe(resetDeadline);
    act('d','draw'); expect(hands.d).toHaveLength(3);
    const s = game.snapshot();
    expect(s.results.find(r => r.id === 'd')!.score).toBe(4);
    expect(s.results.find(r => r.id === 'p')).toMatchObject({ caught: true, delta: -20, dealerCards: two });
    expect(s.results.find(r => r.id === 'q')).toMatchObject({ delta: 10, outcome: 'WIN' });
    vi.advanceTimersByTime(200);
    expect(game.phase).toBe('ROUND_END');
    expect(Object.fromEntries([...game.players].map(([id,p]) => [id,p.points]))).toEqual({ d: 1010, p: 980, q: 1010 });
    vi.advanceTimersByTime(5000); expect(game.players.get('d')!.points).toBe(1010);
    act('d','prepareRound'); expect(game.snapshot().catches).toEqual([]);
  });
  it('cancels the old timeout and auto-stands only at the reset deadline', () => {
    dealerTurn(); vi.advanceTimersByTime(800); act('d','catch','p');
    vi.advanceTimersByTime(200); expect(game.phase).toBe('DEALER_ACTION');
    vi.advanceTimersByTime(799); expect(game.phase).toBe('DEALER_ACTION');
    vi.advanceTimersByTime(1);
    expect(game.phase).toBe('REVEAL'); expect(hands.d).toHaveLength(2);
    expect(game.snapshot().results.find(r => r.id === 'p')!.delta).toBe(-20);
    expect(game.snapshot().results.find(r => r.id === 'q')!.delta).toBe(10);
  });
  it('defaults to 30 seconds and resets after every successful catch with players remaining', () => {
    expect(DEFAULT_RULES.actionMs).toBe(30000);
    game.dispose(); hands = {};
    game = new Game('RESET', { changed() {}, privateHand(id,cards) { hands[id] = [...cards]; } },
      { ...DEFAULT_RULES, dealMs:100,revealMs:100,settlementMs:100 },
      dealRandom([c(2),c(1),c(2,'hearts'),c(4,'hearts'),c(3),c(3,'hearts'),c(4,'spades'),c(1,'spades'),c(12,'diamonds'),c(9,'diamonds')]));
    for (const id of ['d','p','q','r']) game.add(id,id);
    for (const id of ['p','q','r']) game.action(id,{type:'setReady',value:true,roundId:0,actionId:'ready-'+id});
    act('d','startRound'); vi.advanceTimersByTime(100);
    expect(game.deadline - Date.now()).toBe(30000);
    act('p','draw'); act('q','draw'); act('r','stand');
    expect(game.deadline - Date.now()).toBe(30000);
    vi.advanceTimersByTime(25000); act('d','catch','p');
    expect(game.deadline - Date.now()).toBe(30000);
    vi.advanceTimersByTime(26000); expect(game.phase).toBe('DEALER_ACTION');
    act('d','catch','q'); expect(game.deadline - Date.now()).toBe(30000);
    vi.advanceTimersByTime(29999); expect(game.phase).toBe('DEALER_ACTION');
    vi.advanceTimersByTime(1); expect(game.phase).toBe('REVEAL');
    expect(game.snapshot().catches).toHaveLength(2); expect(hands.d).toHaveLength(2);
  });
  it('only permits the dealer to catch an unresolved three-card hand before drawing', () => {
    start(); expect(() => act('d','catch','p')).toThrow('ตาเจ้ามือ');
    act('p','draw'); act('q','stand');
    expect(() => act('p','catch','q')).toThrow('ตาเจ้ามือ');
    for (const id of ['d','q','unknown']) expect(() => act('d','catch',id)).toThrow('ไพ่ 3 ใบ');
    expect(() => act('d','catch','p',0)).toThrow('รอบเก่า');
    act('d','draw'); expect(() => act('d','catch','p')).toThrow('ตาเจ้ามือ');
    expect(game.snapshot().catches).toEqual([]);
  });
  it('rejects expired catch commands without changing hands or outcomes', () => {
    dealerTurn(); vi.setSystemTime(game.deadline + 1);
    expect(() => act('d','catch','p')).toThrow('หมดเวลา');
    expect(game.snapshot().catches).toEqual([]); expect(hands.d).toHaveLength(2);
  });
  it('catches multiple three-card players separately before ending the round', () => {
    start(); act('p','draw'); act('q','draw');
    act('d','catch','p'); expect(game.phase).toBe('DEALER_ACTION');
    act('d','catch','q'); expect(game.phase).toBe('REVEAL');
    expect(game.snapshot().catches).toHaveLength(2); expect(hands.d).toHaveLength(2);
    expect(game.snapshot().results.find(r => r.id === 'q')).toMatchObject({ caught:true,delta:0,outcome:'TIE' });
    vi.advanceTimersByTime(200); expect(game.players.get('d')!.points).toBe(1020);
  });
  it('pays five times when a caught three-card player has triples', () => {
    game.dispose(); hands = {};
    game = new Game('TRIPLE', { changed() {}, privateHand(id,cards) { hands[id] = [...cards]; } },
      { ...DEFAULT_RULES, dealMs:100,actionMs:1000,revealMs:100,settlementMs:100 },
      dealRandom([c(2),c(7,'hearts'),c(2,'hearts'),c(3),c(7,'spades'),c(4,'spades'),c(7,'diamonds'),c(9,'diamonds')]));
    for (const id of ['d','p','q']) game.add(id,id);
    dealerTurn(); act('d','catch','p');
    expect(game.snapshot().catches[0]).toMatchObject({ special:'triple',multiplier:5,delta:50,outcome:'WIN' });
    act('d','draw'); vi.advanceTimersByTime(200);
    expect(game.players.get('p')!.points).toBe(1050);
    expect([...game.players.values()].reduce((sum,p) => sum + p.points,0)).toBe(3000);
  });
  it('only reveals the caught player and frozen dealer hand, and preserves both on reconnect', () => {
    dealerTurn(); act('d','catch','p');
    const original = game.snapshot().catches;
    game.disconnect('d'); game.reconnect('d');
    expect(game.snapshot().catches).toEqual(original); expect(hands.d).toHaveLength(2);
    expect(game.snapshot().players.every(p => !('cards' in p))).toBe(true);
    expect(game.snapshot().results).toEqual([]);
    const snapshot = game.snapshot(); snapshot.catches[0].dealerCards![0].rank = 13; snapshot.catches[0].cards[0].rank = 13;
    expect(game.snapshot().catches).toEqual(original);
    game.expire('p'); act('d','stand'); vi.advanceTimersByTime(200);
    expect(game.players.has('p')).toBe(false);
    expect(game.snapshot().results.find(r => r.id === 'p')!.delta).toBe(-20);
  });
  it('ends when everyone has been caught, without drawing or paying twice', () => {
    game.dispose(); hands = {};
    game = new Game('ALL', { changed() {}, privateHand(id,cards) { hands[id] = [...cards]; } },
      { ...DEFAULT_RULES, dealMs: 100, actionMs: 1000, revealMs: 100, settlementMs: 100 },
      dealRandom([c(2),c(1),c(3),c(3,'hearts'),c(12,'diamonds')]));
    game.add('Dealer','d'); game.add('Draws','p');
    game.action('p',{ type:'setReady', value:true, roundId:0, actionId:'ready' });
    act('d','startRound'); vi.advanceTimersByTime(100); act('p','draw');
    act('d','catch','p',game.roundId,'all-once'); expect(game.phase).toBe('REVEAL');
    act('d','catch','p',game.roundId,'all-once');
    vi.advanceTimersByTime(200); expect(hands.d).toHaveLength(2);
    expect(game.players.get('d')!.points).toBe(1020); expect(game.players.get('p')!.points).toBe(980);
  });
});
