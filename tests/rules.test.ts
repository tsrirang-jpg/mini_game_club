import { describe, it, expect } from 'vitest';
import { randomInt } from 'node:crypto';
import { deck, shuffle, evaluate, compare, makeLedger, applyLedger } from '../packages/shared/src/index';
import type { Card, Suit } from '../packages/shared/src/index';
const c = (rank: number, suit: Suit = 'clubs'): Card => ({ rank, suit });
describe('rules', () => {
  it('scores face cards, ace, and modulo ten', () => {
    expect(evaluate([c(1), c(13)]).score).toBe(1);
    expect(evaluate([c(10), c(11)]).score).toBe(0);
    expect(evaluate([c(7), c(6)]).score).toBe(3);
    expect(evaluate([c(9), c(9), c(9)]).score).toBe(7);
  });
  it('only two-card 8/9 are pok', () => {
    expect(evaluate([c(8), c(12)]).pok).toBe(true);
    expect(evaluate([c(9), c(10)]).pok).toBe(true);
    expect(evaluate([c(3), c(3), c(3)]).pok).toBe(false);
    expect(evaluate([c(7), c(10)]).pok).toBe(false);
  });
  it('uses pair/suit multipliers without stacking', () => {
    expect(evaluate([c(4), c(4, 'hearts')]).multiplier).toBe(2);
    expect(evaluate([c(4), c(5)]).multiplier).toBe(3);
    expect(evaluate([c(1), c(2), c(3)]).multiplier).toBe(3);
    expect(evaluate([c(1), c(2, 'spades'), c(3)]).multiplier).toBe(3);
    expect(evaluate([c(4), c(4, 'hearts'), c(4, 'spades')]).multiplier).toBe(5);
  });
  it('compares pok, then special type, then score', () => {
    expect(compare(evaluate([c(8), c(10)]), evaluate([c(3), c(3), c(3)]))).toBe(1);
    expect(compare(evaluate([c(8), c(10)]), evaluate([c(9), c(10)]))).toBe(-1);
    expect(compare(evaluate([c(1), c(2)]), evaluate([c(1), c(2, 'hearts')]))).toBe(1);
  });
  it('shuffles 52 distinct cards without mutating the input', () => {
    const input = deck(); const before = JSON.stringify(input); const output = shuffle(input, randomInt);
    expect(output).toHaveLength(52);
    expect(new Set(output.map(c => `${c.rank}:${c.suit}`)).size).toBe(52);
    expect(JSON.stringify(input)).toBe(before);
    expect(() => shuffle(input, () => -1)).toThrow();
  });
  it('settles winner multiplier, ties, conserves points and is idempotent', () => {
    const { ledger, results } = makeLedger(1, 'd', {
      d: [c(2), c(3, 'hearts')], p: [c(9), c(13)], q: [c(2), c(3)], r: [c(1), c(2)],
    }, { p: 10, q: 20, r: 50 });
    expect(results.find(r => r.id === 'p')?.delta).toBe(30);
    expect(results.find(r => r.id === 'q')?.delta).toBe(60);
    expect(results.find(r => r.id === 'r')?.delta).toBe(150);
    const settled = new Set<number>();
    const balances = applyLedger({ d: 1000, p: 1000, q: 1000, r: 1000 }, ledger, settled);
    expect(Object.values(balances).reduce((a, b) => a + b, 0)).toBe(4000);
    expect(applyLedger(balances, ledger, settled)).toEqual(balances);
  });
});
