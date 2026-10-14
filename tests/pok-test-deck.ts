import { deck } from '../packages/shared/src/index';
import type { Card } from '../packages/shared/src/index';

// Arrange actual shuffle swaps so pop() deals the requested sequence.
export function dealRandom(sequence: Card[]): (max: number) => number {
  const working = deck();
  const key = (c: Card) => c.suit + ':' + c.rank;
  const selected = new Set(sequence.map(key));
  if (selected.size !== sequence.length) throw new Error('Test deal must contain distinct cards');
  const target = [...working.filter(c => !selected.has(key(c))), ...[...sequence].reverse()];
  return max => {
    const i = max - 1;
    const j = working.findIndex((c, index) => index <= i && key(c) === key(target[i]));
    if (j < 0) throw new Error('Invalid test shuffle');
    [working[i], working[j]] = [working[j], working[i]];
    return j;
  };
}
