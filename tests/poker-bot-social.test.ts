import { describe, expect, it } from 'vitest';
import { analyzePokerBot, choosePokerBotAction } from '../apps/server/src/poker-bot';
import type { PokerBotStyle } from '../apps/server/src/poker-bot-style';
import { pokerBotScenarios, seededStrategy } from './helpers/poker-bot-scenarios';

async function decisions(name: string, style?: PokerBotStyle) {
  const view = pokerBotScenarios()[name];
  const actions = [];
  for (let seed = 0; seed < 24; seed++) {
    actions.push(await choosePokerBotAction(view, {
      random: seededStrategy(700 + seed * 317), iterations: 96, style,
    }));
  }
  return actions;
}

describe('Poker bot defence against ordinary raises', () => {
  it.each(['98s-unacted-table-3bb', 'T9s-unacted-table-3bb', 'QJs-unacted-table-3bb'])(
    'continues with playable nonpremium cards: %s', async name => {
      const actions = await decisions(name);
      expect(actions.filter(action => action.type !== 'fold').length).toBeGreaterThanOrEqual(6);
      expect(actions.some(action => action.type === 'call')).toBe(true);
      expect(actions.some(action => action.type === 'allIn')).toBe(false);
    });

  it('models unacted responses without changing the real pot or public state', async () => {
    const view = pokerBotScenarios()['98s-unacted-table-3bb'];
    const before = structuredClone(view);
    const a = await analyzePokerBot(view, { random: seededStrategy(912), iterations: 128 });
    expect(a.contestablePot).toBe(150);
    expect(a.potOdds).toBe(60 / 150);
    expect(a.projectedPot).toBeGreaterThan(a.contestablePot);
    expect(a.expectedOpponents).toBeGreaterThan(1);
    expect(a.expectedOpponents).toBeLessThan(5);
    expect(a.continuationEquity).toBeGreaterThan(a.equity);
    expect(view).toEqual(before);
  });

  it('keeps players who already paid in the showdown forecast', async () => {
    const view = pokerBotScenarios()['98s-unacted-table-3bb'];
    for (const p of view.snapshot.players) {
      if (p.id === view.heroId) continue;
      p.points -= 60 - p.streetBet;
      p.streetBet = p.contribution = 60;
    }
    const a = await analyzePokerBot(view, { random: seededStrategy(912), iterations: 128 });
    expect(a.expectedOpponents).toBe(5);
    expect(a.projectedPot).toBe(a.contestablePot);
    expect(a.continuationEquity).toBeCloseTo(a.equity, 12);
  });

  it('ignores waiting players and never reads hidden cards or results', async () => {
    const view = pokerBotScenarios()['98s-big-blind-3bb'];
    const options = () => ({ random: seededStrategy(912), iterations: 96 });
    const baseline = await analyzePokerBot(view, options());
    view.snapshot.players.push({ ...view.snapshot.players[0], id: 'waiting', seat: 6, inHand: false });
    const forbidden = () => { throw new Error('Hidden information was read'); };
    for (const object of [view, view.snapshot, ...view.snapshot.players]) {
      for (const property of ['cards', 'hands', 'stock', 'results']) {
        Object.defineProperty(object, property, { get: forbidden });
      }
    }
    expect(await analyzePokerBot(view, options())).toEqual(baseline);
  });

  it.each(['72o-facing-25bb', 'air-facing-river-overbet'])(
    'still folds weak cards at a bad price: %s', async name => {
      const actions = await decisions(name);
      expect(actions.every(action => action.type === 'fold')).toBe(true);
    });

  it.each(['middle-pair-small-flop-bet', 'combo-draw-small-flop-bet'])(
    'defends a made hand or strong draw at a small price: %s', async name => {
      const actions = await decisions(name);
      expect(actions.filter(action => action.type !== 'fold').length).toBeGreaterThanOrEqual(18);
    });

  it('mixes calls and occasional reraises rather than repeating one response', async () => {
    const actions = await decisions('98s-big-blind-3bb');
    expect(actions.some(action => action.type === 'call')).toBe(true);
    expect(actions.some(action => action.type === 'raise')).toBe(true);
    expect(actions.some(action => action.type === 'allIn')).toBe(false);
  });

  it('gives a curious bot wider defence than a balanced bot under the same samples', async () => {
    const balanced = await decisions('98s-unacted-table-3bb', 'balanced');
    const curious = await decisions('98s-unacted-table-3bb', 'curious');
    const count = (actions: typeof balanced) => actions.filter(action => action.type !== 'fold').length;
    expect(count(curious)).toBeGreaterThan(count(balanced));
  });
});
