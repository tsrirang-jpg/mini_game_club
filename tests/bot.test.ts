import { it, expect } from 'vitest';
import { botDecision } from '../apps/server/src/bot';
import { DEFAULT_RULES } from '../packages/shared/src/index';
import type { Card } from '../packages/shared/src/index';
const c = (rank: number): Card => ({ rank, suit: 'hearts' });
it('bot draws at 0–4, stands at 5–9 and never draws with pok or three cards', () => {
  for (let score = 0; score <= 9; score++) {
    expect(botDecision([c(score === 0 ? 10 : score), { rank: 13, suit: 'clubs' }], DEFAULT_RULES)).toBe(score <= 4 ? 'draw' : 'stand');
  }
  expect(botDecision([c(1), c(1), c(1)], DEFAULT_RULES)).toBe('stand');
  expect(botDecision([c(7), { rank: 7, suit: 'clubs' }], DEFAULT_RULES)).toBe('stand');
  expect(botDecision([c(1), c(2)], DEFAULT_RULES)).toBe('stand');
});
