import { randomInt, randomUUID } from 'node:crypto';
import { deck, shuffle } from '../../../packages/shared/src/index.js';
import type { Card } from '../../../packages/shared/src/index.js';
import { OLD_MAID_MIN_PLAYERS, OLD_MAID_MAX_PLAYERS, OLD_MAID_TURN_MS } from '../../../packages/shared/src/oldmaid.js';
import type { OldMaidPlayer, OldMaidPhase, OldMaidSnapshot, OldMaidResult, OldMaidActivity, OldMaidDraw, OldMaidHandMessage } from '../../../packages/shared/src/oldmaid.js';
import { GameError } from './game.js';

const demand = (ok: unknown, message: string) => { if (!ok) throw new GameError('INVALID_ACTION', message); };
interface Player extends OldMaidPlayer { hand: Card[]; expired: boolean; seen: Set<string>; draws: OldMaidDraw[] }
export interface OldMaidHooks { changed(): void; hand(id: string, message: OldMaidHandMessage): void }

export class OldMaidGame {
  players = new Map<string, Player>();
  phase: OldMaidPhase = 'LOBBY'; roundId = 0; hostId = ''; turnId: string | null = null;
  turnNumber = 0; deadline = 0; discardedPairs = 0;
  private removedCard?: Card; private lastPair: Card[] = [];
  private lastAction: OldMaidSnapshot['lastAction'] = null;
  private result: OldMaidResult | null = null;
  private history: OldMaidActivity[] = [];
  private activityId = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private botTimer?: ReturnType<typeof setTimeout>;
  constructor(public code: string, private hooks: OldMaidHooks,
    private random: (max: number) => number = randomInt, public turnDurationMs = OLD_MAID_TURN_MS, private botDelayMs = 700) {}
  private ordered() { return [...this.players.values()].sort((a,b) => a.seat - b.seat); }
  private remaining() { return this.ordered().filter(p => p.hand.length > 0); }
  private clearTimer() { if (this.timer) clearTimeout(this.timer); if (this.botTimer) clearTimeout(this.botTimer); this.timer = undefined; this.botTimer = undefined; }
  private changed() { this.hooks.changed(); }
  private assignHost() { if (!this.players.get(this.hostId)?.connected) this.hostId = this.ordered().find(p => p.connected && !p.expired && !p.isBot)?.id ?? ''; }
  add(name: unknown, id: string = randomUUID(), isBot = false) {
    demand(this.phase !== 'PLAYING', 'รอรอบนี้จบก่อน');
    demand(this.players.size < OLD_MAID_MAX_PLAYERS, 'ห้องเต็มแล้ว (สูงสุด 8 คน)');
    demand(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 20, 'ชื่อยาว 1–20 ตัวอักษร');
    demand(!this.players.has(id), 'ผู้เล่นนี้อยู่ในห้องแล้ว');
    const seat = Array.from({ length: 8 }, (_, i) => i).find(i => !this.ordered().some(p => p.seat === i))!;
    this.players.set(id, { id, name: (name as string).trim(), seat, connected: true, ready: isBot,
      cardCount: 0, finished: false, wins: 0, isBot, hand: [], expired: false, seen: new Set(), draws: [] });
    if (!this.hostId && !isBot) this.hostId = id;
    this.changed(); return id;
  }
  addBot() {
    demand(this.phase === 'LOBBY', 'เพิ่มบอทได้ก่อนเริ่มรอบเท่านั้น');
    let n = 1; while (this.ordered().some(p => p.name === `บอท Old Maid ${n}`)) n++;
    return this.add(`บอท Old Maid ${n}`, `bot-${randomUUID()}`, true);
  }
  removeBot(id: unknown) {
    demand(this.phase === 'LOBBY', 'นำบอทออกได้ก่อนเริ่มรอบเท่านั้น');
    demand(typeof id === 'string' && this.players.get(id)?.isBot, 'เลือกบอทที่อยู่ในห้อง');
    this.players.delete(id as string); this.changed();
  }
  private sendHand(id: string) {
    const p = this.players.get(id); if (p) this.hooks.hand(id, {
      roundId: this.roundId, cards: p.hand.map(c => ({...c})),
      oldMaid: structuredClone({roundId: this.roundId, draws: p.draws}),
    });
  }
  reconnect(id: string) {
    const p = this.players.get(id); demand(p && !p.expired, 'หมดเวลา reconnect');
    p!.connected = true; if (!this.hostId) this.hostId = id; this.sendHand(id); this.changed();
  }
  disconnect(id: string) {
    const p = this.players.get(id); if (!p) return;
    p.connected = false; p.ready = false; this.assignHost(); this.changed();
  }
  expire(id: string) {
    const p = this.players.get(id); if (!p) return;
    p.expired = true; p.connected = false;
    if (this.phase !== 'PLAYING') this.players.delete(id);
    // Keep all dealt cards in play; departing seats finish automatically.
    else if (this.turnId === id) this.scheduleTurn();
    this.assignHost(); this.changed();
  }
  private target() {
    if (!this.turnId) return null;
    const active = this.remaining(), i = active.findIndex(p => p.id === this.turnId);
    return i >= 0 && active.length > 1 ? active[(i + 1) % active.length] : null;
  }
  snapshot(): OldMaidSnapshot {
    return { game: 'oldmaid', code: this.code, phase: this.phase, roundId: this.roundId, hostId: this.hostId,
      players: this.ordered().map(({ hand, expired, seen, draws, ...p }) => ({...p, cardCount: hand.length})),
      turnId: this.turnId, targetId: this.target()?.id ?? null, turnNumber: this.turnNumber,
      deadline: this.deadline, turnDurationMs: this.turnDurationMs, discardedPairs: this.discardedPairs,
      lastPair: this.lastPair.map(c => ({...c})), lastAction: this.lastAction ? {...this.lastAction} : null,
      history: structuredClone(this.history),
      result: this.result ? {...this.result, lastCard: {...this.result.lastCard}, removedCard: {...this.result.removedCard}, winners: [...this.result.winners]} : null };
  }
  action(id: string, raw: unknown) {
    const p = this.players.get(id); demand(p?.connected && !p.expired, 'ไม่พบผู้เล่นที่เชื่อมต่อ');
    demand(raw && typeof raw === 'object' && !Array.isArray(raw), 'คำสั่งไม่ถูกต้อง');
    const a = raw as { type: string; actionId: string; roundId: number; value?: unknown };
    demand(a.roundId === this.roundId && Number.isInteger(a.roundId) && typeof a.actionId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(a.actionId), 'คำสั่งไม่ถูกต้องหรือมาจากรอบเก่า');
    if (p!.seen.has(a.actionId)) return;
    demand(p!.seen.size < 2048, 'ส่งคำสั่งมากเกินไป');
    if (a.type === 'draw') {
      demand(this.phase === 'PLAYING' && this.turnId === id && Date.now() < this.deadline, 'ยังไม่ใช่ตาของคุณ');
      demand(typeof a.value === 'string' && /^\d+:\d+$/.test(a.value), 'เลือกไพ่ที่ต้องการจั่ว');
      const [turn, index] = (a.value as string).split(':').map(Number);
      demand(turn === this.turnNumber, 'ตานี้จบแล้ว กรุณาเลือกไพ่อีกครั้ง');
      demand(Number.isSafeInteger(index) && index >= 0 && index < (this.target()?.hand.length ?? 0), 'เลือกไพ่ที่มีอยู่ในมือผู้เล่นถัดไป');
      p!.seen.add(a.actionId); this.draw(index); return;
    }
    demand(this.phase !== 'PLAYING', 'รอรอบนี้จบก่อน');
    if (a.type === 'setReady') {
      demand(this.phase === 'LOBBY' && typeof a.value === 'boolean', 'สถานะพร้อมไม่ถูกต้อง');
      p!.ready = a.value as boolean;
    } else {
      demand(id === this.hostId, 'เฉพาะผู้สร้างห้องเท่านั้น');
      if (a.type === 'addBot') { this.addBot(); p!.seen.add(a.actionId); return; }
      else if (a.type === 'removeBot') { this.removeBot(a.value); p!.seen.add(a.actionId); return; }
      else if (a.type === 'startRound') this.start();
      else if (a.type === 'prepareRound') {
        demand(this.phase === 'RESULTS', 'รอรอบนี้จบก่อน'); this.clearTimer();
        this.phase = 'LOBBY'; this.turnId = null; this.deadline = 0; this.result = null;
        this.lastPair = []; this.lastAction = null; this.discardedPairs = 0; this.history = []; this.activityId = 0;
        for (const player of this.players.values()) {
          if (player.expired) { this.players.delete(player.id); continue; }
          player.hand = []; player.draws = []; player.ready = player.isBot; player.finished = false; player.seen.clear(); this.sendHand(player.id);
        }
        this.assignHost();
      } else demand(false, 'ไม่รู้จักคำสั่ง');
    }
    p!.seen.add(a.actionId); this.changed();
  }
  private discard(p: Player, onPair?: (pair: Card[]) => void) {
    const byRank = new Map<number, Card>(); const remaining: Card[] = [];
    let count = 0;
    for (const card of p.hand) {
      const other = byRank.get(card.rank);
      if (other) { this.lastPair = [{...other}, {...card}]; onPair?.(this.lastPair); byRank.delete(card.rank); count++; }
      else byRank.set(card.rank, card);
    }
    remaining.push(...byRank.values()); p.hand = shuffle(remaining, this.random);
    p.finished = p.hand.length === 0; this.discardedPairs += count; return count;
  }
  private start() {
    demand(this.phase === 'LOBBY', 'เตรียมรอบใหม่ก่อน');
    const players = this.ordered();
    demand(players.length >= OLD_MAID_MIN_PLAYERS && players.length <= OLD_MAID_MAX_PLAYERS, 'ต้องมีผู้เล่น 3–8 คน');
    demand(players.every(p => p.connected && !p.expired && (p.isBot || p.id === this.hostId || p.ready)), 'รอทุกคนพร้อมก่อน');
    const cards = shuffle(deck(), this.random);
    this.removedCard = cards.pop()!; this.roundId++; this.phase = 'PLAYING'; this.result = null;
    this.discardedPairs = 0; this.lastPair = []; this.lastAction = null; this.history = []; this.activityId = 0;
    for (const p of players) { p.hand = []; p.draws = []; p.finished = false; p.ready = false; p.seen.clear(); }
    cards.forEach((card, i) => players[i % players.length].hand.push(card));
    for (const p of players) {
      this.discard(p, pair => this.record({kind:'deal', turnNumber:0, playerId:p.id, playerName:p.name, pair}));
      this.sendHand(p.id);
    }
    if (!this.finish()) { this.turnId = this.remaining()[this.random(this.remaining().length)].id; this.scheduleTurn(); }
  }
  private scheduleTurn() {
    this.clearTimer(); this.turnNumber++;
    const delay = this.players.get(this.turnId!)?.expired ? Math.min(500, this.turnDurationMs) : this.turnDurationMs;
    this.deadline = Date.now() + delay;
    this.timer = setTimeout(() => {
      const target = this.target();
      if (this.phase === 'PLAYING' && target?.hand.length) { this.draw(this.random(target.hand.length)); }
    }, delay);
    if (this.players.get(this.turnId!)?.isBot) this.botTimer = setTimeout(() => {
      const target = this.target();
      // The bot sees only how many face-down choices are available, never ranks.
      if (this.phase === 'PLAYING' && target?.hand.length) this.draw(this.random(target.hand.length));
    }, Math.min(this.botDelayMs, Math.floor(delay / 2)));
  }
  private draw(index: number) {
    const p = this.players.get(this.turnId!)!, target = this.target()!;
    // Decide the next seat before anyone runs out of cards.
    const all = this.ordered(), seat = all.findIndex(player => player.id === p.id);
    this.clearTimer(); const drawnCard = target.hand.splice(index,1)[0]; p.hand.push(drawnCard);
    const paired = this.discard(p) > 0; target.finished = target.hand.length === 0;
    this.lastAction = {playerId: p.id, targetId: target.id, paired};
    const activity = this.record({kind:'draw', turnNumber:this.turnNumber, playerId:p.id, playerName:p.name,
      targetId:target.id, targetName:target.name, pair:paired ? this.lastPair : []});
    p.draws.push({...structuredClone(activity), drawnCard:{...drawnCard}});
    if (p.draws.length > 60) p.draws.shift();
    this.sendHand(p.id); this.sendHand(target.id);
    if (!this.finish()) {
      this.turnId = Array.from({length: all.length},(_,i) => all[(seat + i + 1) % all.length]).find(player => player.hand.length > 0)!.id;
      this.scheduleTurn();
    }
    this.changed();
  }
  private record(activity: Omit<OldMaidActivity, 'id'>) {
    const entry = structuredClone({...activity, id:++this.activityId});
    this.history.push(entry);
    if (this.history.length > 60) this.history.shift();
    return entry;
  }
  private finish() {
    const remaining = this.remaining(); if (remaining.length > 1) return false;
    const loser = remaining[0];
    if (!loser || loser.hand.length !== 1 || !this.removedCard) throw new Error('Old Maid card conservation failed');
    this.clearTimer(); this.phase = 'RESULTS'; this.turnId = null; this.deadline = 0;
    const winners = this.ordered().filter(p => p.id !== loser.id).map(p => p.id);
    for (const id of winners) this.players.get(id)!.wins++;
    this.result = {loserId: loser.id, lastCard: {...loser.hand[0]}, removedCard: {...this.removedCard}, winners};
    return true;
  }
  dispose() { this.clearTimer(); }
}
