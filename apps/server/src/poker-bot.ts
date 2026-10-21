import { setImmediate } from 'node:timers/promises';
import { deck } from '../../../packages/shared/src/index.js';
import type { Card } from '../../../packages/shared/src/index.js';
import { bestPokerHand, comparePoker } from '../../../packages/shared/src/poker.js';
import type { PokerHand, PokerPhase, PokerPlayer, PokerSnapshot } from '../../../packages/shared/src/poker.js';

/** Deliberately excludes the deck, opponents' cards and showdown results. */
export interface PokerBotView {
  snapshot: Pick<PokerSnapshot, 'phase' | 'roundId' | 'buttonId' | 'smallBlindId' | 'bigBlindId'
    | 'currentBet' | 'minRaise' | 'bigBlind' | 'players' | 'board' | 'raiseAllowedIds'>;
  heroId: string;
  hole: readonly Card[];
  history?: readonly PokerBotAction[];
}
export interface PokerBotAction {
  id: string; phase: PokerPhase; type: 'fold' | 'check' | 'call' | 'raise' | 'allIn';
  paid: number; to: number; potBefore: number;
}
export interface PokerBotOptions {
  /** Independent strategy RNG: never pass the dealing/shuffle RNG. */
  random: (max: number) => number;
  signal?: AbortSignal;
  iterations?: number;
  yieldEvery?: number;
  yieldControl?: () => Promise<void>;
}
export interface PokerBotDecision { type: 'fold' | 'check' | 'call' | 'raise' | 'allIn'; value?: number }
export interface PokerBotAnalysis {
  equity: number; showdownEquity: number; winRate: number; tieRate: number;
  potOdds: number; callCost: number; contestablePot: number; position: number;
  preflopStrength: number; madeStrength: number; drawStrength: number;
  effectiveStack: number; spr: number; samples: number;
}
interface Layer { amount: number; opponents: string[] }
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const rank = (c: Card) => c.rank === 1 ? 14 : c.rank;
const key = (c: Card) => c.suit + ':' + c.rank;
const aggressive = (a: PokerBotAction) => a.type === 'raise' || a.type === 'allIn';
function abort(signal?: AbortSignal) {
  if (signal?.aborted) { const error = new Error('Poker bot analysis cancelled'); error.name = 'AbortError'; throw error; }
}
function integer(random: PokerBotOptions['random'], max: number) {
  const n = random(max);
  if (!Number.isInteger(n) || n < 0 || n >= max) throw new Error('Invalid poker strategy random source');
  return n;
}

