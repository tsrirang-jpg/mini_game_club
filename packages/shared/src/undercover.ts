export const UNDER_MIN_PLAYERS=3;
export const UNDER_MAX_PLAYERS=8;
export const UNDER_MINUTES=[1,2,3] as const;
export interface UnderSettings { turnMinutes:number; voteMinutes:number; undercoverCount:number; whiteCount:number }
export const UNDER_DEFAULT_SETTINGS:UnderSettings={turnMinutes:1,voteMinutes:1,undercoverCount:1,whiteCount:0};
export type UnderPhase='LOBBY'|'WORD'|'DESCRIBE'|'VOTING'|'GUESS'|'RESULTS';
export type UnderAction='setReady'|'setSettings'|'startRound'|'acknowledge'|'hint'|'vote'|'guess'|'surrender'|'prepareRound';
export type UnderSuspect='undercover'|'white';
export interface UnderVote { targetId:string; suspect:UnderSuspect }
export interface UnderPlayer { id:string;name:string;seat:number;connected:boolean;ready:boolean;alive:boolean;isBot:boolean }
// No role, faction, partner word or correct answer is sent in a private message.
export interface UnderSecret { roundId:number;word:string|null;canGuess:boolean;vote:UnderVote|null }
export interface UnderHint { id:number;playerId:string;name:string;cycle:number;text:string }
export interface UnderVoteResult { targetId:string|null;counts:Record<string,number>;tied:boolean }
export interface UnderResult { reason:'citizens'|'undercover'|'white_guess'|'last_white'|'not_enough_players';winnerIds:string[];words:{playerId:string;name:string;word:string|null}[];answer:string|null;guess:string|null }
export interface UnderSnapshot extends UnderSettings {
  game:'undercover';code:string;roundId:number;phase:UnderPhase;hostId:string;players:UnderPlayer[];
  cycle:number;turnId:string;turnNumber:number;deadline:number;acknowledgedIds:string[];
  describedIds:string[];submittedIds:string[];eligibleIds:string[];runoff:boolean;
  hints:UnderHint[];lastVote:UnderVoteResult|null;guesserId:string;result:UnderResult|null;
}
