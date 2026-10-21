import { describe, expect, it } from 'vitest';
import { analyzePokerBot, choosePokerBotAction, pokerStartingStrength } from '../apps/server/src/poker-bot';
import type { PokerBotOptions, PokerBotView } from '../apps/server/src/poker-bot';
import type { Card, Suit } from '../packages/shared/src/index';
import type { PokerPlayer } from '../packages/shared/src/poker';

const c = (rank: number, suit: Suit = 'clubs'): Card => ({ rank, suit });
const player = (id: string, seat: number, changes: Partial<PokerPlayer> = {}): PokerPlayer => ({
  id, seat, name: id, points: 1000, isBot: true, connected: true, ready: false,
  folded: false, allIn: false, inHand: true, streetBet: 0, contribution: 100,
  lastAction: '', reconnectUntil: 0, ...changes,
});
function view(): PokerBotView {
  return { heroId: 'hero', hole: [c(1, 'hearts'), c(13, 'hearts')], history: [],
    snapshot: { phase: 'RIVER', roundId: 1, buttonId: 'hero', smallBlindId: 'a', bigBlindId: 'b',
      currentBet: 0, minRaise: 20, bigBlind: 20, raiseAllowedIds: ['hero', 'a', 'b'],
      board: [c(12, 'hearts'), c(11, 'hearts'), c(10, 'hearts'), c(2), c(3, 'diamonds')],
      players: [player('hero', 0), player('a', 1), player('b', 2)] } };
}
function rng(seed = 42) {
  let state = seed >>> 0;
  return (max: number) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor(state / 0x100000000 * max); };
}
const options = (seed = 42, changes: Partial<PokerBotOptions> = {}): PokerBotOptions => ({ random: rng(seed), iterations: 48, yieldControl: async () => {}, ...changes });
function freeze(value: unknown) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
}