/** A starting-hand prior, not a lookup claiming to be a solved opening chart. */
export function pokerStartingStrength(cards: readonly Card[]): number {
  const [hi, lo] = cards.map(rank).sort((a, b) => b - a);
  if (hi === lo) return .43 + (hi - 2) / 12 * .51;
  const gap = hi - lo - 1;
  const connected = gap === 0 ? .07 : gap === 1 ? .035 : 0;
  const wheel = hi === 14 && lo <= 5 ? .025 : 0;
  return clamp(.20 + .27 * hi / 14 + .18 * lo / 14 + connected + wheel
    + (cards[0].suit === cards[1].suit ? .07 : 0) + (hi === 14 ? .045 : 0)
    - .02 * Math.min(5, Math.max(0, gap - 1)), .15, .91);
}
function drawStrength(hole: readonly Card[], board: readonly Card[]) {
  if (board.length !== 3 && board.length !== 4) return 0;
  const cards = [...hole, ...board];
  const flush = hole.some(c => cards.filter(other => other.suit === c.suit).length === 4) ? .70 : 0;
  const values = new Set(cards.map(rank)); if (values.has(14)) values.add(1);
  let straight = 0;
  for (let low = 1; low <= 10; low++) {
    const run = Array.from({ length: 5 }, (_, i) => low + i);
    if (run.filter(v => values.has(v)).length === 4 && hole.some(c => run.includes(rank(c)) || c.rank === 1 && low === 1)) {
      const missing = run.find(v => !values.has(v))!;
      straight = Math.max(straight, missing === low || missing === low + 4 ? .55 : .30);
    }
  }
  const overcards = hole.filter(c => rank(c) > Math.max(...board.map(rank))).length;
  return clamp(Math.max(flush, straight) + Math.min(flush, straight) * .35 + overcards * .045, 0, .98);
}
/** Distinguishes a private top pair from merely sharing a pair on the board. */
function madeStrength(hole: readonly Card[], board: readonly Card[], hand?: PokerHand, boardHand?: PokerHand) {
  if (board.length < 3) return pokerStartingStrength(hole);
  const made = hand ?? bestPokerHand([...hole, ...board]);
  const boardValues = board.map(rank), top = Math.max(...boardValues);
  if (board.length === 5 && comparePoker(made, boardHand ?? bestPokerHand(board)) === 0) return .20 + made.rank * .035;
  if (made.rank >= 4) return [.12, .5, .73, .83, .88, .92, .96, .985, .999][made.rank];
  if (made.rank === 3) return hole.some(c => boardValues.filter(v => v === rank(c)).length > 0) ? .83 : .40;
  if (made.rank === 2) return .72;
  if (made.rank === 1) {
    const paired = made.kickers[0];
    if (!hole.some(c => rank(c) === paired)) return .22 + Math.max(...hole.map(rank)) / 140;
    return paired >= top ? .62 + Math.max(...hole.map(rank)) / 180 : .34 + paired / 100;
  }
  return .12 + Math.max(...hole.map(rank)) / 100;
}
function position(view: PokerBotView, hero: PokerPlayer) {
  const players = view.snapshot.players.filter(p => p.inHand && !p.folded).sort((a, b) => a.seat - b.seat);
  const buttonSeat = view.snapshot.players.find(p => p.id === view.snapshot.buttonId)?.seat ?? 0;
  const clockwise = [...players.filter(p => p.seat > buttonSeat), ...players.filter(p => p.seat <= buttonSeat)];
  return clockwise.length > 1 ? clockwise.findIndex(p => p.id === hero.id) / (clockwise.length - 1) : 1;
}
function callLayers(players: readonly PokerPlayer[], hero: PokerPlayer, call: number): Layer[] {
  const cap = hero.contribution + call;
  const levels = [...new Set(players.filter(p => p.inHand).map(p => Math.min(cap, p.contribution + (p.id === hero.id ? call : 0))))]
    .filter(n => n > 0).sort((a, b) => a - b);
  let previous = 0;
  return levels.map(level => {
    const contributors = players.filter(p => p.inHand && p.contribution + (p.id === hero.id ? call : 0) >= level);
    // The bot's unmatched chips are returned; they are not money it can win from someone else.
    const amount = contributors.length > 1 ? (level - previous) * contributors.length : 0;
    previous = level;
    // A player still to act can contest a layer if their public stack can cover it.
    const opponents = players.filter(p => p.id !== hero.id && p.inHand && !p.folded && p.contribution + p.points >= level).map(p => p.id);
    return { amount, opponents };
  });
}
function rangeModel(view: PokerBotView, opponent: PokerPlayer) {
  const history = view.history ?? [];
  const actions = history.filter(a => a.id === opponent.id);
  const raises = actions.filter(aggressive);
  const streetRaises = raises.filter(a => a.phase === view.snapshot.phase);
  const preRaises = raises.filter(a => a.phase === 'PREFLOP');
  const last = streetRaises.at(-1);
  const price = Math.max(0, opponent.streetBet - view.snapshot.bigBlind) / Math.max(1, view.snapshot.bigBlind);
  // Public price/lastAction are fallbacks for snapshots without recorded history.
  const pressure = last ? last.paid / Math.max(view.snapshot.bigBlind, last.potBefore) :
    /Raise|All-in/i.test(opponent.lastAction) ? Math.min(2, price / 5) : 0;
  return { preflop: preRaises.length > 0 || view.snapshot.phase === 'PREFLOP' && price > .1,
    tightness: clamp(.53 + preRaises.length * .065 + Math.log2(1 + price) * .04, .53, .84),
    pressure: clamp(pressure, 0, 3), called: actions.some(a => a.type === 'call'),
    postflop: view.snapshot.board.length >= 3 && (streetRaises.length > 0 || pressure > 0) };
}

