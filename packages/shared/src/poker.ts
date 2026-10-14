import type { Card } from './index.js';
export type PokerPhase = 'LOBBY' | 'DEALING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'ROUND_END';
export const POKER_ACTION_MS = 30_000;
export const HAND_NAMES = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
export interface PokerHand { rank: number; kickers: number[]; name: string; cards: Card[] }
export function comparePoker(a: PokerHand, b: PokerHand): number {
  if (a.rank !== b.rank) return Math.sign(a.rank - b.rank);
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const difference = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}
function five(cards: readonly Card[]): PokerHand {
  const values = cards.map(c => c.rank === 1 ? 14 : c.rank).sort((a, b) => b - a);
  const groups = [...new Set(values)].map(value => ({ value, count: values.filter(v => v === value).length }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const flush = cards.every(c => c.suit === cards[0].suit);
  const unique = [...new Set(values)];
  const straight = unique.length === 5 ? (unique[0] - unique[4] === 4 ? unique[0]
    : unique.join(',') === '14,5,4,3,2' ? 5 : 0) : 0;
  let rank = 0; let kickers = values;
  if (flush && straight) { rank = 8; kickers = [straight]; }
  else if (groups[0].count === 4) { rank = 7; kickers = groups.map(g => g.value); }
  else if (groups[0].count === 3 && groups[1].count === 2) { rank = 6; kickers = groups.map(g => g.value); }
  else if (flush) rank = 5;
  else if (straight) { rank = 4; kickers = [straight]; }
  else if (groups[0].count === 3) { rank = 3; kickers = groups.map(g => g.value); }
  else if (groups[0].count === 2 && groups[1].count === 2) { rank = 2; kickers = groups.map(g => g.value); }
  else if (groups[0].count === 2) { rank = 1; kickers = groups.map(g => g.value); }
  return { rank, kickers, name: rank === 8 && straight === 14 ? 'Royal flush' : HAND_NAMES[rank], cards: [...cards] };
}
export function bestPokerHand(cards: readonly Card[]): PokerHand {
  if (cards.length < 5 || cards.length > 7) throw new Error('Evaluate 5–7 cards');
  let best: PokerHand | undefined;
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++)
    for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++)
      for (let e = d + 1; e < cards.length; e++) {
        const hand = five([cards[a], cards[b], cards[c], cards[d], cards[e]]);
        if (!best || comparePoker(hand, best) > 0) best = hand;
      }
  return best!;
}
export interface PokerPot { amount: number; winners: string[]; eligible: string[]; refund: boolean }
// During betting, only committed all-ins establish pot boundaries. Pending calls
// still change amounts; never publish a winner or promise an uncalled refund yet.
export function pokerLivePots(players: readonly PokerPlayer[]): PokerPot[] {
  const contributors = players.filter(p => p.inHand && p.contribution > 0);
  const maximum = Math.max(0, ...contributors.map(p => p.contribution));
  const levels = [...new Set([...contributors.filter(p => p.allIn && !p.folded).map(p => p.contribution), maximum])]
    .filter(level => level > 0).sort((a, b) => a - b);
  let previous = 0;
  return levels.map(level => {
    const amount = contributors.reduce((sum, p) => sum + Math.max(0, Math.min(p.contribution, level) - previous), 0);
    previous = level;
    return { amount, winners: [], refund: false,
      eligible: players.filter(p => p.inHand && !p.folded && p.contribution + p.points >= level).map(p => p.id) };
  });
}
export interface PokerPotSummary extends PokerPot { awards: Record<string, number> }
// Folded contributions can create adjacent accounting layers with identical
// eligibility. Combine them for display while preserving each layer's odd chips.
export function pokerPotSummaries(pots: readonly PokerPot[]): PokerPotSummary[] {
  const summaries: PokerPotSummary[] = [];
  const same = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));
  for (const pot of pots) {
    const awards = Object.fromEntries(pot.winners.map((id, i) => [id,
      Math.floor(pot.amount / pot.winners.length) + (i < pot.amount % pot.winners.length ? 1 : 0)]));
    const previous = summaries.at(-1);
    if (previous && !pot.refund && !previous.refund && same(previous.eligible, pot.eligible) && same(previous.winners, pot.winners)) {
      previous.amount += pot.amount;
      for (const [id, amount] of Object.entries(awards)) previous.awards[id] = (previous.awards[id] ?? 0) + amount;
    } else summaries.push({ ...pot, eligible: [...pot.eligible], winners: [...pot.winners], awards });
  }
  return summaries;
}
// order is clockwise starting left of the dealer button (odd-chip priority).
export function pokerPayout(contributions: Record<string, number>, folded: Set<string>,
  hands: Record<string, PokerHand>, order: string[]): { payouts: Record<string, number>; pots: PokerPot[] } {
  const payouts = Object.fromEntries(Object.keys(contributions).map(id => [id, 0]));
  const levels = [...new Set(Object.values(contributions).filter(v => v > 0))].sort((a, b) => a - b);
  const pots: PokerPot[] = []; let previous = 0;
  for (const level of levels) {
    const contributors = Object.keys(contributions).filter(id => contributions[id] >= level);
    const amount = (level - previous) * contributors.length; previous = level;
    const eligible = contributors.filter(id => !folded.has(id));
    let winners: string[];
    const refund = contributors.length === 1;
    if (refund) winners = contributors;
    else {
      if (!eligible.length) throw new Error('No eligible player');
      winners = [eligible[0]];
      for (const id of eligible.slice(1)) {
        const comparison = hands[id] && hands[winners[0]] ? comparePoker(hands[id], hands[winners[0]]) : 0;
        if (comparison > 0) winners = [id]; else if (comparison === 0) winners.push(id);
      }
    }
    winners.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    winners.forEach((id, index) => { payouts[id] += Math.floor(amount / winners.length) + (index < amount % winners.length ? 1 : 0); });
    pots.push({ amount, winners, eligible, refund });
  }
  return { payouts, pots };
}
export interface PokerPlayer {
  id: string; name: string; seat: number; points: number; isBot: boolean; connected: boolean; ready: boolean;
  folded: boolean; allIn: boolean; inHand: boolean; streetBet: number; contribution: number; lastAction: string;
}
export interface PokerResult { id: string; name?: string; cards: Card[]; handName: string; payout: number; delta: number }
export interface PokerSnapshot {
  game: 'poker'; code: string; phase: PokerPhase; roundId: number; deadline: number;
  hostId: string; buttonId: string; smallBlindId: string; bigBlindId: string; turnId: string;
  smallBlind: number; bigBlind: number; currentBet: number; minRaise: number;
  turnDurationMs: number;
  raiseAllowedIds: string[];
  players: PokerPlayer[]; board: Card[]; pot: number; pots: PokerPot[]; results: PokerResult[];
}
export type PokerAction = 'setReady' | 'startRound' | 'prepareRound' | 'resetTablePoints' | 'addBot' | 'removeBot'
  | 'fold' | 'check' | 'call' | 'raise' | 'allIn';
