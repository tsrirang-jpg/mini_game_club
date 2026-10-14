export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export interface Card { rank: number; suit: Suit }
export type Phase = 'LOBBY' | 'DEALING' | 'PLAYER_ACTIONS' | 'DEALER_ACTION' | 'REVEAL' | 'SETTLEMENT' | 'ROUND_END';
export interface RoomRules {
  actionMs: number; dealMs: number; revealMs: number; settlementMs: number;
  reconnectSeconds: number; initialPoints: number; maxPlayers: number;
  bets: readonly number[]; pairMultiplier: number; suitedTwoMultiplier: number; suitedThreeMultiplier: number;
}
export const DEFAULT_RULES: RoomRules = {
  actionMs: 20_000, dealMs: 900, revealMs: 1800, settlementMs: 500,
  reconnectSeconds: 60, initialPoints: 1000, maxPlayers: 6,
  bets: [10, 20, 50], pairMultiplier: 2, suitedTwoMultiplier: 2, suitedThreeMultiplier: 3,
};
export interface HandValue { score: number; pok: boolean; multiplier: number }
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
  const multiplier = Math.max(1,
    cards.length === 2 && cards[0].rank === cards[1].rank ? rules.pairMultiplier : 1,
    sameSuit ? (cards.length === 2 ? rules.suitedTwoMultiplier : rules.suitedThreeMultiplier) : 1);
  return { score, pok: cards.length === 2 && score >= 8, multiplier };
}
export function compare(player: HandValue, dealer: HandValue): -1 | 0 | 1 {
  if (player.pok !== dealer.pok) return player.pok ? 1 : -1;
  return player.score === dealer.score ? 0 : player.score > dealer.score ? 1 : -1;
}
export interface PlayerView {
  id: string; name: string; seat: number; points: number; bet: number;
  isBot: boolean;
  ready: boolean; connected: boolean; acted: boolean; cardCount: number;
}
export interface Result extends HandValue {
  id: string; cards: Card[]; outcome: 'WIN' | 'LOSE' | 'TIE' | 'DEALER'; delta: number;
}
export interface RoundLedger { roundId: number; entries: Record<string, number> }
export function makeLedger(roundId: number, dealerId: string,
  hands: Record<string, Card[]>, bets: Record<string, number>, rules = DEFAULT_RULES): { ledger: RoundLedger; results: Result[] } {
  const dealer = evaluate(hands[dealerId], rules);
  const entries: Record<string, number> = { [dealerId]: 0 };
  const results: Result[] = [];
  for (const [id, cards] of Object.entries(hands)) {
    if (id === dealerId) continue;
    const value = evaluate(cards, rules);
    const outcome = compare(value, dealer);
    const bet = bets[id];
    if (!Number.isInteger(bet) || bet <= 0) throw new Error('Invalid bet');
    const delta = outcome === 0 ? 0 : outcome * bet * (outcome > 0 ? value.multiplier : dealer.multiplier);
    entries[id] = delta;
    entries[dealerId] -= delta;
    results.push({ id, cards: [...cards], ...value, outcome: outcome > 0 ? 'WIN' : outcome < 0 ? 'LOSE' : 'TIE', delta });
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
}
export type ActionType = 'setReady' | 'setBet' | 'selectDealer' | 'startRound' | 'prepareRound' | 'stand' | 'draw' | 'resetTablePoints' | 'addBot' | 'removeBot';
export interface Action { actionId: string; roundId: number; type: ActionType; value?: boolean | number | string }