interface RangeTable { cumulative: Float64Array; total: number }
interface HolePair { first: number; second: number }
/** Exact weighted draw, conditional on cards already assigned to other opponents. */
function drawRange(table: RangeTable, pairs: readonly HolePair[], available: Uint8Array, random: PokerBotOptions['random']): HolePair {
  for (let attempt = 0; attempt < 8; attempt++) {
    const target = integer(random, 1_000_000_000) / 1_000_000_000 * table.total;
    let low = 0, high = pairs.length - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (table.cumulative[middle] <= target) low = middle + 1; else high = middle;
    }
    const pair = pairs[low];
    if (available[pair.first] && available[pair.second]) return pair;
  }
  // A narrow range may concentrate on blocked cards. Re-normalize its remaining
  // weights rather than quietly substituting a uniformly random weak hand.
  let total = 0;
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    if (available[pair.first] && available[pair.second]) total += table.cumulative[i] - (table.cumulative[i - 1] ?? 0);
  }
  let target = integer(random, 1_000_000_000) / 1_000_000_000 * total;
  let last: HolePair | undefined;
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    if (!available[pair.first] || !available[pair.second]) continue;
    last = pair;
    target -= table.cumulative[i] - (table.cumulative[i - 1] ?? 0);
    if (target < 0) return pair;
  }
  return last!; // Positive range floors and at least two remaining cards guarantee a candidate.
}

