/** A reserved seat that joins gameplay only at the next round boundary. */
export interface RoundMembership { waiting?: boolean }
export interface RoomMember extends RoundMembership { id: string; name: string; connected: boolean }
export function isBetweenRounds(phase: string) {
  return ['LOBBY', 'ROUND_END', 'RESULTS', 'GAME_END'].includes(phase);
}
export function joinMembership(phase: string): RoundMembership {
  return isBetweenRounds(phase) ? {} : { waiting: true };
}
export function canActInRound(player: RoundMembership | undefined, phase: string) {
  return !player?.waiting || isBetweenRounds(phase);
}
export function admitWaitingPlayers(players: Iterable<RoundMembership>) {
  for (const player of players) delete player.waiting;
}
