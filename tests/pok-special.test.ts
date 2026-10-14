import { describe, expect, it } from 'vitest';
import { compare, evaluate, isStraight, handLabel, makeLedger, applyLedger } from '../packages/shared/src/index';
import type { Card, Suit } from '../packages/shared/src/index';
const c = (rank: number, suit: Suit = 'clubs'): Card => ({ rank, suit });
const hand = (ranks: number[]) => ranks.map((rank, i) => c(rank, (['clubs','hearts','spades'] as Suit[])[i]));
describe('Pok Deng special hands', () => {
  it('orders points, yellow, straight, straight flush, triples and Pok from low to high', () => {
    const hands = [hand([2,2,5]),hand([11,11,13]),hand([2,3,4]),[c(2),c(3),c(4)],hand([2,2,2]),[c(8),c(13,'hearts')],[c(9),c(12,'hearts')]];
    for (let i = 0; i < hands.length; i++) for (let j = i + 1; j < hands.length; j++) {
      expect(compare(evaluate(hands[i]),evaluate(hands[j]))).toBe(-1);
      expect(compare(evaluate(hands[j]),evaluate(hands[i]))).toBe(1);
    }
    expect(evaluate(hand([2,3,4])).pok).toBe(false);
  });
  it('uses the winning hand multiplier without stacking overlapping conditions', () => {
    expect(evaluate([c(7),c(7,'hearts')]).multiplier).toBe(2);
    expect(evaluate([c(1),c(2)]).multiplier).toBe(2);
    expect(evaluate([c(1),c(4),c(7)]).multiplier).toBe(3);
    expect(evaluate(hand([11,11,13]))).toMatchObject({ special:'yellow',multiplier:3 });
    expect(evaluate(hand([2,3,4]))).toMatchObject({ special:'straight',multiplier:3 });
    expect(evaluate([c(2),c(3),c(4)])).toMatchObject({ special:'straightFlush',multiplier:5 });
    expect(evaluate(hand([7,7,7]))).toMatchObject({ special:'triple',multiplier:5 });
    expect(evaluate(hand([11,12,13]))).toMatchObject({ special:'straight',multiplier:3 });
    expect(evaluate([c(11),c(12),c(13)])).toMatchObject({ special:'straightFlush',multiplier:5 });
    expect(evaluate(hand([7,7,13])).multiplier).toBe(1);
    expect(evaluate([c(10),c(10,'hearts'),c(13,'spades')]).special).toBeUndefined();
  });
  it('treats A as high only for straights and special-hand comparison, without wraparound', () => {
    for (const ranks of [[2,3,4],[5,6,7],[11,12,13],[12,13,1],[1,13,12]]) expect(isStraight(hand(ranks))).toBe(true);
    for (const ranks of [[1,2,3],[13,1,2],[2,2,3],[11,13,1]]) expect(isStraight(hand(ranks))).toBe(false);
    expect(isStraight([c(2),c(3)])).toBe(false);
    expect(evaluate([c(1),c(13)]).score).toBe(1);
    expect(evaluate(hand([12,13,1]))).toMatchObject({ special:'straight',highCard:14,score:1 });
  });
  it('compares the highest rank of matching special hands, with A highest and suits ignored', () => {
    expect(compare(evaluate(hand([7,7,7])),evaluate(hand([5,5,5])))).toBe(1);
    expect(compare(evaluate(hand([1,1,1])),evaluate(hand([13,13,13])))).toBe(1);
    expect(compare(evaluate(hand([12,13,1])),evaluate(hand([11,12,13])))).toBe(1);
    expect(compare(evaluate([c(12),c(13),c(1)]),evaluate([c(11,'hearts'),c(12,'hearts'),c(13,'hearts')]))).toBe(1);
    expect(compare(evaluate(hand([11,11,13])),evaluate(hand([11,12,12])))).toBe(1);
    expect(compare(evaluate(hand([13,13,11])),evaluate(hand([13,12,12])))).toBe(0);
    expect(compare(evaluate(hand([7,7,7])),evaluate([c(7,'diamonds'),c(7,'hearts'),c(7,'spades')]))).toBe(0);
  });
  it('ties equal normal points, regardless of multiplier', () => {
    expect(compare(evaluate([c(1),c(2)]),evaluate([c(1),c(2,'hearts')]))).toBe(0);
    expect(compare(evaluate([c(7),c(7,'hearts')]),evaluate([c(1),c(3,'spades')]))).toBe(0);
  });
  it('ties matching Pok scores even when the highest ranks or multipliers differ', () => {
    expect(compare(evaluate([c(1),c(8)]),evaluate([c(9),c(13,'hearts')]))).toBe(0);
    expect(compare(evaluate([c(9),c(9,'hearts')]),evaluate([c(8),c(13,'hearts')]))).toBe(0);
    const { results } = makeLedger(1,'d',{d:[c(1),c(8)],p:[c(9),c(13,'hearts')]},{p:50});
    expect(results.find(r => r.id === 'p')).toMatchObject({ pok:true,score:9,outcome:'TIE',delta:0 });
  });
  it.each([
    [8,8,'TIE',0], [8,9,'WIN',20], [9,8,'LOSE',-10], [9,9,'TIE',0],
  ] as const)('compares dealer three-card %i against player Pok %i by points', (dealerScore, playerScore, outcome, delta) => {
    const { results } = makeLedger(1,'d',{
      d:[c(6),c(1,'diamonds'),c(dealerScore - 7,'spades')],
      p:[c(playerScore,'hearts'),c(12,'hearts')],
    },{p:10});
    expect(results.find(r => r.id === 'p')).toMatchObject({ outcome,delta });
    expect(results.find(r => r.id === 'd')!.delta).toBe(delta === 0 ? 0 : -delta);
  });
  it('uses the drawn dealer multiplier only on a win, never to break an equal score', () => {
    const { results } = makeLedger(1,'d',{d:[c(6),c(1),c(2)],p:[c(8,'hearts'),c(12,'hearts')],q:[c(9,'spades'),c(12,'spades')]},{p:10,q:50});
    expect(results.find(r => r.id === 'p')).toMatchObject({ outcome:'LOSE',delta:-30 });
    expect(results.find(r => r.id === 'q')).toMatchObject({ outcome:'TIE',delta:0 });
  });
  it('keeps player three-card points and dealer special hands in their existing ranks', () => {
    const normalPlayer = makeLedger(1,'d',{d:[c(8),c(12,'hearts')],p:[c(6),c(1,'diamonds'),c(2,'spades')]},{p:10});
    expect(normalPlayer.results.find(r => r.id === 'p')).toMatchObject({ outcome:'LOSE',delta:-10,pok:false });
    const dealerTriple = makeLedger(1,'d',{d:hand([3,3,3]),p:[c(8,'hearts'),c(12,'hearts')]},{p:10});
    expect(dealerTriple.results.find(r => r.id === 'p')).toMatchObject({ outcome:'WIN',delta:20 });
  });
  it.each([
    ['yellow',hand([11,11,12])], ['straight',[c(6,'spades'),c(5,'spades'),c(7,'diamonds')]],
    ['straightFlush',[c(2),c(3),c(4)]], ['triple',hand([7,7,7])],
  ] as const)('dealer drawn 8/9 beats player %s, including previously caught hands', (special, cards) => {
    for (const score of [8,9]) for (const caught of [false,true]) {
      const dealerCards = [c(6),c(1,'diamonds'),c(score - 7,'spades')];
      const { ledger,results } = makeLedger(1,'d',{d:dealerCards,p:[...cards]},{p:10},undefined,caught ? {p:dealerCards.slice(0,2)} : {});
      expect(results.find(r => r.id === 'p')).toMatchObject({ special,outcome:'LOSE',delta:-10,
        ...(caught ? {caught:true,catchRecompared:true,dealerCards,dealerValue:{score}} : {}) });
      expect(ledger.entries).toEqual({d:10,p:-10});
    }
  });
  it('charges the winning drawn dealer multiplier rather than the losing player special multiplier', () => {
    const { results } = makeLedger(1,'d',{d:[c(3),c(4),c(1)],p:[c(9,'diamonds'),c(10,'diamonds'),c(11,'diamonds')]},{p:20});
    expect(results.find(r => r.id === 'p')).toMatchObject({special:'straightFlush',multiplier:5,outcome:'LOSE',delta:-60});
    expect(results.find(r => r.id === 'd')).toMatchObject({score:8,multiplier:3,delta:60});
  });
  it('pays five times for triples and straight flushes in either direction and settles once', () => {
    const { ledger,results } = makeLedger(1,'d',{ d:[c(3),c(4,'hearts')],p:hand([7,7,7]),q:[c(12),c(13),c(1)] },{p:10,q:20});
    expect(results.find(r => r.id === 'p')?.delta).toBe(50);
    expect(results.find(r => r.id === 'q')?.delta).toBe(100);
    const loss = makeLedger(2,'d',{ d:hand([7,7,7]),p:[c(12),c(13),c(1)] },{p:50});
    expect(loss.results.find(r => r.id === 'p')?.delta).toBe(-250);
    const settled = new Set<number>(); const balances = applyLedger({d:1000,p:1000,q:1000},ledger,settled);
    expect(Object.values(balances).reduce((a,b) => a + b,0)).toBe(3000);
    expect(applyLedger(balances,ledger,settled)).toEqual(balances);
  });
  it('rejects catch overrides for hands other than two dealer cards versus three player cards', () => {
    expect(() => makeLedger(1,'d',{d:[c(2),c(3)],p:[c(4),c(5)]},{p:10},undefined,{p:[c(2),c(3)]})).toThrow('Catch requires');
    expect(() => makeLedger(1,'d',{d:[c(2),c(3)],p:hand([2,2,5])},{p:10},undefined,{p:hand([2,3,4])})).toThrow('Catch requires');
  });
  it('labels each special hand for the UI', () => {
    expect(handLabel(evaluate(hand([11,11,13])))).toBe('สามเหลือง');
    expect(handLabel(evaluate(hand([2,3,4])))).toBe('เรียง');
    expect(handLabel(evaluate([c(2),c(3),c(4)]))).toBe('เรียงฟลัช');
    expect(handLabel(evaluate(hand([7,7,7])))).toBe('ตอง');
    expect(handLabel(evaluate([c(9),c(13)]))).toBe('ป๊อก 9');
  });
});
