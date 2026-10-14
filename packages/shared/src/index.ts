export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export interface Card { rank: number; suit: Suit }
export type Phase = 'LOBBY' | 'DEALING' | 'PLAYER_ACTIONS' | 'DEALER_ACTION' | 'REVEAL' | 'SETTLEMENT' | 'ROUND_END';
export interface RoomRules {
  actionMs: number; dealMs: number; revealMs: number; settlementMs: number;
  reconnectSeconds: number; initialPoints: number; maxPlayers: number;
  bets: readonly number[]; pairMultiplier: number; suitedTwoMultiplier: number;
  tripsMultiplier: number; facesMultiplier: number; straightMultiplier: number;
}
export const DEFAULT_RULES: RoomRules = {
  actionMs: 20_000, dealMs: 900, revealMs: 1800, settlementMs: 500,
  reconnectSeconds: 60, initialPoints: 1000, maxPlayers: 6,
  bets: [10, 20, 50], pairMultiplier: 2, suitedTwoMultiplier: 3,
  tripsMultiplier: 5, facesMultiplier: 5, straightMultiplier: 3,
};
export type PokHandType = 'NORMAL' | 'PAIR' | 'SUITED' | 'STRAIGHT' | 'FACES' | 'TRIPS' | 'POK8' | 'POK9';
export interface HandValue { score: number; pok: boolean; multiplier: number; handType: PokHandType; handName: string }
const handOrder: Record<PokHandType, number> = { NORMAL: 0, PAIR: 1, SUITED: 2, STRAIGHT: 3, FACES: 4, TRIPS: 5, POK8: 6, POK9: 7 };
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
  const ranks = cards.map(c => c.rank).sort((a, b) => a - b);
  const pair = cards.length === 2 && ranks[0] === ranks[1];
  const trips = cards.length === 3 && ranks[0] === ranks[2];
  const faces = cards.length === 3 && ranks.every(rank => rank >= 11);
  // Ace is low (A-2-3) or high (Q-K-A), never a wrap such as K-A-2.
  const straight = cards.length === 3 && ((ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1) || (ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13));
  const suited = cards.length === 2 && sameSuit;
  const pok = cards.length === 2 && score >= 8;
  const handType: PokHandType = pok ? score === 9 ? 'POK9' : 'POK8' : trips ? 'TRIPS' : faces ? 'FACES' : straight ? 'STRAIGHT' : suited ? 'SUITED' : pair ? 'PAIR' : 'NORMAL';
  const names: Record<PokHandType, string> = { NORMAL: 'มือธรรมดา', PAIR: 'ไพ่คู่', SUITED: 'ดอกเดียวกัน', STRAIGHT: 'สามใบเรียง', FACES: 'สามใบหน้า', TRIPS: 'ตอง', POK8: 'ป๊อก 8', POK9: 'ป๊อก 9' };
  const multiplier = Math.max(1, pair ? rules.pairMultiplier : 1, suited ? rules.suitedTwoMultiplier : 1,
    trips ? rules.tripsMultiplier : 1, faces ? rules.facesMultiplier : 1, straight ? rules.straightMultiplier : 1);
  return { score, pok, multiplier, handType, handName: names[handType] };
}
export function compare(player: HandValue, dealer: HandValue): -1 | 0 | 1 {
  if (player.handType !== dealer.handType) return handOrder[player.handType] > handOrder[dealer.handType] ? 1 : -1;
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