/** Bounded Monte Carlo against weighted plausible ranges, yielding during preparation and simulation. */
export async function analyzePokerBot(view: PokerBotView, options: PokerBotOptions): Promise<PokerBotAnalysis> {
  abort(options.signal);
  const { snapshot, hole } = view;
  const hero = snapshot.players.find(p => p.id === view.heroId);
  if (!hero || hole.length !== 2 || !['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(snapshot.phase)) throw new Error('Invalid poker bot view');
  const known = [...hole, ...snapshot.board];
  if (new Set(known.map(key)).size !== known.length) throw new Error('Duplicate known poker cards');
  const unseen = deck().filter(c => !known.some(visible => key(visible) === key(c)));
  const opponents = snapshot.players.filter(p => p.id !== hero.id && p.inHand && !p.folded);
  const callCost = Math.min(hero.points, Math.max(0, snapshot.currentBet - hero.streetBet));
  const layers = callLayers(snapshot.players, hero, callCost);
  const contestablePot = layers.reduce((sum, p) => sum + p.amount, 0);
  const effectiveStack = Math.min(hero.points, Math.max(0, ...opponents.map(p => p.points + p.streetBet - hero.streetBet)));
  const trials = Math.round(clamp(options.iterations ?? 96, 16, 512));
  const batch = Math.round(clamp(options.yieldEvery ?? 4, 1, 8));
  const yieldControl = options.yieldControl ?? (() => setImmediate());
  const models = opponents.map(p => rangeModel(view, p));
  const currentMade = snapshot.board.length >= 3 ? bestPokerHand([...hole, ...snapshot.board]) : undefined;
  const boardHand = snapshot.board.length === 5 ? bestPokerHand(snapshot.board) : undefined;
  const riverHands = new Map<string, PokerHand>();
  const evaluated = (cards: Card[], runout: Card[]) => {
    if (!boardHand) return bestPokerHand([...cards, ...runout]);
    const cacheKey = cards.map(key).sort().join('|');
    let hand = riverHands.get(cacheKey);
    if (!hand) { hand = bestPokerHand([...cards, ...runout]); riverHands.set(cacheKey, hand); }
    return hand;
  };
  const pairCount = unseen.length * (unseen.length - 1) / 2;
  const ranges: (RangeTable | undefined)[] = models.map(model => model.preflop || model.called || model.postflop
    ? { cumulative: new Float64Array(pairCount), total: 0 } : undefined);
  const pairs: HolePair[] = [];
  if (ranges.some(Boolean)) {
    for (let first = 0; first < unseen.length - 1; first++) for (let second = first + 1; second < unseen.length; second++) {
      abort(options.signal);
      const index = pairs.length; pairs.push({ first, second });
      const cards = [unseen[first], unseen[second]], pre = pokerStartingStrength(cards);
      let made: number | undefined, draw: number | undefined;
      for (let i = 0; i < models.length; i++) {
        const table = ranges[i]; if (!table) continue;
        const model = models[i]; let weight = 1;
        if (model.preflop) {
          const looseWeight = .045 - .035 * clamp((model.tightness - .58) / .26);
          weight *= looseWeight + (1 - looseWeight) * clamp((pre - model.tightness + .13) / .28);
        } else if (model.called) weight *= .35 + .65 * clamp((pre - .30) / .4);
        if (model.postflop) {
          made ??= madeStrength(cards, snapshot.board, evaluated(cards, snapshot.board), boardHand);
          draw ??= drawStrength(cards, snapshot.board);
          weight *= .08 + .92 * clamp((Math.max(made, draw * .76) - .32 - model.pressure * .06) / .42);
        }
        table.total += weight; table.cumulative[index] = table.total;
      }
      if (pairs.length % 32 === 0 && pairs.length < pairCount) { await yieldControl(); abort(options.signal); }
    }
  }
  let returns = 0, showdown = 0, wins = 0, ties = 0;
  for (let trial = 0; trial < trials; trial++) {
    abort(options.signal);
    const available = new Uint8Array(unseen.length).fill(1);
    const hands = new Map<string, Card[]>();
    for (let i = 0; i < opponents.length; i++) {
      const table = ranges[i]; let pair: HolePair;
      if (table) pair = drawRange(table, pairs, available, options.random);
      else {
        const left = Array.from(available.keys()).filter(index => available[index]);
        const first = integer(options.random, left.length);
        let second = integer(options.random, left.length - 1); if (second >= first) second++;
        pair = { first: left[first], second: left[second] };
      }
      hands.set(opponents[i].id, [unseen[pair.first], unseen[pair.second]]);
      available[pair.first] = 0; available[pair.second] = 0;
    }
    const remaining = unseen.filter((_, i) => available[i]), runout = [...snapshot.board];
    while (runout.length < 5) runout.push(remaining.splice(integer(options.random, remaining.length), 1)[0]);
    const heroHand = boardHand ? currentMade! : bestPokerHand([...hole, ...runout]);
    const compared = new Map(opponents.map(p => [p.id, comparePoker(heroHand, evaluated(hands.get(p.id)!, runout))]));
    const all = [...compared.values()];
    if (all.every(n => n >= 0)) {
      const tied = all.filter(n => n === 0).length;
      showdown += 1 / (1 + tied); if (tied) ties++; else wins++;
    }
    for (const layer of layers) {
      const comparisons = layer.opponents.map(id => compared.get(id) ?? 1);
      if (comparisons.every(n => n >= 0)) returns += layer.amount / (1 + comparisons.filter(n => n === 0).length);
    }
    if ((trial + 1) % batch === 0 && trial + 1 < trials) { await yieldControl(); abort(options.signal); }
  }
  return { equity: contestablePot > 0 ? returns / trials / contestablePot : showdown / trials,
    showdownEquity: showdown / trials, winRate: wins / trials, tieRate: ties / trials,
    potOdds: contestablePot > 0 ? callCost / contestablePot : 0, callCost, contestablePot,
    position: position(view, hero), preflopStrength: pokerStartingStrength(hole),
    madeStrength: madeStrength(hole, snapshot.board, currentMade, boardHand), drawStrength: drawStrength(hole, snapshot.board),
    effectiveStack, spr: effectiveStack / Math.max(snapshot.bigBlind, contestablePot - callCost), samples: trials };
}

function raiseDecision(view: PokerBotView, analysis: PokerBotAnalysis, random: PokerBotOptions['random'], bluff: boolean): PokerBotDecision | undefined {
  const s = view.snapshot, hero = s.players.find(p => p.id === view.heroId)!;
  const responders = s.players.filter(p => p.id !== hero.id && p.inHand && !p.folded && !p.allIn && p.points > 0);
  if (!s.raiseAllowedIds.includes(hero.id) || !responders.length) return;
  const max = hero.streetBet + hero.points, min = s.currentBet + s.minRaise;
  if (max <= s.currentBet) return;
  const rolls = integer(random, 3);
  const raisedPreflop = (view.history ?? []).some(a => a.phase === 'PREFLOP' && aggressive(a));
  let target: number;
  if (s.phase === 'PREFLOP') {
    const limpers = s.players.filter(p => p.id !== hero.id && p.streetBet === s.bigBlind && p.id !== s.bigBlindId).length;
    target = raisedPreflop || s.currentBet > s.bigBlind
      ? s.currentBet * (analysis.position > .6 ? 2.7 : 3.2) + limpers * s.bigBlind
      : s.bigBlind * (2.2 + rolls * .25 + limpers);
  } else {
    const fraction = bluff ? .40 + rolls * .1 : .45 + rolls * .15;
    target = s.currentBet + Math.max(s.minRaise, analysis.contestablePot * fraction);
  }
  const shove = !bluff && ((s.phase === 'PREFLOP' && hero.points <= s.bigBlind * 12 && analysis.preflopStrength > .73)
    || analysis.spr < 1.2 && analysis.showdownEquity > .67 || analysis.showdownEquity > .94 && analysis.spr < 3);
  if (shove) target = max;
  else if (bluff && target - hero.streetBet > Math.max(s.bigBlind * 3, analysis.effectiveStack * .45)) return;
  const cover = Math.max(...responders.map(p => p.points + p.streetBet));
  target = Math.min(max, Math.max(min, Math.min(Math.round(target), Math.max(min, cover))));
  // A below-minimum raise is legal only if it consumes this bot's entire stack.
  if (target < min && target !== max) return;
  return target === max ? { type: 'allIn' } : { type: 'raise', value: target };
}

export async function choosePokerBotAction(view: PokerBotView, options: PokerBotOptions): Promise<PokerBotDecision> {
  const a = await analyzePokerBot(view, options); abort(options.signal);
  const s = view.snapshot, hero = s.players.find(p => p.id === view.heroId)!;
  const opponents = s.players.filter(p => p.id !== hero.id && p.inHand && !p.folded);
  const fallback: PokerBotDecision = { type: a.callCost > 0 ? 'call' : 'check' };
  const roll = integer(options.random, 1_000_000) / 1_000_000;
  const history = view.history ?? [];
  const preflop = s.phase === 'PREFLOP', river = s.phase === 'RIVER';
  // Betting cannot make money when everyone is guaranteed to play the same board.
  if (river && a.tieRate > .98) return fallback;
  const noFutureBetting = hero.points <= a.callCost || opponents.every(p => p.allIn || p.points === 0);
  const realization = river || noFutureBetting ? 1 : clamp(.88 + a.position * .09 - Math.max(0, opponents.length - 1) * .025 + a.drawStrength * .04, .78, 1);
  const edge = a.equity * realization - a.potOdds;
  const opening = preflop && s.currentBet <= s.bigBlind && !history.some(aggressive);
  const aces = preflop && view.hole.every(c => c.rank === 1);
  const openingThreshold = .63 - a.position * .11 + Math.max(0, opponents.length - 2) * .012;
  const value = preflop
    ? opening ? a.preflopStrength >= openingThreshold : a.preflopStrength >= .78 && a.showdownEquity > 1 / (opponents.length + 1) + .10
    : a.showdownEquity >= (a.callCost ? .70 : .60) + Math.max(0, opponents.length - 1) * .025 && a.madeStrength >= .48;
  if ((value || aces) && (opening || aces || edge > -.01) && roll < (a.showdownEquity > .9 ? .98 : .86)) {
    const raise = raiseDecision(view, a, options.random, false); if (raise) return raise;
  }
  const lastAggressor = [...history].reverse().find(aggressive)?.id;
  const semiBluff = !river && !preflop && a.drawStrength >= .45 && a.showdownEquity > .18 && opponents.length <= 2;
  const blocker = river && view.hole.some(c => c.rank === 1 && s.board.filter(b => b.suit === c.suit).length >= 3);
  const continuation = !preflop && !a.callCost && opponents.length === 1 && lastAggressor === hero.id && a.position > .5;
  const steal = opening && a.position > .65 && a.preflopStrength > .42;
  const bluffFrequency = a.callCost > 0 ? semiBluff && a.callCost < hero.points * .2 ? .075 : blocker && opponents.length === 1 ? .035 : 0
    : semiBluff ? .18 + a.drawStrength * .12 : continuation ? .16 : steal ? .10 : blocker && opponents.length === 1 ? .10 : 0;
  if (roll < bluffFrequency) { const raise = raiseDecision(view, a, options.random, true); if (raise) return raise; }
  if (!a.callCost) return fallback;
  // Unacted players have not yet funded the pot: equity vs all five cannot price an unopened blind call.
  if (opening && a.preflopStrength >= openingThreshold) return fallback;
  if (preflop && view.hole.every(c => c.rank === 1)) return fallback;
  // Resist dominated, out-of-position limps even when a blind looks superficially cheap.
  if (opening && a.preflopStrength < .35 + (1 - a.position) * .08 && hero.id !== s.bigBlindId) return { type: 'fold' };
  const margin = noFutureBetting || river ? 0 : .015 + (1 - a.position) * .015;
  return edge >= margin ? fallback : { type: 'fold' };
}
