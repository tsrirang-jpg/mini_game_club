import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../apps/server/src/game';
import { DEFAULT_RULES } from '../packages/shared/src/index';
import type { ActionType, Card, Suit } from '../packages/shared/src/index';
import { dealRandom } from './pok-test-deck';

const c = (rank: number, suit: Suit): Card => ({ rank, suit });
let game: Game;
let serial = 0;
const act = (id: string, type: ActionType, value?: string | boolean) => game.action(id, { type, value, roundId:game.roundId,actionId:'pok-reveal-' + ++serial });
function setup(dealerScore = 8, caughtScore = 8) {
  const sequence = [c(6,'clubs'),c(9,'clubs'),c(2,'spades'),c(8,'diamonds'),c(1,'hearts'),
    c(1,'diamonds'),c(5,'hearts'),c(7,'spades'),c(12,'diamonds'),c(5,'spades'),
    c(caughtScore - 4,caughtScore === 8 ? 'hearts' : 'clubs'),c(dealerScore - 7,dealerScore === 9 ? 'diamonds' : 'spades')];
  game = new Game('POK', {changed() {},privateHand() {}},
    {...DEFAULT_RULES,dealMs:100,revealMs:100,settlementMs:100},dealRandom(sequence));
  for (const id of ['d','caught','pok9','pok8','six']) game.add(id,id);
  for (const id of ['caught','pok9','pok8','six']) act(id,'setReady',true);
  act('d','startRound');
}
function catchThenDraw() {
  vi.advanceTimersByTime(100); act('caught','draw'); act('six','stand');
  expect(game.phase).toBe('DEALER_ACTION');
  act('d','catch','caught');
  expect(game.snapshot().catches[0]).toMatchObject({outcome:'WIN',delta:10,dealerValue:{score:7}});
  expect(game.snapshot().catches[0].dealerCards).toHaveLength(2);
  act('d','draw');
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { game?.dispose(); vi.useRealTimers(); });
describe('immediate Pok reveal and dealer drawn points', () => {
  it('opens only players with two-card Pok as soon as dealt, and preserves that view on reconnect', () => {
    setup();
    const s = game.snapshot();
    expect(s.phase).toBe('DEALING'); expect(s.results).toEqual([]); expect(s.catches).toEqual([]);
    expect(s.revealedHands.map(r => r.id)).toEqual(['pok9','pok8']);
    expect(s.revealedHands[0]).toMatchObject({pok:true,score:9,multiplier:2,cards:[c(2,'spades'),c(7,'spades')]});
    expect(s.revealedHands[1]).toMatchObject({pok:true,score:8,multiplier:2,cards:[c(8,'diamonds'),c(12,'diamonds')]});
    expect(s.players.every(p => !('cards' in p))).toBe(true);
    game.disconnect('six'); game.reconnect('six');
    expect(game.snapshot().revealedHands).toEqual(s.revealedHands);
    s.revealedHands[0].cards[0].rank = 13;
    expect(game.snapshot().revealedHands[0].cards[0]).toEqual(c(2,'spades'));
    vi.advanceTimersByTime(100);
    expect(() => act('pok8','draw')).toThrow('มีป๊อก');
    expect(() => act('pok9','stand')).toThrow('มีป๊อก');
    act('caught','draw');
    expect(game.snapshot().revealedHands.map(r => r.id)).toEqual(['pok9','pok8']);
  });
  it('reproduces the reported table: both 8s tie, only Pok9 wins and six loses', () => {
    setup(); catchThenDraw();
    const snapshot = game.snapshot();
    expect(snapshot.phase).toBe('REVEAL'); expect(snapshot.settled).toBe(false);
    expect(Object.fromEntries(snapshot.results.map(r => [r.id,r.delta]))).toEqual({caught:0,pok9:20,pok8:0,six:-10,d:-10});
    expect(snapshot.catches[0]).toMatchObject({outcome:'TIE',delta:0,caught:true,catchRecompared:true,dealerValue:{score:8}});
    expect(snapshot.catches[0].dealerCards).toEqual([c(6,'clubs'),c(1,'diamonds'),c(1,'spades')]);
    expect(snapshot.results.find(r => r.id === 'caught')).toEqual(snapshot.catches[0]);
    vi.advanceTimersByTime(200);
    expect(Object.fromEntries([...game.players].map(([id,p]) => [id,p.points]))).toEqual({d:990,caught:1000,pok9:1020,pok8:1000,six:990});
    game.disconnect('d'); game.reconnect('d');
    expect(game.snapshot().catches).toEqual(snapshot.catches);
    vi.advanceTimersByTime(30000);
    expect(game.players.get('d')!.points).toBe(990);
    act(game.hostId,'prepareRound');
    expect(game.snapshot().revealedHands).toEqual([]); expect(game.snapshot().catches).toEqual([]);
  });
  it.each([[9,8,-10,'LOSE'],[9,9,0,'TIE']] as const)('after dealer draws to %i, recompares a caught %i-point player', (dealerScore, caughtScore, delta, outcome) => {
    setup(dealerScore,caughtScore); catchThenDraw();
    expect(game.snapshot().catches[0]).toMatchObject({outcome,delta,catchRecompared:true,dealerValue:{score:dealerScore}});
    expect(game.snapshot().results.find(r => r.id === 'pok9')).toMatchObject({outcome:'TIE',delta:0});
    expect(game.snapshot().results.find(r => r.id === 'pok8')).toMatchObject({outcome:'LOSE',delta:-10});
    vi.advanceTimersByTime(200);
    expect([...game.players.values()].reduce((sum,p) => sum + p.points,0)).toBe(5000);
  });
  it('reproduces the special-hand defect: drawn dealer eight beats the caught straight and collects forty', () => {
    game = new Game('SPECIAL', {changed() {},privateHand() {}},
      {...DEFAULT_RULES,dealMs:100,revealMs:100,settlementMs:100},dealRandom([
        c(7,'spades'),c(9,'diamonds'),c(3,'diamonds'),c(6,'spades'),c(12,'diamonds'),c(1,'hearts'),
        c(7,'clubs'),c(9,'spades'),c(10,'spades'),c(5,'spades'),c(11,'hearts'),c(13,'spades'),
        c(12,'spades'),c(7,'diamonds'),c(6,'clubs'),c(3,'clubs'),c(4,'hearts'),
      ]));
    for (const id of ['d','pok8','three','straight','six','four']) game.add(id,id);
    for (const id of ['pok8','three','straight','six','four']) act(id,'setReady',true);
    act('d','startRound'); vi.advanceTimersByTime(100);
    for (const id of ['three','straight','six','four']) act(id,'draw');
    for (const id of ['three','straight','six','four']) act('d','catch',id);
    expect(game.snapshot().catches.find(r => r.id === 'straight')).toMatchObject({special:'straight',outcome:'WIN',delta:30});
    act('d','draw');
    const s = game.snapshot();
    expect(Object.fromEntries(s.results.map(r => [r.id,r.delta]))).toEqual({pok8:0,three:-10,straight:-10,six:-10,four:-10,d:40});
    expect(s.catches.find(r => r.id === 'straight')).toMatchObject({special:'straight',score:8,outcome:'LOSE',delta:-10,catchRecompared:true,dealerValue:{score:8,multiplier:1}});
    expect(s.catches.every(r => r.catchRecompared && r.outcome === 'LOSE')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(game.players.get('d')!.points).toBe(1040);
    expect(game.players.get('straight')!.points).toBe(990);
    expect([...game.players.values()].reduce((sum,p) => sum + p.points,0)).toBe(6000);
    vi.advanceTimersByTime(30000); expect(game.players.get('d')!.points).toBe(1040);
  });
});
