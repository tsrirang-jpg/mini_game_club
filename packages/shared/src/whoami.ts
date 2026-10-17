export const WHO_QUESTION_ROUNDS = [4, 6, 8, 10] as const;
export const WHO_GAME_ROUNDS = [3, 5, 7, 10] as const;
export const WHO_TURN_MINUTES = [1, 2, 3] as const;
export const WHO_CATEGORIES = [
  { value: 'mixed', label: 'รวมทุกหมวด' },
  { value: 'animals', label: 'สัตว์' },
  { value: 'jobs', label: 'อาชีพ' },
  { value: 'objects', label: 'สิ่งของ' },
] as const;
export type WhoCategory = typeof WHO_CATEGORIES[number]['value'];
export interface WhoSettings {
  category: WhoCategory; turnMinutes: number; questionRounds: number; gameRounds: number;
}
export const WHO_DEFAULT_SETTINGS: WhoSettings = { category: 'mixed', turnMinutes: 1, questionRounds: 4, gameRounds: 3 };
export type WhoPhase = 'LOBBY' | 'PLAYING' | 'GAME_END' | 'RESULTS';
export type WhoAnswer = 'yes' | 'no' | 'unknown';
export const WHO_ANSWER_LABELS: Record<WhoAnswer, string> = { yes: 'ใช่', no: 'ไม่ใช่', unknown: 'ไม่แน่ใจ' };
export type WhoAction = 'setReady' | 'setSettings' | 'startRound' | 'ask' | 'answer' | 'guess' | 'endTurn' | 'nextGame' | 'prepareRound';
export interface WhoPlayer {
  id: string; name: string; seat: number; connected: boolean; ready: boolean; score: number; solved: boolean;
}
export interface WhoIdentity { playerId: string; word: string; icon: string }
export interface WhoPrivate {
  roundId: number; turnNumber: number; identities: WhoIdentity[]; ownAnswer: WhoAnswer | null;
}
export interface WhoQuestion {
  id: number; turnNumber: number; playerId: string; name: string; text: string;
  answer: WhoAnswer | null; counts: Record<WhoAnswer, number> | null; respondedIds: string[];
}
export interface WhoGuess { playerId: string; name: string; text: string; correct: boolean; turnNumber: number }
export interface WhoGameResult {
  gameNumber: number; reason: 'all_solved' | 'round_limit' | 'not_enough_players';
  identities: (WhoIdentity & { name: string; solved: boolean; score: number })[];
}
export interface WhoSnapshot extends WhoSettings {
  game: 'whoami'; code: string; phase: WhoPhase; roundId: number; hostId: string;
  gameNumber: number; questionRound: number; turnId: string; turnNumber: number;
  deadline: number; turnDurationMs: number; players: WhoPlayer[];
  question: WhoQuestion | null; history: WhoQuestion[]; lastGuess: WhoGuess | null;
  result: WhoGameResult | null;
}
