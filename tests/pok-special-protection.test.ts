import {afterEach, describe, expect, it, vi} from 'vitest';
import {Game} from '../apps/server/src/game';
import {DEFAULT_RULES, applyLedger, evaluate, makeLedger} from '../packages/shared/src/index';
import type {ActionType, Card, Suit} from '../packages/shared/src/index';
import {dealRandom} from './pok-test-deck';

const c = (rank: number, suit: Suit): Card => ({rank, suit});
const specials = [
  {kind:'yellow', cards:[c(13,'clubs'),c(13,'hearts'),c(11,'clubs')], multiplier:3},
  {kind:'straight', cards:[c(3,'clubs'),c(4,'hearts'),c(5,'clubs')], multiplier:3},
  {kind:'straightFlush', cards:[c(3,'diamonds'),c(4,'diamonds'),c(5,'diamonds')], multiplier:5},
  {kind:'triple', cards:[c(4,'clubs'),c(4,'hearts'),c(4,'spades')], multiplier:5},
] as const;
const protectedHands = [
  {score:8, cards:[c(13,'diamonds'),c(2,'spades'),c(6,'hearts')]},
  {score:9, cards:[c(13,'diamonds'),c(2,'spades'),c(7,'hearts')]},
  {score:8, cards:[c(13,'spades'),c(2,'spades'),c(6,'spades')]},
  {score:9, cards:[c(13,'spades'),c(2,'spades'),c(7,'spades')]},
];
let game: Game | undefined;
afterEach(() => {game?.dispose(); game = undefined; vi.useRealTimers();});

describe('three-card 8/9 protection against dealer specials', () => {
  it.each(specials)('ties ordinary three-card 8/9 against dealer $kind, including final catch recomparison', ({kind,cards}) => {
    for (const player of protectedHands) for (const bet of DEFAULT_RULES.bets) for (const caught of [false,true]) {
      const {ledger,results} = makeLedger(1,'d',{d:[...cards],p:player.cards},{p:bet},
        DEFAULT_RULES,caught ? {p:cards.slice(0,2)} : {});
      const result = results.find(r => r.id === 'p')!;
      expect(result).toMatchObject({score:player.score,pok:false,outcome:'TIE',delta:0,
        ...(caught ? {caught:true,catchRecompared:true,dealerValue:{special:kind}} : {})});
      expect(result.special).toBeUndefined();
      expect(result.multiplier).toBe(evaluate(player.cards).multiplier);
      expect(results.find(r => r.id === 'd')).toMatchObject({special:kind,delta:0});
      expect(ledger.entries).toEqual({d:0,p:0});
      const settled = new Set<number>(), before = {d:1000,p:1000};
      const after = applyLedger(before,ledger,settled);
      expect(after).toEqual(before);
      expect(applyLedger(after,ledger,settled)).toEqual(before);
    }
  });

  it.each(specials)('still charges ordinary scores below eight and pays two-card Pok against dealer $kind', ({cards,multiplier}) => {
    const {ledger,results} = makeLedger(1,'d',{
      d:[...cards],two:[c(13,'diamonds'),c(7,'hearts')],
      three:[c(13,'spades'),c(2,'spades'),c(5,'hearts')],
      pok:[c(9,'hearts'),c(12,'hearts')],
    },{two:10,three:20,pok:50});
    expect(results.find(r => r.id === 'two')).toMatchObject({score:7,outcome:'LOSE',delta:-10*multiplier});
    expect(results.find(r => r.id === 'three')).toMatchObject({score:7,outcome:'LOSE',delta:-20*multiplier});
    expect(results.find(r => r.id === 'pok')).toMatchObject({pok:true,outcome:'WIN',delta:100});
    expect(Object.values(ledger.entries).reduce((sum,value) => sum+value,0)).toBe(0);
  });

  it('keeps special-versus-special ranking even when the player special totals eight', () => {
    const {results} = makeLedger(1,'d',{
      d:[c(7,'clubs'),c(7,'hearts'),c(7,'diamonds')],
      p:[c(6,'clubs'),c(6,'hearts'),c(6,'diamonds')],
    },{p:10});
    expect(results.find(r => r.id === 'p')).toMatchObject({score:8,special:'triple',outcome:'LOSE',delta:-50});
  });

  it.each([false,true])('settles the reported yellow-hand defect through real draw actions (caught=%s)', caught => {
    vi.useFakeTimers();
    game = new Game('PROTECTED',{changed() {},privateHand() {}},
      {...DEFAULT_RULES,dealMs:100,revealMs:100,settlementMs:100},dealRandom([
        c(13,'clubs'),c(13,'diamonds'),c(12,'clubs'),c(4,'clubs'),c(3,'diamonds'),
        c(13,'hearts'),c(2,'spades'),c(2,'diamonds'),c(2,'hearts'),c(5,'diamonds'),
        c(7,'hearts'),c(6,'spades'),c(10,'hearts'),c(11,'clubs'),
      ]));
    let serial = 0;
    const act = (id: string, type: ActionType, value?: boolean | string) =>
      game!.action(id,{type,value,roundId:game!.roundId,actionId:'protection-'+ ++serial});
    for (const id of ['d','nine','eight','low','pok8']) game.add(id,id);
    for (const id of ['nine','eight','low','pok8']) act(id,'setReady',true);
    act('d','startRound'); vi.advanceTimersByTime(100);
    for (const id of ['nine','eight','low']) act(id,'draw');
    expect(game.phase).toBe('DEALER_ACTION');
    if (caught) {
      act('d','catch','nine'); act('d','catch','eight');
      expect(game.snapshot().catches.every(r => r.outcome === 'WIN' && r.delta === 10)).toBe(true);
    }
    act('d','draw');
    const revealed = game.snapshot();
    expect(revealed.phase).toBe('REVEAL');
    for (const [id,score] of [['nine',9],['eight',8]] as const) {
      expect(revealed.results.find(r => r.id === id)).toMatchObject({score,pok:false,outcome:'TIE',delta:0});
      if (caught) expect(revealed.catches.find(r => r.id === id)).toMatchObject({
        outcome:'TIE',delta:0,catchRecompared:true,dealerValue:{special:'yellow'},
      });
    }
    expect(Object.fromEntries(revealed.results.map(r => [r.id,r.delta]))).toEqual({nine:0,eight:0,low:-30,pok8:20,d:10});
    expect(game.players.get('nine')!.points).toBe(1000);
    vi.advanceTimersByTime(200);
    expect(game.phase).toBe('ROUND_END');
    expect(Object.fromEntries(game.snapshot().players.map(p => [p.id,p.points]))).toEqual({d:1010,nine:1000,eight:1000,low:970,pok8:1020});
    expect(game.snapshot().players.reduce((sum,p) => sum+p.points,0)).toBe(5000);
    game.disconnect('nine'); game.reconnect('nine');
    expect(game.snapshot().results).toEqual(revealed.results);
    vi.advanceTimersByTime(30000);
    expect(game.players.get('nine')!.points).toBe(1000);
    expect(game.players.get('d')!.points).toBe(1010);
  });
});
