export type PokerBotStyle = 'balanced' | 'curious' | 'pressure' | 'tricky';
/** Stable, public-seat based personalities; never derived from the real deck. */
export interface PokerBotTuning {
  callTolerance: number; openingAdjustment: number; aggression: number; bluffMultiplier: number;
}
const styles: Record<PokerBotStyle, PokerBotTuning> = {
  balanced: {callTolerance:.005, openingAdjustment:0, aggression:.86, bluffMultiplier:1},
  curious:  {callTolerance:.035, openingAdjustment:-.025, aggression:.76, bluffMultiplier:.8},
  pressure: {callTolerance:.015, openingAdjustment:-.025, aggression:.94, bluffMultiplier:1.3},
  tricky:   {callTolerance:.02, openingAdjustment:-.015, aggression:.84, bluffMultiplier:1.6},
};
export function pokerBotTuning(seat: number, style?: PokerBotStyle) {
  return styles[style ?? (['balanced','curious','pressure','tricky'] as const)[seat % 4]];
}
