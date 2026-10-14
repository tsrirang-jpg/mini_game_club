import { describe, expect, it } from 'vitest';
import { compare, evaluate, makeLedger, applyLedger } from '../packages/shared/src/index';
import type { Card, Suit } from '../packages/shared/src/index';
const c = (rank: number, suit: Suit = 'clubs'): Card => ({ rank, suit });
const hands: Card[][] = [
  [c(9), c(13, 'hearts')], [c(8), c(13, 'hearts')],
  [c(7), c(7, 'hearts'), c(7, 'spades')], [c(11), c(12, 'hearts'), c(13, 'spades')],
  [c(2), c(3, 'hearts'), c(4, 'spades')], [c(1), c(2)], [c(7), c(7, 'hearts')],
  [c(2), c(3, 'hearts'), c(3, 'diamonds')],
];
describe('Pok Deng special hands', () => {
  it('orders every requested category above an ordinary high-scoring hand', () => {
    expect(hands.map(hand => evaluate(hand).handType)).toEqual(['POK9', 'POK8', 'TRIPS', 'FACES', 'STRAIGHT', 'SUITED', 'PAIR', 'NORMAL']);
    for (let i = 0; i < hands.length; i++) for (let j = 0; j < hands.length; j++) {
      expect(compare(evaluate(hands[i]), evaluate(hands[j]))).toBe(i === j ? 0 : i < j ? 1 : -1);
    }
    const ordinary9 = evaluate([c(1), c(4, 'hearts'), c(4, 'diamonds')]);
    expect(ordinary9.score).toBe(9);
    for (const special of hands.slice(2, 7)) expect(compare(evaluate(special), ordinary9)).toBe(1);
  });
  it('recognizes face duplicates, low/high ace straights and rejects wrap/duplicates', () => {
    expect(evaluate([c(11), c(11, 'hearts'), c(12, 'spades')]).handType).toBe('FACES');
    expect(evaluate([c(1), c(2, 'hearts'), c(3, 'spades')]).handType).toBe('STRAIGHT');
    expect(evaluate([c(1), c(12, 'hearts'), c(13, 'spades')]).handType).toBe('STRAIGHT');
    expect(evaluate([c(13), c(1, 'hearts'), c(2, 'spades')]).handType).toBe('NORMAL');
    expect(evaluate([c(2), c(2, 'hearts'), c(3, 'spades')]).handType).toBe('NORMAL');
    expect(evaluate([c(1), c(4), c(7)]).multiplier).toBe(1);
  });
  it('takes the largest multiplier without stacking and preserves Pok priority', () => {
    expect(evaluate([c(11), c(12), c(13)]).multiplier).toBe(5);
    expect(evaluate([c(12), c(12, 'hearts'), c(12, 'spades')]).handType).toBe('TRIPS');
    expect(evaluate([c(12), c(12, 'hearts'), c(12, 'spades')]).multiplier).toBe(5);
    expect(evaluate([c(4), c(4, 'hearts')])).toMatchObject({ handType: 'POK8', multiplier: 2 });
    expect(evaluate([c(9), c(13)])).toMatchObject({ handType: 'POK9', multiplier: 3 });
  });
  it('ties equal type/score across suits and breaks same-type ties by score', () => {
    expect(compare(evaluate([c(7), c(7, 'hearts')]), evaluate([c(7, 'spades'), c(7, 'diamonds')]))).toBe(0);
    expect(compare(evaluate([c(7), c(7, 'hearts')]), evaluate([c(6), c(6, 'hearts')]))).toBe(1);
    expect(compare(evaluate(hands[0]), evaluate([c(9, 'hearts'), c(12, 'hearts')]))).toBe(0);
  });
  it('pays ×5 wins/losses, pays no ties and conserves points exactly once', () => {
    for (const dealerWins of [true, false]) {
      const { ledger, results } = makeLedger(20, 'd', { d: dealerWins ? hands[2] : hands[7], p: dealerWins ? hands[7] : hands[2], tie: dealerWins ? hands[2] : hands[7] }, { p: 50, tie: 10 });
      expect(results.find(r => r.id === 'p')?.delta).toBe(dealerWins ? -250 : 250);
      expect(ledger.entries.tie).toBe(0);
      const settled = new Set<number>();
      const balances = applyLedger({ d: 1000, p: 1000, tie: 1000 }, ledger, settled);
      expect(Object.values(balances).reduce((a, b) => a + b)).toBe(3000);
      expect(applyLedger(balances, ledger, settled)).toEqual(balances);
    }
  });
});
