import type { RoundMembership } from './room.js';
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export interface Card { rank: number; suit: Suit }
export type Phase = 'LOBBY' | 'DEALING' | 'PLAYER_ACTIONS' | 'DEALER_ACTION' | 'REVEAL' | 'SETTLEMENT' | 'ROUND_END';
export interface RoomRules {
  actionMs: number; dealMs: number; revealMs: number; settlementMs: number;
  reconnectSeconds: number; initialPoints: number; maxPlayers: number;
  bets: readonly number[]; pairMultiplier: number; suitedTwoMultiplier: number; suitedThreeMultiplier: number;
  yellowMultiplier: number; tripleMultiplier: number; straightMultiplier: number; straightFlushMultiplier: number;
}
export const DEFAULT_RULES: RoomRules = {
  actionMs: 30_000, dealMs: 900, revealMs: 1800, settlementMs: 500,
  reconnectSeconds: 60, initialPoints: 1000, maxPlayers: 10,
  bets: [10, 20, 50], pairMultiplier: 2, suitedTwoMultiplier: 2, suitedThreeMultiplier: 3,
  yellowMultiplier: 3, tripleMultiplier: 5, straightMultiplier: 3, straightFlushMultiplier: 5,
};
export interface HandValue { score: number; pok: boolean; multiplier: number; special?: 'yellow' | 'triple' | 'straight' | 'straightFlush'; highCard?: number }
export function isStraight(cards: readonly Card[]): boolean {
  if (cards.length !== 3) return false;
  const ranks = cards.map(c => c.rank === 1 ? 14 : c.rank).sort((a, b) => a - b);
  return ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2];
}
export function handLabel(value: HandValue): string {
  if (value.pok) return 'ป๊อก ' + value.score;
  if (value.special === 'triple') return 'ตอง';
  if (value.special === 'yellow') return 'สามเหลือง';
  if (value.special === 'straight') return 'เรียง';
  if (value.special === 'straightFlush') return 'เรียงฟลัช';
  return value.score + ' แต้ม';
}
export function deck(): Card[] {
  return (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).flatMap(suit =>
    Array.from({ length: 13 }, (_, index) => ({ rank: index + 1, suit })));
}
// The server supplies crypto.randomInt. No Math.random in production dealing.
export function shuffle(cards: readonly Card[], randomInt: (max: number) => number): Card[] {
  const result = cards.map(card => ({ ...card }));
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error('Invalid random source');
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function evaluate(cards: readonly Card[], rules: RoomRules = DEFAULT_RULES): HandValue {
  if (cards.length !== 2 && cards.length !== 3) throw new Error('Hand must contain 2 or 3 cards');
  const score = cards.reduce((sum, card) => sum + (card.rank >= 10 ? 0 : card.rank), 0) % 10;
  const sameSuit = cards.every(card => card.suit === cards[0].suit);
  const straight = isStraight(cards);
  const special = cards.length === 3 && cards.every(c => c.rank === cards[0].rank) ? 'triple'
    : straight && sameSuit ? 'straightFlush' : straight ? 'straight'
    : cards.length === 3 && cards.every(c => c.rank >= 11 && c.rank <= 13) ? 'yellow' : undefined;
  const multiplier = Math.max(1,
    cards.length === 2 && cards[0].rank === cards[1].rank ? rules.pairMultiplier : 1,
    sameSuit ? (cards.length === 2 ? rules.suitedTwoMultiplier : rules.suitedThreeMultiplier) : 1,
    special === 'triple' ? rules.tripleMultiplier : special === 'yellow' ? rules.yellowMultiplier
      : special === 'straight' ? rules.straightMultiplier : special === 'straightFlush' ? rules.straightFlushMultiplier : 1);
  return { score, pok: cards.length === 2 && score >= 8, multiplier,
    ...(special ? { special, highCard: Math.max(...cards.map(c => c.rank === 1 ? 14 : c.rank)) } : {}) };
}
export function compare(player: HandValue, dealer: HandValue): -1 | 0 | 1 {
  if (player.pok !== dealer.pok) return player.pok ? 1 : -1;
  const priority = (value: HandValue) => value.special === 'triple' ? 4 : value.special === 'straightFlush' ? 3 : value.special === 'straight' ? 2 : value.special === 'yellow' ? 1 : 0;
  if (priority(player) !== priority(dealer)) return priority(player) > priority(dealer) ? 1 : -1;
  if (player.special && dealer.special) return player.highCard === dealer.highCard ? 0 : (player.highCard ?? 0) > (dealer.highCard ?? 0) ? 1 : -1;
  return player.score === dealer.score ? 0 : player.score > dealer.score ? 1 : -1;
}
// Ordinary player three-card 8/9 pushes against a dealer special. The dealer's
// ordinary three-card 8/9 keeps its existing priority over player specials.
export function compareWithDealer(player: HandValue, dealer: HandValue, dealerCardCount: number): -1 | 0 | 1 {
  if (dealerCardCount === 3 && dealer.special && !player.special && !player.pok && player.score >= 8) return 0;
  if (dealerCardCount === 3 && dealer.score >= 8 && !dealer.special) {
    if (player.special) return -1;
    return player.score === dealer.score ? 0 : player.score > dealer.score ? 1 : -1;
  }
  return compare(player, dealer);
}
export interface PlayerView extends RoundMembership {
  id: string; name: string; seat: number; points: number; bet: number;
  isBot: boolean;
  ready: boolean; connected: boolean; acted: boolean; cardCount: number;
}
export interface Result extends HandValue {
  id: string; cards: Card[]; outcome: 'WIN' | 'LOSE' | 'TIE' | 'DEALER'; delta: number;
  caught?: boolean; catchRecompared?: boolean; dealerCards?: Card[]; dealerValue?: HandValue;
}
export interface RevealedHand extends HandValue { id: string; cards: Card[] }
export interface RoundLedger { roundId: number; entries: Record<string, number> }
export function makeLedger(roundId: number, dealerId: string,
  hands: Record<string, Card[]>, bets: Record<string, number>, rules = DEFAULT_RULES,
  caughtDealerHands: Record<string, Card[]> = {}): { ledger: RoundLedger; results: Result[] } {
  const dealer = evaluate(hands[dealerId], rules);
  // Every caught match is recalculated from the dealer's final three-card hand.
  const recompareCatches = hands[dealerId].length === 3;
  const entries: Record<string, number> = { [dealerId]: 0 };
  const results: Result[] = [];
  for (const [id, cards] of Object.entries(hands)) {
    if (id === dealerId) continue;
    const value = evaluate(cards, rules);
    const caughtCards = caughtDealerHands[id];
    if (caughtCards && (caughtCards.length !== 2 || cards.length !== 3)) throw new Error('Catch requires two dealer cards and three player cards');
    const opponentCards = caughtCards && !recompareCatches ? caughtCards : hands[dealerId];
    const opponent = caughtCards && !recompareCatches ? evaluate(caughtCards, rules) : dealer;
    const outcome = compareWithDealer(value, opponent, opponentCards.length);
    const bet = bets[id];
    if (!Number.isInteger(bet) || bet <= 0) throw new Error('Invalid bet');
    const delta = outcome === 0 ? 0 : outcome * bet * (outcome > 0 ? value.multiplier : opponent.multiplier);
    entries[id] = delta;
    entries[dealerId] -= delta;
    results.push({ id, cards: cards.map(c => ({ ...c })), ...value, outcome: outcome > 0 ? 'WIN' : outcome < 0 ? 'LOSE' : 'TIE', delta,
      ...(caughtCards ? { caught: true, ...(recompareCatches ? { catchRecompared: true } : {}), dealerCards: opponentCards.map(c => ({ ...c })), dealerValue: { ...opponent } } : {}) });
  }
  results.push({ id: dealerId, cards: [...hands[dealerId]], ...dealer, outcome: 'DEALER', delta: entries[dealerId] });
  return { ledger: { roundId, entries }, results };
}
export function applyLedger(balances: Record<string, number>, ledger: RoundLedger,
  settled: Set<number>): Record<string, number> {
  if (settled.has(ledger.roundId)) return { ...balances };
  if (Object.values(ledger.entries).reduce((a, b) => a + b, 0) !== 0) throw new Error('Unbalanced ledger');
  const next = { ...balances };
  for (const [id, delta] of Object.entries(ledger.entries)) {
    if (!Number.isInteger(next[id]) || !Number.isInteger(delta) || next[id] + delta < 0) throw new Error('Invalid balance');
    next[id] += delta;
  }
  settled.add(ledger.roundId);
  return next;
}
export interface Snapshot {
  code: string; phase: Phase; roundId: number; deadline: number;
  hostId: string; dealerId: string; players: PlayerView[];
  results: Result[]; rules: RoomRules; settled: boolean;
  catches: Result[];
  revealedHands: RevealedHand[];
}
export type ActionType = 'setReady' | 'setBet' | 'selectDealer' | 'startRound' | 'prepareRound' | 'stand' | 'draw' | 'catch' | 'resetTablePoints' | 'addBot' | 'removeBot';
export interface Action { actionId: string; roundId: number; type: ActionType; value?: boolean | number | string }
