export type SpyPhase = 'LOBBY' | 'QUESTION' | 'VOTING' | 'GUESS' | 'RESULTS';
export type SpyAction = 'setReady' | 'setQuestionMinutes' | 'setVotingMinutes' | 'setGuessMinutes' | 'setPlayerCount' | 'startRound' | 'readyVote' | 'vote' | 'guess' | 'surrender' | 'chat' | 'prepareRound';
export interface SpySettings { questionMinutes: number; votingMinutes: number; guessMinutes: number; playerCount: number }
export type SpySettingKey = keyof SpySettings;
export interface SpyPlayer {
  id: string; name: string; seat: number; connected: boolean; ready: boolean;
  readyVote: boolean; hasVoted: boolean; score: number;
}
export interface SpyRole {
  kind: 'spy' | 'citizen'; location?: string; occupation?: string; ownVote: string | null;
}
export interface SpySecret { roundId: number; role: SpyRole | null }
export interface ChatMessage { id: string; playerId: string; name: string; text: string; timestamp: number; roundId: number }
export interface SpyResult {
  winner: 'spy' | 'citizens'; reason: 'correct_guess' | 'wrong_guess' | 'guess_timeout' | 'spy_surrendered' | 'wrong_accusation' | 'no_majority';
  spyId: string; location: string; guess: string; accusedId: string | null;
  votes: Record<string, string | null>; tally: Record<string, number>;
}
export interface SpySnapshot extends SpySettings {
  game: 'spyfall'; code: string; phase: SpyPhase; roundId: number; deadline: number;
  hostId: string; phaseDurationMs: number;
  votingDurationMs: number; guessDurationMs: number; players: SpyPlayer[];
  chat: ChatMessage[]; caughtSpyId: string | null; result: SpyResult | null;
}
export const SPY_QUESTION_MINUTES = [5, 7, 10] as const;
export const SPY_TURN_MINUTES = [1, 2, 3] as const;
export const SPY_PLAYER_COUNTS = [3, 4, 5, 6, 7, 8] as const;
export const SPY_DEFAULT_SETTINGS: SpySettings = { questionMinutes: 5, votingMinutes: 1, guessMinutes: 1, playerCount: 3 };
export const SPY_VOTING_MS = 60_000;
export const SPY_GUESS_MS = 60_000;
