import type { RoundMembership } from './room.js';
import type { Card } from './index.js';

export const LIAR_MIN_PLAYERS = 2;
export const LIAR_MAX_PLAYERS = 6;
export const LIAR_TURN_SECONDS = [15, 30, 60] as const;
export const LIAR_CHALLENGE_MS = 5_000;
export type LiarPhase = 'LOBBY' | 'PLAYING' | 'RESPONSE' | 'REVEAL' | 'RESULTS';
export type LiarAction = 'setReady' | 'startRound' | 'prepareRound' | 'addBot' | 'removeBot' | 'play' | 'skip' | 'challenge';
export interface LiarPlayer extends RoundMembership {
  id: string; name: string; seat: number; connected: boolean; ready: boolean;
  isBot: boolean; cardCount: number; finished: boolean; wins: number;
}
export interface LiarLatest {
  id: number; playerId: string; rank: number; card: Card | null;
  challengerId: string | null; truthful: boolean | null; opening: boolean;
}
export interface LiarActivity { id: number; playerId: string; text: string }
export interface LiarResult {
  reason: 'last_player' | 'all_skipped'; loserIds: string[];
  hands: { playerId: string; cards: Card[]; points: number; finished: boolean }[];
}
export interface LiarSnapshot {
  game: 'liar'; code: string; roundId: number; phase: LiarPhase; hostId: string;
  players: LiarPlayer[]; turnId: string | null; turnNumber: number; requiredRank: number;
  opening: boolean; deadline: number; turnDurationMs: number; challengeMs: number;
  skipCount: number; activeCount: number; discardedCount: number;
  latest: LiarLatest | null; history: LiarActivity[]; result: LiarResult | null;
}
export function liarPoints(cards: readonly Card[]) { return cards.reduce((sum, card) => sum + Math.min(card.rank, 10), 0); }
export function liarRank(rank: number) { return ({1: 'A', 11: 'J', 12: 'Q', 13: 'K'} as Record<number, string>)[rank] ?? String(rank); }
export function liarCardKey(card: Card) { return `${card.rank}:${card.suit}`; }
