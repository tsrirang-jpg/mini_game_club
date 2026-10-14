import { evaluate } from '../../../packages/shared/src/index.js';
import type { Card, RoomRules } from '../../../packages/shared/src/index.js';

// Only the bot's own hand is provided. Never inspect opponents or the stock.
export function botDecision(hand: readonly Card[], rules: RoomRules): 'draw' | 'stand' {
  const value = evaluate(hand, rules);
  return hand.length === 2 && value.handType === 'NORMAL' && value.score <= 4 ? 'draw' : 'stand';
}
