import type { RoundMembership } from './room.js';
import type { Card } from './index.js';

export type OldMaidPhase = 'LOBBY' | 'PLAYING' | 'RESULTS';
export type OldMaidAction = 'setReady' | 'startRound' | 'draw' | 'prepareRound' | 'addBot' | 'removeBot';
export interface OldMaidPlayer extends RoundMembership {
  id: string; name: string; seat: number; connected: boolean; ready: boolean;
  cardCount: number; finished: boolean; wins: number; isBot: boolean;
}
export interface OldMaidResult { loserId: string; lastCard: Card; removedCard: Card; winners: string[] }
export interface OldMaidActivity {
  id: number; turnNumber: number; playerId: string; playerName: string;
  kind: 'deal' | 'draw'; targetId?: string; targetName?: string; pair: Card[];
}
export interface OldMaidDraw extends OldMaidActivity { drawnCard: Card }
export interface OldMaidPrivateState { roundId: number; draws: OldMaidDraw[] }
export interface OldMaidHandMessage { roundId: number; cards: Card[]; oldMaid: OldMaidPrivateState }
export interface OldMaidSnapshot {
  game: 'oldmaid'; code: string; roundId: number; phase: OldMaidPhase; hostId: string;
  players: OldMaidPlayer[]; turnId: string | null; targetId: string | null;
  turnNumber: number; deadline: number; turnDurationMs: number; discardedPairs: number;
  lastPair: Card[]; lastAction: { playerId: string; targetId: string; paired: boolean } | null;
  history: OldMaidActivity[];
  result: OldMaidResult | null;
}
export const OLD_MAID_MIN_PLAYERS = 3;
export const OLD_MAID_MAX_PLAYERS = 8;
export const OLD_MAID_TURN_MS = 30_000;
