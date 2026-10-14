import { randomInt, randomUUID } from 'node:crypto';
import { deck, shuffle } from '../../../packages/shared/src/index.js';
import type { Card } from '../../../packages/shared/src/index.js';
import { bestPokerHand, pokerPayout, pokerLivePots, POKER_ACTION_MS, POKER_RECONNECT_SECONDS, POKER_CLOSE_DELAY_MS } from '../../../packages/shared/src/poker.js';
import type { PokerPlayer, PokerPhase, PokerSnapshot, PokerResult, PokerPot, PokerHand } from '../../../packages/shared/src/poker.js';
import { GameError } from './game.js';
import type { GameHooks } from './game.js';
const demand = (ok: unknown, message: string) => { if (!ok) throw new GameError('INVALID_ACTION', message); };
interface Player extends PokerPlayer { expired: boolean; seen: Set<string> }
export class PokerGame {
  players = new Map<string, Player>();
  phase: PokerPhase = 'LOBBY'; roundId = 0; deadline = 0; hostId = ''; buttonId = ''; turnId = '';
  smallBlindId = ''; bigBlindId = ''; currentBet = 0; minRaise = 20;
  private board: Card[] = []; private hands: Record<string, Card[]> = {}; private stock: Card[] = [];
  private results: PokerResult[] = []; private pots: PokerPot[] = [];
  private order: string[] = []; private pending = new Set<string>(); private actedAt = new Map<string, number>();
  private timer?: ReturnType<typeof setTimeout>; private botTimer?: ReturnType<typeof setTimeout>;
  private settled = false;
  private foldOrder: string[] = [];
  private buttonSeat = -1;
  roomClosing = false; closeAt = 0;
  readonly smallBlind = 10; readonly bigBlind = 20;
  constructor(public code: string, private hooks: GameHooks,
    private random: (max: number) => number = randomInt,
    public timings = { deal: 1200, turn: POKER_ACTION_MS, reveal: 900, bot: 700 },
    private closeDelayMs = POKER_CLOSE_DELAY_MS) {}
  private idle() { return this.phase === 'LOBBY' || this.phase === 'ROUND_END'; }
  add(name: unknown, id: string = randomUUID(), isBot = false) {
    demand(!this.roomClosing, 'ห้องกำลังปิด'); demand(this.idle(), 'กรุณารอรอบนี้จบก่อน'); demand(this.players.size < 6, 'ห้องเต็มแล้ว');
    demand(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 20, 'ชื่อยาว 1–20 ตัวอักษร');
    demand(!this.players.has(id), 'ผู้เล่นอยู่ในห้องแล้ว');
    const seat = Array.from({ length: 6 }, (_, i) => i).find(i => ![...this.players.values()].some(p => p.seat === i))!;
    this.players.set(id, { id, name: (name as string).trim(), seat, isBot, points: 1000, connected: true, ready: isBot,
      folded: false, allIn: false, inHand: false, streetBet: 0, contribution: 0, lastAction: '', reconnectUntil: 0, expired: false, seen: new Set() });
    if (!this.hostId && !isBot) this.hostId = id;
    this.changed(); return id;
  }
  addBot() { return this.add(`บอท Poker ${[...this.players.values()].filter(p => p.isBot).length + 1}`, `bot-${randomUUID()}`, true); }
  private changed() { this.hooks.changed(); }
  private reassign() {
    if (!this.players.get(this.hostId)?.connected) this.hostId = [...this.players.values()].find(p => !p.isBot && p.connected && !p.expired)?.id ?? '';
  }
  disconnect(id: string, reconnectSeconds = POKER_RECONNECT_SECONDS) {
    const p = this.players.get(id); if (!p) return;
    p.connected = false; p.ready = false; p.reconnectUntil = Date.now() + reconnectSeconds * 1000;
    this.reassign(); this.changed();
  }
  reconnect(id: string) {
    const p = this.players.get(id); demand(p && !p.expired, 'หมดเวลา reconnect');
    p!.connected = true; p!.reconnectUntil = 0; if (!this.hostId && !p!.isBot) this.hostId = id;
    this.hooks.privateHand(id, this.hands[id] ?? []); this.changed();
  }
  expire(id: string) {
    const p = this.players.get(id); if (!p) return;
    p.expired = true; p.connected = false; p.ready = false; p.reconnectUntil = 0;
    this.reassign();
    // Keep committed chips and all-in eligibility until settlement. A permanent
    // departure otherwise folds immediately, including during the deal animation.
    if (this.idle()) this.players.delete(id);
    else if (!this.settled && p.inHand && !p.folded && !p.allIn) {
      if (this.alive().length === 1) this.finish(false);
      else {
        p.folded = true; this.foldOrder.push(id); p.lastAction = 'ออกจากห้อง / Fold'; this.pending.delete(id);
        if (this.alive().length === 1) this.finish(false);
        else if (this.turnId === id) this.progress(id);
      }
    }
    this.changed();
  }
  snapshot(): PokerSnapshot {
    return { game: 'poker', code: this.code, phase: this.phase, roundId: this.roundId, deadline: this.deadline,
      hostId: this.hostId, buttonId: this.buttonId, turnId: this.turnId, smallBlindId: this.smallBlindId, bigBlindId: this.bigBlindId,
      smallBlind: this.smallBlind, bigBlind: this.bigBlind, currentBet: this.currentBet, minRaise: this.minRaise,
      turnDurationMs: this.timings.turn,
      roomClosing: this.roomClosing, closeAt: this.closeAt,
      raiseAllowedIds: this.actionable().filter(id => this.canRaise(this.players.get(id)!) && this.actionable().some(other => other !== id)),
      board: this.board.map(c => ({ ...c })), players: [...this.players.values()].map(({ expired, seen, ...p }) => ({ ...p })),
      pot: this.settled ? this.pots.reduce((sum, p) => sum + p.amount, 0) : [...this.players.values()].reduce((sum, p) => sum + p.contribution, 0),
      pots: (this.settled ? this.pots : pokerLivePots([...this.players.values()])).map(p => ({ ...p, winners: [...p.winners], eligible: [...p.eligible] })),
      results: this.results.map(r => ({ ...r, cards: r.cards.map(c => ({ ...c })) })) };
  }
  action(id: string, raw: unknown) {
    const p = this.players.get(id); demand(p?.connected && !p.expired, 'ไม่พบผู้เล่นที่เชื่อมต่อ');
    demand(raw && typeof raw === 'object' && !Array.isArray(raw), 'คำสั่งไม่ถูกต้อง');
    const a = raw as { type: string; roundId: number; actionId: string; value?: unknown };
    demand(Number.isInteger(a.roundId) && a.roundId === this.roundId && typeof a.actionId === 'string'
      && /^[a-zA-Z0-9-]{1,80}$/.test(a.actionId), 'คำสั่งไม่ถูกต้องหรือเป็นรอบเก่า');
    if (p!.seen.has(a.actionId)) return;
    demand(p!.seen.size < 2048, 'ส่งคำสั่งมากเกินไป');
    if (a.type === 'closeRoom') {
      demand(id === this.hostId, 'เฉพาะ host เท่านั้น'); demand(a.value === undefined, 'คำสั่งปิดห้องไม่ถูกต้อง');
      this.roomClosing = true;
      if (this.idle() && !this.closeAt) this.closeAt = Date.now() + this.closeDelayMs;
    } else if (a.type === 'showCards') {
      demand(this.phase === 'ROUND_END', 'เปิดไพ่ได้หลังจบรอบเท่านั้น');
      demand(this.pots.some(pot => !pot.refund && pot.winners.includes(id)), 'เฉพาะผู้ชนะกองเดิมพันเท่านั้น');
      demand(a.value === undefined, 'เปิดได้เฉพาะไพ่ของตัวเอง');
      const result = this.results.find(r => r.id === id);
      demand(result && this.hands[id]?.length === 2, 'ไม่มีไพ่ของรอบนี้');
      result!.cards = this.hands[id].map(card => ({ ...card }));
    } else if (['setReady', 'startRound', 'prepareRound', 'addBot', 'removeBot', 'resetTablePoints'].includes(a.type)) {
      demand(!this.roomClosing, 'ห้องกำลังปิด ไม่สามารถเริ่มหรือจัดการรอบใหม่');
      demand(this.idle(), 'เปลี่ยนได้ก่อนเริ่มรอบเท่านั้น');
      if (a.type === 'setReady') { demand(typeof a.value === 'boolean', 'สถานะพร้อมไม่ถูกต้อง'); p!.ready = a.value as boolean; }
      else {
        demand(id === this.hostId, 'เฉพาะผู้สร้างห้องเท่านั้น');
        if (a.type === 'startRound') this.start();
        else if (a.type === 'prepareRound') {
          demand(this.phase === 'ROUND_END', 'รอรอบจบก่อน'); this.clearTimers(); this.phase = 'LOBBY'; this.hands = {}; this.board = []; this.results = []; this.pots = [];
          for (const player of this.players.values()) {
            player.ready = player.isBot; player.inHand = false; player.folded = false; player.allIn = false;
            player.contribution = 0; player.streetBet = 0; player.lastAction = '';
            this.hooks.privateHand(player.id, []);
          }
        } else {
          demand(this.phase === 'LOBBY', 'จัดการโต๊ะได้ใน lobby เท่านั้น');
          if (a.type === 'addBot') this.addBot();
          else if (a.type === 'removeBot') {
            demand(typeof a.value === 'string' && this.players.get(a.value)?.isBot, 'เลือกบอทที่จะนำออก'); this.players.delete(a.value as string);
          } else for (const player of this.players.values()) player.points = 1000;
          for (const player of this.players.values()) player.ready = player.isBot;
        }
      }
    } else {
      demand(['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(this.phase) && this.turnId === id && Date.now() < this.deadline, 'ยังไม่ถึงตาของคุณ');
      this.betAction(p!, a.type, a.value);
    }
    p!.seen.add(a.actionId); this.changed();
  }
  private next(after: string, ids = this.order): string {
    const index = this.order.indexOf(after);
    for (let step = 1; step <= this.order.length; step++) {
      const id = this.order[(index + step + this.order.length) % this.order.length];
      if (ids.includes(id)) return id;
    }
    return '';
  }
  private start() {
    const all = [...this.players.values()].sort((a, b) => a.seat - b.seat);
    demand(all.every(p => p.connected && !p.expired), 'รอผู้เล่นเชื่อมต่อ');
    const eligible = all.filter(p => p.points > 0);
    demand(eligible.length >= 2, 'ต้องมีผู้เล่นที่มีชิปอย่างน้อย 2 คน รีเซ็ตแต้มได้ใน lobby');
    demand(eligible.every(p => p.id === this.hostId || p.ready), 'รอผู้เล่นกดพร้อม');
    // Move button to the next funded seat, preserving seat ordering even after departures.
    const button = eligible.find(p => p.seat > this.buttonSeat) ?? eligible[0];
    this.buttonId = button.id; this.buttonSeat = button.seat;
    this.order = eligible.map(p => p.id);
    this.roundId++; this.settled = false; this.foldOrder = []; this.hands = {}; this.board = []; this.results = []; this.pots = [];
    this.stock = shuffle(deck(), this.random); this.pending.clear(); this.actedAt.clear();
    for (const p of all) {
      p.inHand = p.points > 0; p.folded = false; p.allIn = false; p.ready = false;
      p.streetBet = 0; p.contribution = 0; p.lastAction = ''; p.seen.clear();
      this.hands[p.id] = [];
    }
    const dealOrder = [...this.order.slice(this.order.indexOf(this.buttonId) + 1), ...this.order.slice(0, this.order.indexOf(this.buttonId) + 1)];
    for (let pass = 0; pass < 2; pass++) for (const id of dealOrder) this.hands[id].push(this.stock.pop()!);
    for (const p of all) this.hooks.privateHand(p.id, this.hands[p.id]);
    this.smallBlindId = eligible.length === 2 ? this.buttonId : this.next(this.buttonId);
    this.bigBlindId = this.next(this.smallBlindId);
    this.commit(this.players.get(this.smallBlindId)!, this.smallBlind);
    this.commit(this.players.get(this.bigBlindId)!, this.bigBlind);
    this.players.get(this.smallBlindId)!.lastAction = 'Small blind'; this.players.get(this.bigBlindId)!.lastAction = 'Big blind';
    this.currentBet = this.bigBlind; this.minRaise = this.bigBlind; this.turnId = ''; this.phase = 'DEALING';
    this.later(this.timings.deal, () => {
      this.phase = 'PREFLOP'; this.pending = new Set(this.actionable());
      this.progress(this.bigBlindId);
    });
  }
  private commit(p: Player, amount: number) {
    const paid = Math.min(p.points, amount); p.points -= paid; p.streetBet += paid; p.contribution += paid; p.allIn = p.points === 0;
  }
  private alive() { return this.order.filter(id => this.players.get(id)?.inHand && !this.players.get(id)!.folded); }
  private actionable() { return this.alive().filter(id => !this.players.get(id)!.allIn); }
  private canRaise(p: Player) {
    const acted = this.actedAt.get(p.id);
    return acted === undefined || (acted === 0 && this.currentBet > 0) || this.currentBet - acted >= this.minRaise;
  }
  private betAction(p: Player, type: string, value?: unknown) {
    const call = Math.max(0, this.currentBet - p.streetBet);
    if (type === 'fold') { p.folded = true; this.foldOrder.push(p.id); p.lastAction = 'Fold'; }
    else if (type === 'check') { demand(call === 0, 'Check ไม่ได้ ต้อง Call หรือ Fold'); p.lastAction = 'Check'; }
    else if (type === 'call') { demand(call > 0, 'ไม่มีเดิมพันให้ Call'); this.commit(p, call); p.lastAction = p.allIn ? 'All-in call' : 'Call'; }
    else if (type === 'raise' || type === 'allIn') {
      const target = type === 'allIn' ? p.streetBet + p.points : value;
      demand(typeof target === 'number' && Number.isSafeInteger(target) && target > p.streetBet && target <= p.streetBet + p.points, 'จำนวนชิปไม่ถูกต้อง');
      if ((target as number) <= this.currentBet) {
        demand(type === 'allIn', 'Raise ต้องสูงกว่าเดิมพันปัจจุบัน'); this.commit(p, (target as number) - p.streetBet); p.lastAction = 'All-in call';
      } else {
        demand(this.actionable().some(id => id !== p.id), 'ไม่มีผู้เล่นที่สามารถรับ Raise ได้');
        demand(this.canRaise(p), 'Short all-in ยังไม่เปิดสิทธิ์ Raise ใหม่');
        const increase = (target as number) - this.currentBet;
        demand(increase >= this.minRaise || target === p.streetBet + p.points, 'Raise ต่ำกว่าขั้นต่ำ');
        this.commit(p, (target as number) - p.streetBet);
        this.currentBet = target as number;
        if (increase >= this.minRaise) this.minRaise = increase;
        // Everyone below the new price must respond, but short all-ins preserve raise rights.
        for (const id of this.actionable()) if (id !== p.id && this.players.get(id)!.streetBet < this.currentBet) this.pending.add(id);
        p.lastAction = p.allIn ? 'All-in' : 'Raise';
      }
    } else throw new GameError('UNKNOWN_ACTION', 'ไม่รู้จักคำสั่ง');
    this.actedAt.set(p.id, this.currentBet); this.pending.delete(p.id); this.progress(p.id);
  }
  private progress(after: string) {
    this.clearTimers(); this.turnId = ''; this.deadline = 0;
    if (this.alive().length === 1) { this.finish(false); return; }
    const actionable = this.actionable();
    for (const id of this.pending) if (!actionable.includes(id)) this.pending.delete(id);
    if (actionable.length === 1) {
      const id = actionable[0];
      this.currentBet = Math.min(this.currentBet, Math.max(...this.alive().map(alive => this.players.get(alive)!.streetBet)));
      if (this.players.get(id)!.streetBet >= this.currentBet) this.pending.delete(id);
    }
    if (!this.pending.size) { this.nextStreet(); return; }
    this.turnId = this.next(after, [...this.pending]); this.deadline = Date.now() + this.timings.turn;
    const p = this.players.get(this.turnId)!;
    this.timer = setTimeout(() => {
      this.betAction(p, p.streetBet >= this.currentBet ? 'check' : 'fold'); this.changed();
    }, this.timings.turn);
    if (p.isBot) this.botTimer = setTimeout(() => {
      // Conservative bot. It uses only its hole cards, visible board and public price.
      const toCall = Math.max(0, this.currentBet - p.streetBet);
      const hand = this.hands[p.id];
      const strong = this.board.length >= 3 ? bestPokerHand([...hand, ...this.board]).rank >= 1
        : hand[0].rank === hand[1].rank || hand.some(c => c.rank === 1 || c.rank >= 11);
      this.betAction(p, toCall === 0 ? 'check' : strong || toCall <= this.bigBlind * 2 ? 'call' : 'fold'); this.changed();
    }, Math.min(this.timings.bot, Math.floor(this.timings.turn / 2)));
    this.changed();
  }
  private nextStreet() {
    if (this.phase === 'RIVER') { this.finish(true); return; }
    const next: Record<string, PokerPhase> = { PREFLOP: 'FLOP', FLOP: 'TURN', TURN: 'RIVER' };
    const nextPhase = next[this.phase]; demand(nextPhase, 'สถานะเกมผิด');
    this.phase = nextPhase; this.stock.pop(); // Burn one card on every street.
    const count = nextPhase === 'FLOP' ? 3 : 1;
    for (let n = 0; n < count; n++) this.board.push(this.stock.pop()!);
    for (const p of this.players.values()) p.streetBet = 0;
    this.currentBet = 0; this.minRaise = this.bigBlind; this.actedAt.clear(); this.pending = new Set(this.actionable());
    // Pause before actions/runout so board cards can animate distinctly.
    this.later(this.timings.reveal, () => this.progress(this.buttonId));
  }
  private finish(showdown: boolean) {
    if (this.settled) return;
    this.clearTimers(); this.turnId = ''; this.deadline = 0;
    const hands: Record<string, PokerHand> = {};
    if (showdown) for (const id of this.alive()) hands[id] = bestPokerHand([...this.hands[id], ...this.board]);
    const clockwise = [...this.order.slice(this.order.indexOf(this.buttonId) + 1), ...this.order.slice(0, this.order.indexOf(this.buttonId) + 1)];
    const { payouts, pots } = pokerPayout(Object.fromEntries(this.order.map(id => [id, this.players.get(id)!.contribution])),
      new Set(this.order.filter(id => this.players.get(id)!.folded)), hands, clockwise, this.foldOrder);
    this.pots = pots;
    this.results = this.order.map(id => {
      const p = this.players.get(id)!; p.points += payouts[id];
      return { id, name: p.name, cards: showdown && !p.folded ? [...this.hands[id]] : [], handName: p.folded ? 'Fold' : showdown ? hands[id].name : 'ชนะโดยไม่ต้องเปิดไพ่',
        payout: payouts[id], delta: payouts[id] - p.contribution };
    });
    this.settled = true; this.phase = 'SHOWDOWN';
    this.later(this.timings.reveal, () => {
      this.phase = 'ROUND_END'; this.deadline = 0;
      if (this.roomClosing) this.closeAt = Date.now() + this.closeDelayMs;
      for (const p of this.players.values()) {
        if (p.expired) this.players.delete(p.id); else { p.ready = p.isBot; p.seen.clear(); }
      }
      this.reassign(); this.changed();
    });
  }
  private later(ms: number, fn: () => void) {
    this.clearTimers(); this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => { this.deadline = 0; fn(); this.changed(); }, ms); this.changed();
  }
  private clearTimers() { if (this.timer) clearTimeout(this.timer); if (this.botTimer) clearTimeout(this.botTimer); }
  dispose() { this.clearTimers(); }
}
