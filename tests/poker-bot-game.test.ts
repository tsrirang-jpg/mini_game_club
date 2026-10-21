import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokerGame } from '../apps/server/src/poker-game';
import { choosePokerBotAction } from '../apps/server/src/poker-bot';
import type { Card } from '../packages/shared/src/index';
import type { PokerSnapshot } from '../packages/shared/src/poker';

type Decide = typeof choosePokerBotAction;
type Decision = Awaited<ReturnType<Decide>>;
const activePhases = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
const games: PokerGame[] = [];
let serial = 0;

function seeded(seed: number) {
  return (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function create(decide?: Decide, options: { seed?: number; turn?: number; random?: (max: number) => number } = {}) {
  const hands: Record<string, Card[]> = {};
  const changed = vi.fn();
  const dealRandom = vi.fn(seeded(options.seed ?? 71));
  const g = new PokerGame('BOTTEST', {
    changed,
    privateHand(id, cards) { hands[id] = cards.map(card => ({ ...card })); },
  }, dealRandom, { deal: 5, turn: options.turn ?? 1000, reveal: 5, bot: 25 }, 8000,
  { ...(decide ? { decide } : {}), random: options.random ?? seeded(991) });
  games.push(g);
  g.add('Human', 'human');
  g.add('Bot', 'bot', true);
  return { g, hands, changed, dealRandom };
}
function act(g: PokerGame, id: string, type: string, value?: unknown) {
  g.action(id, { type, value, roundId: g.roundId, actionId: 'bot-integration-' + ++serial });
}
async function start(g: PokerGame) {
  for (const player of g.players.values()) {
    if (!player.isBot && player.id !== g.hostId) act(g, player.id, 'setReady', true);
  }
  act(g, g.hostId, 'startRound');
  await vi.advanceTimersByTimeAsync(5);
}
async function botActs() { await vi.advanceTimersByTimeAsync(25); }
async function flush() { for (let i = 0; i < 4; i++) await Promise.resolve(); }
function chips(g: PokerGame) { return [...g.players.values()].reduce((sum, player) => sum + player.points, 0); }
function assertConserved(snapshot: PokerSnapshot, total: number) {
  const settled = snapshot.phase === 'SHOWDOWN' || snapshot.phase === 'ROUND_END';
  const wealth = snapshot.players.reduce((sum, player) => sum + player.points + (settled ? 0 : player.contribution), 0);
  expect(wealth).toBe(total);
  expect(snapshot.players.every(player => Number.isSafeInteger(player.points) && player.points >= 0)).toBe(true);
  expect(snapshot.players.every(player => player.streetBet >= 0 && player.contribution >= player.streetBet)).toBe(true);
}
async function finish(g: PokerGame, total: number, humanAllIn = false) {
  for (let step = 0; step < 1500 && g.phase !== 'ROUND_END'; step++) {
    assertConserved(g.snapshot(), total);
    if (g.turnId === 'human' && activePhases.includes(g.phase)) {
      const human = g.players.get('human')!;
      const canRaise = g.snapshot().raiseAllowedIds.includes(human.id);
      act(g, human.id, humanAllIn && canRaise ? 'allIn' : human.streetBet < g.currentBet ? 'call' : 'check');
    } else await vi.advanceTimersByTimeAsync(25);
  }
  expect(g.phase).toBe('ROUND_END');
  expect(chips(g)).toBe(total);
  expect(g.snapshot().results.reduce((sum, result) => sum + result.delta, 0)).toBe(0);
  expect(g.snapshot().results.reduce((sum, result) => sum + result.payout, 0)).toBe(g.snapshot().pot);
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { for (const game of games.splice(0)) game.dispose(); vi.useRealTimers(); });

describe('Poker bot integration with the betting state machine', () => {
  it('applies a legal raise through normal rules and returns action to the human', async () => {
    const decide = vi.fn<Decide>(async () => ({ type: 'raise', value: 60 }));
    const { g } = create(decide);
    await start(g);
    act(g, 'human', 'call');
    await botActs();
    expect(decide).toHaveBeenCalledTimes(1);
    expect(g.currentBet).toBe(60);
    expect(g.minRaise).toBe(40);
    expect(g.players.get('bot')!.lastAction).toBe('Raise');
    expect(g.players.get('bot')!.points).toBe(940);
    expect(g.turnId).toBe('human');
    assertConserved(g.snapshot(), 2000);
  });

  it.each([
    { requested: 'call', human: 'raise', value: 80, action: 'Call', chips: 920 },
    { requested: 'check', human: 'call', value: undefined, action: 'Check', chips: 980 },
    { requested: 'fold', human: 'raise', value: 100, action: 'Fold', chips: 980 },
  ])('applies legal $requested without inventing extra chips', async ({ requested, human, value, action, chips: expected }) => {
    const decide: Decide = async () => ({ type: requested as Decision['type'] });
    const { g } = create(decide);
    await start(g);
    act(g, 'human', human, value);
    await botActs();
    expect(g.players.get('bot')!.lastAction).toBe(action);
    expect(g.players.get('bot')!.points).toBe(expected);
    assertConserved(g.snapshot(), 2000);
  });

  it('gives the strategy only detached own cards and public betting information', async () => {
    const decide = vi.fn<Decide>(async () => ({ type: 'check' }));
    const { g, hands, dealRandom } = create(decide);
    await start(g);
    const shuffleCalls = dealRandom.mock.calls.length;
    act(g, 'human', 'call');
    await botActs();
    const [view, options] = decide.mock.calls[0];
    expect(view.heroId).toBe('bot');
    expect(view.hole).toEqual(hands.bot);
    expect(view.hole).not.toBe(hands.bot);
    expect(view.hole.every((card, index) => card !== hands.bot[index])).toBe(true);
    expect(Object.keys(view).sort()).toEqual(['heroId', 'history', 'hole', 'snapshot']);
    expect(Object.keys(view.snapshot).sort()).toEqual([
      'phase', 'roundId', 'buttonId', 'smallBlindId', 'bigBlindId', 'currentBet',
      'minRaise', 'bigBlind', 'players', 'board', 'raiseAllowedIds',
    ].sort());
    expect(view.snapshot.players.every(player => !('cards' in player) && !('hand' in player) && !('seen' in player) && !('expired' in player))).toBe(true);
    expect(view.history).toEqual([expect.objectContaining({ id: 'human', type: 'call', paid: 10, to: 20, potBefore: 30 })]);
    expect(dealRandom.mock.calls).toHaveLength(shuffleCalls);
    expect(options.random).not.toBe(dealRandom);
    (view.hole[0] as Card).rank = 99;
    view.snapshot.players[0].points = -999;
    expect(hands.bot[0].rank).not.toBe(99);
    expect(g.players.get('human')!.points).toBe(980);
  });

  it('passes only current-round public history to later decisions', async () => {
    const decide = vi.fn<Decide>(async view => ({
      type: view.snapshot.players.find(player => player.id === view.heroId)!.streetBet < view.snapshot.currentBet ? 'call' : 'check',
    }));
    const { g } = create(decide);
    await start(g);
    await finish(g, 2000);
    expect(decide.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(decide.mock.calls.some(([view]) => view.history!.some(action => action.phase === 'FLOP'))).toBe(true);
    const firstRound = g.roundId;
    act(g, 'human', 'prepareRound');
    await start(g);
    await botActs();
    const next = decide.mock.calls.find(([view]) => view.snapshot.roundId !== firstRound)![0];
    expect(next.history).toEqual([]);
    expect(next.snapshot.phase).toBe('PREFLOP');
  });

  it.each([
    { name: 'out of range raise', decision: { type: 'raise', value: 0 }, priced: false },
    { name: 'call without a price', decision: { type: 'call' }, priced: false },
    { name: 'check while facing a price', decision: { type: 'check' }, priced: true },
    { name: 'unknown action', decision: { type: 'startRound' }, priced: true },
  ])('safely falls back when strategy returns $name', async ({ decision, priced }) => {
    const { g } = create(async () => decision as Decision);
    await start(g);
    act(g, 'human', priced ? 'raise' : 'call', priced ? 100 : undefined);
    await botActs();
    expect(g.players.get('bot')!.lastAction).toBe(priced ? 'Fold' : 'Check');
    assertConserved(g.snapshot(), 2000);
  });

  it('safely falls back when strategy rejects without an unhandled rejection', async () => {
    const { g } = create(async () => { throw new Error('strategy unavailable'); });
    await start(g);
    act(g, 'human', 'call');
    await botActs();
    expect(g.players.get('bot')!.lastAction).toBe('Check');
    assertConserved(g.snapshot(), 2000);
  });

  it('aborts an in-flight decision and ignores its result after disposal', async () => {
    const thinking = deferred<Decision>();
    const decide = vi.fn<Decide>(() => thinking.promise);
    const { g, changed } = create(decide);
    await start(g);
    act(g, 'human', 'call');
    await botActs();
    const signal = decide.mock.calls[0][1].signal;
    expect(signal?.aborted).toBe(false);
    g.dispose();
    const snapshot = g.snapshot();
    const changes = changed.mock.calls.length;
    expect(signal?.aborted).toBe(true);
    thinking.resolve({ type: 'raise', value: 200 });
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(g.snapshot()).toEqual(snapshot);
    expect(changed).toHaveBeenCalledTimes(changes);
  });

  it('ignores a delayed decision after the same bot acted and the street changed', async () => {
    const thinking = deferred<Decision>();
    const decide = vi.fn<Decide>(() => thinking.promise);
    const { g } = create(decide);
    await start(g);
    act(g, 'human', 'call');
    await botActs();
    act(g, 'bot', 'check');
    const before = g.snapshot();
    thinking.resolve({ type: 'raise', value: 200 });
    await flush();
    expect(g.snapshot()).toEqual(before);
    expect(decide.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it('ignores a delayed decision after expiry and settles the pot once', async () => {
    const thinking = deferred<Decision>();
    const decide = vi.fn<Decide>(() => thinking.promise);
    const { g } = create(decide);
    await start(g);
    act(g, 'human', 'raise', 100);
    await botActs();
    g.expire('bot');
    const before = g.snapshot();
    thinking.resolve({ type: 'allIn' });
    await flush();
    expect(g.snapshot()).toEqual(before);
    await vi.advanceTimersByTimeAsync(5);
    expect(g.phase).toBe('ROUND_END');
    expect(g.players.has('bot')).toBe(false);
    expect(g.snapshot().results.reduce((sum, result) => sum + result.delta, 0)).toBe(0);
    expect(decide.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it('times out normally while thinking and ignores a stale raise afterwards', async () => {
    const thinking = deferred<Decision>();
    const decide = vi.fn<Decide>(() => thinking.promise);
    const { g } = create(decide, { turn: 100 });
    await start(g);
    act(g, 'human', 'raise', 100);
    await botActs();
    await vi.advanceTimersByTimeAsync(75);
    expect(g.players.get('bot')!.lastAction).toBe('Fold');
    const before = g.snapshot();
    thinking.resolve({ type: 'raise', value: 200 });
    await flush();
    expect(g.snapshot()).toEqual(before);
    expect(decide.mock.calls[0][1].signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(5);
    expect(chips(g)).toBe(2000);
  });

  it('ignores output after the wall-clock deadline even before timeout callback', async () => {
    const thinking = deferred<Decision>();
    const decide = vi.fn<Decide>(() => thinking.promise);
    const { g } = create(decide);
    await start(g);
    act(g, 'human', 'call');
    await botActs();
    const before = g.snapshot();
    vi.setSystemTime(g.deadline + 1);
    thinking.resolve({ type: 'raise', value: 200 });
    await flush();
    expect(g.snapshot()).toEqual(before);
  });

  it('runs actual strategy through a six-seat hand without exposing hands or losing chips', async () => {
    const { g } = create(undefined, { seed: 121 });
    for (let seat = 2; seat < 6; seat++) g.add('Bot ' + seat, 'bot-' + seat, true);
    await start(g);
    await finish(g, 6000);
    expect(g.snapshot().results).toHaveLength(6);
    expect(g.snapshot().players.every(player => !('cards' in player))).toBe(true);
  }, 30000);

  it('handles unequal short stacks, all-ins and side pots with legal bot actions', async () => {
    const { g } = create(async () => ({ type: 'allIn' }));
    const stacks = [300, 9, 20, 1000, 120, 45];
    for (let seat = 2; seat < 6; seat++) g.add('Bot ' + seat, 'bot-' + seat, true);
    [...g.players.values()].forEach((player, seat) => { player.points = stacks[seat]; });
    const total = stacks.reduce((sum, stack) => sum + stack, 0);
    await start(g);
    await finish(g, total, true);
    expect(g.snapshot().board).toHaveLength(5);
    expect(g.snapshot().pots.length).toBeGreaterThan(1);
    expect(g.snapshot().pots.some(pot => pot.refund)).toBe(true);
    expect(g.snapshot().results).toHaveLength(6);
  });

  it('runs actual strategy with unequal stacks while preserving every chip', async () => {
    const decisions: Decision[] = [];
    const decide: Decide = async (view, options) => {
      const decision = await choosePokerBotAction(view, { ...options, iterations: 64 });
      decisions.push(decision);
      const hero = view.snapshot.players.find(player => player.id === view.heroId)!;
      if (decision.type === 'check') expect(hero.streetBet).toBeGreaterThanOrEqual(view.snapshot.currentBet);
      if (decision.type === 'call') expect(hero.streetBet).toBeLessThan(view.snapshot.currentBet);
      if (decision.type === 'allIn') {
        const target = hero.streetBet + hero.points;
        if (target > view.snapshot.currentBet) expect(view.snapshot.raiseAllowedIds).toContain(hero.id);
      }
      if (decision.type === 'raise') {
        expect(view.snapshot.raiseAllowedIds).toContain(hero.id);
        expect(Number.isSafeInteger(decision.value)).toBe(true);
        expect(decision.value!).toBeGreaterThan(view.snapshot.currentBet);
        expect(decision.value!).toBeLessThanOrEqual(hero.streetBet + hero.points);
        expect(decision.value! - view.snapshot.currentBet >= view.snapshot.minRaise || decision.value === hero.streetBet + hero.points).toBe(true);
      }
      return decision;
    };
    const { g } = create(decide, { seed: 1003 });
    const stacks = [600, 15, 30, 85, 225, 1000];
    for (let seat = 2; seat < 6; seat++) g.add('Bot ' + seat, 'bot-' + seat, true);
    [...g.players.values()].forEach((player, seat) => { player.points = stacks[seat]; });
    await start(g);
    await finish(g, stacks.reduce((sum, stack) => sum + stack, 0));
    expect(decisions.length).toBeGreaterThan(0);
    expect(g.snapshot().results).toHaveLength(6);
  }, 30000);
});