describe('Poker bot information, equity and scheduling', () => {
  it('uses the shared best-five evaluator and accounts for split-pot equity', async () => {
    const v = view(); v.snapshot.board = [c(1), c(13), c(12), c(11), c(10)]; v.hole = [c(2, 'hearts'), c(3, 'hearts')];
    const a = await analyzePokerBot(v, options());
    expect(a.equity).toBeCloseTo(1 / 3); expect(a.showdownEquity).toBeCloseTo(1 / 3);
    expect(a.tieRate).toBe(1); expect(a.winRate).toBe(0);
    expect(await choosePokerBotAction(v, options())).toEqual({ type: 'check' });
  });
  it('recognizes private nuts, value-bets rather than always checking, and never mutates its view', async () => {
    const v = view(); const before = JSON.stringify(v); freeze(v);
    const a = await analyzePokerBot(v, options()); expect(a.equity).toBe(1); expect(a.winRate).toBe(1);
    const decision = await choosePokerBotAction(v, options()); expect(['raise', 'allIn']).toContain(decision.type);
    expect(JSON.stringify(v)).toBe(before);
  });
  it('does not inspect extra hidden properties or opponents actual cards, even if callers attach them', async () => {
    const v = view();
    for (const target of [v, v.snapshot, ...v.snapshot.players]) for (const name of ['stock', 'hands', 'cards', 'results']) {
      Object.defineProperty(target, name, { get() { throw new Error('Hidden information accessed'); } });
    }
    expect((await analyzePokerBot(v, options())).equity).toBe(1);
  });
  it('prices only the main pot and side pots this short stack can win', async () => {
    const v = view(); v.snapshot.currentBet = 500;
    v.snapshot.players = [player('hero', 0, { contribution: 0, points: 50 }),
      player('a', 1, { contribution: 500, streetBet: 500, points: 0, allIn: true }),
      player('b', 2, { contribution: 500, streetBet: 500, points: 0, allIn: true }),
      player('dead', 3, { contribution: 500, points: 0, folded: true })];
    const a = await analyzePokerBot(v, options());
    expect(a.callCost).toBe(50); expect(a.contestablePot).toBe(200); expect(a.potOdds).toBe(.25); expect(a.equity).toBe(1);
    expect(await choosePokerBotAction(v, options())).toEqual({ type: 'call' });
  });
  it('excludes an uncalled hero overbet from the contestable pot', async () => {
    const v = view(); v.snapshot.players = [player('hero', 0, { contribution: 200 }),
      player('a', 1, { contribution: 100, points: 0, allIn: true })];
    const a = await analyzePokerBot(v, options()); expect(a.contestablePot).toBe(200); expect(a.equity).toBe(1);
  });
  it('narrows equity estimates against public repeated preflop raises', async () => {
    const v = view(); v.snapshot.phase = 'PREFLOP'; v.snapshot.board = []; v.hole = [c(12), c(12, 'diamonds')];
    v.snapshot.players = [player('hero', 0), player('a', 1)]; v.snapshot.currentBet = 100;
    v.snapshot.players[1].streetBet = 100;
    const loose = await analyzePokerBot(v, options(12, { iterations: 256 }));
    v.history = Array.from({ length: 3 }, (_, i) => ({ id: 'a', phase: 'PREFLOP' as const, type: 'raise' as const, paid: 80, to: 100 + i * 100, potBefore: 300 }));
    const tight = await analyzePokerBot(v, options(12, { iterations: 256 }));
    expect(tight.showdownEquity).toBeLessThan(loose.showdownEquity);
  });
  it('preserves tight combined ranges instead of substituting uniformly random trash after sampling failures', async () => {
    const v = view(); v.hole = [c(12), c(12, 'diamonds')];
    v.snapshot.board = [c(1, 'hearts'), c(13, 'hearts'), c(7, 'diamonds'), c(4, 'spades'), c(2, 'hearts')];
    v.snapshot.players = [player('hero', 0, { contribution: 400 }),
      player('a', 1, { contribution: 1200, streetBet: 800, points: 200, lastAction: 'Raise' })];
    v.snapshot.currentBet = 800; v.snapshot.minRaise = 800;
    v.history = [...Array.from({ length: 4 }, (_, i) => ({ id: 'a', phase: 'PREFLOP' as const,
      type: 'raise' as const, paid: 100, to: 100 + i * 100, potBefore: 200 })),
      { id: 'a', phase: 'RIVER', type: 'raise', paid: 800, to: 800, potBefore: 800 }];
    // Exhaustive weighting over all 990 remaining hole-card pairs gives 14.610813%.
    for (const seed of [1, 11, 91]) {
      const a = await analyzePokerBot(v, options(seed, { iterations: 512 }));
      expect(a.equity).toBeGreaterThan(.086); expect(a.equity).toBeLessThan(.206);
      expect(a.potOdds).toBeCloseTo(1 / 3);
      expect(await choosePokerBotAction(v, options(seed))).toEqual({ type: 'fold' });
    }
  });
  it('conditions weighted ranges on cards already drawn without duplicating cards or a uniform fallback', async () => {
    const v = view(); v.snapshot.players.push(player('c', 3), player('d', 4), player('e', 5));
    v.history = v.snapshot.players.slice(1).map(p => ({ id: p.id, phase: 'PREFLOP', type: 'raise', paid: 100, to: 100, potBefore: 300 }));
    // Always selects the same first CDF pair, forcing subsequent opponents into the exact conditional fallback.
    const a = await analyzePokerBot(v, options(1, { random: () => 0 }));
    expect(a.equity).toBe(1); expect(a.winRate).toBe(1);
  });
  it('can cancel while preparing weighted opponent ranges before any trial runs', async () => {
    const v = view(); v.history = [{ id: 'a', phase: 'PREFLOP', type: 'raise', paid: 100, to: 100, potBefore: 300 }];
    const controller = new AbortController(); let draws = 0;
    await expect(analyzePokerBot(v, options(1, { signal: controller.signal, random: max => { draws++; return 0; },
      yieldControl: async () => { controller.abort(); } }))).rejects.toMatchObject({ name: 'AbortError' });
    expect(draws).toBe(0);
  });
  it('yields during the bounded computation and cancels stale work without a decision', async () => {
    const controller = new AbortController(); let yields = 0;
    await expect(choosePokerBotAction(view(), options(42, { signal: controller.signal, yieldEvery: 2,
      yieldControl: async () => { yields++; controller.abort(); } }))).rejects.toMatchObject({ name: 'AbortError' });
    expect(yields).toBe(1);
  });
  it('rejects a signal already cancelled before consuming strategy randomness', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(choosePokerBotAction(view(), { random() { throw new Error('Should not draw'); }, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('is reproducible with an independent seeded RNG and has a hard simulation bound', async () => {
    const a = await choosePokerBotAction(view(), options(91)); const b = await choosePokerBotAction(view(), options(91)); expect(a).toEqual(b);
    expect((await analyzePokerBot(view(), options(1, { iterations: 0 }))).samples).toBe(16);
  });
  it('rejects an invalid RNG and duplicate known cards', async () => {
    await expect(analyzePokerBot(view(), options(1, { random: max => max }))).rejects.toThrow('Invalid poker strategy');
    const v = view(); v.hole = [v.snapshot.board[0], c(9)]; await expect(analyzePokerBot(v, options())).rejects.toThrow('Duplicate');
  });
});

describe('Poker bot betting strategy and legal actions', () => {
  it('respects a locked raise after a short all-in, including when holding the nuts', async () => {
    const v = view(); v.snapshot.raiseAllowedIds = []; v.snapshot.currentBet = 40;
    v.snapshot.players[1].streetBet = 40; v.snapshot.players[1].contribution = 140;
    expect(await choosePokerBotAction(v, options())).toEqual({ type: 'call' });
  });
  it('never raises into opponents who are all-in even if a stale allowed list says it can', async () => {
    const v = view(); for (const p of v.snapshot.players.slice(1)) { p.allIn = true; p.points = 0; }
    expect(await choosePokerBotAction(v, options())).toEqual({ type: 'check' });
  });
  it('uses only an all-in for a below-minimum short raise', async () => {
    const v = view(); v.snapshot.currentBet = 20; v.snapshot.players[0].points = 25;
    v.snapshot.players[1].streetBet = 20; v.snapshot.players[1].contribution = 120;
    expect(await choosePokerBotAction(v, options())).toEqual({ type: 'allIn' });
  });
  it('can put in a full minimum raise exactly at the stack boundary', async () => {
    const v = view(); v.snapshot.currentBet = 20; v.snapshot.players[0].points = 40;
    v.snapshot.players[1].streetBet = 20; v.snapshot.players[1].contribution = 120;
    expect(await choosePokerBotAction(v, options())).toEqual({ type: 'allIn' });
  });
  it('folds a weak river hand to a large bet instead of calling simply because a face card exists', async () => {
    const v = view(); v.hole = [c(3), c(4, 'spades')]; v.snapshot.board = [c(1, 'hearts'), c(13, 'hearts'), c(12, 'hearts'), c(11, 'hearts'), c(2, 'diamonds')];
    v.snapshot.currentBet = 800; v.snapshot.players[1].streetBet = 800; v.snapshot.players[1].contribution = 900; v.snapshot.players[1].points = 200;
    v.snapshot.players[1].lastAction = 'Raise';
    v.history = [{ id: 'a', phase: 'RIVER', type: 'raise', paid: 800, to: 800, potBefore: 300 }];
    expect(await choosePokerBotAction(v, options())).toEqual({ type: 'fold' });
  });
  it('continues a strong draw when the pot price is cheap', async () => {
    const v = view(); v.snapshot.phase = 'FLOP'; v.snapshot.board = [c(2, 'hearts'), c(7, 'hearts'), c(12)]; v.snapshot.currentBet = 20;
    v.snapshot.players[1].streetBet = 20; v.snapshot.players[1].contribution = 120;
    const a = await analyzePokerBot(v, options()); expect(a.drawStrength).toBeGreaterThan(.7); expect(a.potOdds).toBeLessThan(.1);
    expect((await choosePokerBotAction(v, options())).type).not.toBe('fold');
  });
  it('opens premium starting hands and releases trash in early position', async () => {
    const v = view(); v.snapshot.phase = 'PREFLOP'; v.snapshot.board = []; v.hole = [c(1), c(1, 'diamonds')];
    v.snapshot.currentBet = 20; v.snapshot.players.forEach((p, i) => { p.contribution = p.streetBet = i === 1 ? 10 : i === 2 ? 20 : 0; });
    expect(['raise', 'allIn']).toContain((await choosePokerBotAction(v, options())).type);
    v.hole = [c(7), c(2, 'diamonds')]; v.snapshot.buttonId = 'b';
    expect(await choosePokerBotAction(v, options())).toEqual({ type: 'fold' });
  });
  it('never folds pocket aces to unopened blinds or a raise in a six-way game', async () => {
    for (const seed of [1, 11, 91]) {
      const v = view(); v.snapshot.phase = 'PREFLOP'; v.snapshot.board = []; v.hole = [c(1), c(1, 'diamonds')];
      v.snapshot.players = ['hero', 'a', 'b', 'c', 'd', 'e'].map((id, i) => player(id, i, { contribution: 0 }));
      v.snapshot.currentBet = 20; v.snapshot.players[1].contribution = v.snapshot.players[1].streetBet = 10;
      v.snapshot.players[2].contribution = v.snapshot.players[2].streetBet = 20;
      expect((await choosePokerBotAction(v, options(seed))).type).not.toBe('fold');
      v.snapshot.currentBet = 600; v.snapshot.players[2].contribution = v.snapshot.players[2].streetBet = 600;
      expect((await choosePokerBotAction(v, options(seed))).type).not.toBe('fold');
    }
  });
  it('only emits a legal bet at varying stack sizes and minimum raises', async () => {
    for (const points of [1, 19, 20, 39, 40, 41, 1000]) {
      const v = view(); v.snapshot.players[0].points = points; v.snapshot.currentBet = 20;
      v.snapshot.players[1].contribution += 20; v.snapshot.players[1].streetBet = 20;
      const d = await choosePokerBotAction(v, options(points));
      expect(['call', 'raise', 'allIn']).toContain(d.type);
      if (d.type === 'raise') { expect(d.value).toBeGreaterThanOrEqual(40); expect(d.value).toBeLessThanOrEqual(points); }
      if (d.type === 'allIn') expect(points).toBeGreaterThan(20);
    }
  });
  it('values position, suited connectivity, pairs and broadway without treating every face card as strong', async () => {
    expect(pokerStartingStrength([c(1), c(1, 'diamonds')])).toBeGreaterThan(pokerStartingStrength([c(13), c(13, 'diamonds')]));
    expect(pokerStartingStrength([c(10), c(9)])).toBeGreaterThan(pokerStartingStrength([c(13), c(2, 'diamonds')]));
    const v = view(); expect((await analyzePokerBot(v, options())).position).toBe(1);
    v.snapshot.buttonId = 'b'; expect((await analyzePokerBot(v, options())).position).toBe(0);
  });
});
