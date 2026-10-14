import { randomInt, randomUUID } from 'node:crypto';
import { botDecision } from './bot.js';
import { DEFAULT_RULES, deck, shuffle, evaluate, makeLedger, applyLedger } from '../../../packages/shared/src/index.js';
import type { Card, Phase, PlayerView, Snapshot, RoomRules, Action, Result, RoundLedger } from '../../../packages/shared/src/index.js';

export class GameError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
function requireCondition(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new GameError(code, message);
}
interface Player extends PlayerView { expired: boolean; seen: Set<string> }
const copyResult = (r: Result): Result => ({ ...r, cards: r.cards.map(c => ({ ...c })),
  ...(r.dealerCards ? { dealerCards: r.dealerCards.map(c => ({ ...c })) } : {}),
  ...(r.dealerValue ? { dealerValue: { ...r.dealerValue } } : {}) });
export interface GameHooks { changed(): void; privateHand(id: string, cards: Card[]): void }

// Framework independent state machine. Only intentionally revealed hands are public.
export class Game {
  players = new Map<string, Player>();
  phase: Phase = 'LOBBY'; roundId = 0; deadline = 0; hostId = ''; dealerId = '';
  private hands: Record<string, Card[]> = {};
  private stock: Card[] = [];
  private results: Result[] = [];
  private catches = new Map<string, Result>();
  private ledger?: RoundLedger;
  private settledRounds = new Set<number>();
  private timer?: ReturnType<typeof setTimeout>;
  private botTimers = new Set<ReturnType<typeof setTimeout>>();
  constructor(public code: string, private hooks: GameHooks,
    public rules: RoomRules = { ...DEFAULT_RULES },
    private random: (max: number) => number = randomInt) {}

  add(name: unknown, id: string = randomUUID(), isBot = false): string {
    requireCondition(this.phase === 'LOBBY' || this.phase === 'ROUND_END', 'ROUND_ACTIVE', 'กรุณารอรอบนี้จบก่อน');
    requireCondition(this.players.size < this.rules.maxPlayers, 'ROOM_FULL', 'ห้องเต็มแล้ว');
    requireCondition(typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 20, 'INVALID_NAME', 'ชื่อยาว 1–20 ตัวอักษร');
    requireCondition(!this.players.has(id), 'DUPLICATE_PLAYER', 'ผู้เล่นนี้อยู่ในห้องแล้ว');
    const seat = Array.from({ length: this.rules.maxPlayers }, (_, n) => n).find(n => ![...this.players.values()].some(p => p.seat === n))!;
    this.players.set(id, { id, name: name.trim(), seat, points: this.rules.initialPoints, isBot,
      bet: this.rules.bets[0], ready: isBot, connected: true, acted: false, cardCount: 0, expired: false, seen: new Set() });
    if (!this.hostId && !isBot) this.hostId = id;
    if (!this.dealerId) this.dealerId = id;
    this.hooks.changed();
    return id;
  }
  addBot(): string {
    const names = ['บอทมะลิ', 'บอทใบชา', 'บอทข้าวปั้น', 'บอทสายลม', 'บอทดาว'];
    const name = names.find(name => ![...this.players.values()].some(p => p.isBot && p.name === name)) ?? 'บอท';
    return this.add(name, `bot-${randomUUID()}`, true);
  }
  private idle() { return this.phase === 'LOBBY' || this.phase === 'ROUND_END'; }
  disconnect(id: string) {
    const p = this.players.get(id); if (!p) return;
    p.connected = false; p.ready = false;
    if (this.idle()) this.reassign();
    this.hooks.changed();
  }
  reconnect(id: string) {
    const p = this.players.get(id);
    requireCondition(p && !p.expired, 'SESSION_EXPIRED', 'หมดเวลาเชื่อมต่อใหม่แล้ว');
    p.connected = true;
    if (!this.hostId) this.hostId = id;
    if (!this.dealerId) this.dealerId = id;
    this.hooks.privateHand(id, this.hands[id] ?? []);
    this.hooks.changed();
  }
  expire(id: string) {
    const p = this.players.get(id); if (!p) return;
    p.connected = false; p.expired = true; p.ready = false;
    if (this.idle()) { this.players.delete(id); this.reassign(); }
    this.hooks.changed();
  }
  private reassign() {
    const connected = [...this.players.values()].filter(p => p.connected && !p.expired);
    if (!connected.some(p => p.id === this.hostId && !p.isBot)) this.hostId = connected.find(p => !p.isBot)?.id ?? '';
    if (!connected.some(p => p.id === this.dealerId)) this.dealerId = connected[0]?.id ?? '';
  }
  snapshot(): Snapshot {
    return { code: this.code, phase: this.phase, roundId: this.roundId, deadline: this.deadline,
      hostId: this.hostId, dealerId: this.dealerId,
      players: [...this.players.values()].map(({ expired, seen, ...p }) => ({ ...p })),
      results: this.results.map(copyResult), catches: [...this.catches.values()].map(copyResult),
      revealedHands: Object.entries(this.hands).filter(([id, cards]) => id !== this.dealerId && cards.length === 2 && evaluate(cards, this.rules).pok)
        .map(([id, cards]) => ({ id, cards: cards.map(c => ({ ...c })), ...evaluate(cards, this.rules) })),
      rules: { ...this.rules }, settled: this.settledRounds.has(this.roundId) };
  }
  action(id: string, raw: unknown) {
    const p = this.players.get(id);
    requireCondition(p?.connected && !p.expired, 'NO_PLAYER', 'ไม่พบผู้เล่นที่เชื่อมต่อ');
    requireCondition(raw && typeof raw === 'object' && !Array.isArray(raw), 'INVALID_ACTION', 'คำสั่งไม่ถูกต้อง');
    const a = raw as Action;
    requireCondition(typeof a.actionId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(a.actionId)
      && Number.isInteger(a.roundId) && typeof a.type === 'string', 'INVALID_ACTION', 'คำสั่งไม่ถูกต้อง');
    requireCondition(a.roundId === this.roundId, 'STALE_ROUND', 'คำสั่งมาจากรอบเก่า');
    if (p.seen.has(a.actionId)) return;
    // Limit retained action identifiers independently of the transport rate limit.
    requireCondition(p.seen.size < 2048, 'ACTION_LIMIT', 'ส่งคำสั่งมากเกินไป กรุณารอรอบใหม่');
    if (['setReady', 'setBet', 'selectDealer', 'startRound', 'prepareRound', 'resetTablePoints', 'addBot', 'removeBot'].includes(a.type)) {
      requireCondition(this.idle(), 'WRONG_PHASE', 'เปลี่ยนได้ก่อนเริ่มรอบเท่านั้น');
      if (a.type === 'setReady') {
        requireCondition(typeof a.value === 'boolean', 'INVALID_VALUE', 'สถานะพร้อมไม่ถูกต้อง'); p.ready = a.value;
      } else if (a.type === 'setBet') {
        requireCondition(p.id !== this.dealerId && typeof a.value === 'number' && this.rules.bets.includes(a.value), 'INVALID_BET', 'เลือกเดิมพัน 10, 20 หรือ 50');
        p.bet = a.value; p.ready = false;
      } else {
        requireCondition(p.id === this.hostId, 'NOT_HOST', 'เฉพาะผู้สร้างห้องเท่านั้น');
        if (a.type === 'addBot' || a.type === 'removeBot') {
          requireCondition(this.phase === 'LOBBY', 'WRONG_PHASE', 'จัดการบอทได้ใน lobby เท่านั้น');
          if (a.type === 'addBot') this.addBot();
          else {
            requireCondition(typeof a.value === 'string' && this.players.get(a.value)?.isBot, 'INVALID_BOT', 'เลือกบอทที่ต้องการนำออก');
            this.players.delete(a.value); this.reassign();
          }
          for (const player of this.players.values()) player.ready = player.isBot;
        } else if (a.type === 'selectDealer') {
          requireCondition(typeof a.value === 'string' && this.players.get(a.value)?.connected, 'INVALID_DEALER', 'เลือกเจ้ามือที่เชื่อมต่อ');
          this.dealerId = a.value;
          for (const player of this.players.values()) player.ready = player.isBot;
        } else if (a.type === 'prepareRound') {
          requireCondition(this.phase === 'ROUND_END', 'WRONG_PHASE', 'รอรอบจบก่อน');
          this.phase = 'LOBBY'; this.results = []; this.catches.clear(); this.hands = {}; this.ledger = undefined;
          for (const player of this.players.values()) {
            player.ready = player.isBot; player.acted = false; player.cardCount = 0;
            this.hooks.privateHand(player.id, []);
          }
        } else if (a.type === 'resetTablePoints') {
          requireCondition(this.phase === 'LOBBY', 'WRONG_PHASE', 'รีเซ็ตแต้มได้ใน lobby เท่านั้น');
          for (const player of this.players.values()) { player.points = this.rules.initialPoints; player.ready = player.isBot; }
        } else { this.start(); }
      }
    } else if (a.type === 'catch') {
      requireCondition(this.phase === 'DEALER_ACTION' && id === this.dealerId, 'WRONG_PHASE', 'เฉพาะเจ้ามือจับได้ในตาเจ้ามือ');
      requireCondition(Date.now() < this.deadline, 'TIMEOUT', 'หมดเวลาตัดสินใจ');
      requireCondition(!p.acted && this.hands[id]?.length === 2 && !evaluate(this.hands[id], this.rules).pok, 'CANNOT_CATCH', 'จับได้ก่อนเจ้ามือจั่วหรืออยู่เท่านั้น');
      requireCondition(typeof a.value === 'string' && a.value !== id && this.players.has(a.value) && this.hands[a.value]?.length === 3, 'INVALID_CATCH', 'เลือกผู้เล่นที่มีไพ่ 3 ใบ');
      requireCondition(!this.catches.has(a.value), 'ALREADY_CAUGHT', 'ผู้เล่นนี้ถูกจับแล้ว');
      const dealerCards = this.hands[id].map(c => ({ ...c }));
      const { results } = makeLedger(this.roundId, id, { [id]: dealerCards, [a.value]: this.hands[a.value] },
        { [a.value]: this.players.get(a.value)!.bet }, this.rules, { [a.value]: dealerCards });
      this.catches.set(a.value, results.find(r => r.id === a.value)!);
      if (this.catches.size === this.players.size - 1) { p.acted = true; this.reveal(); }
      else this.beginDealerAction();
    } else if (a.type === 'draw' || a.type === 'stand') {
      requireCondition((this.phase === 'PLAYER_ACTIONS' && id !== this.dealerId)
        || (this.phase === 'DEALER_ACTION' && id === this.dealerId), 'WRONG_PHASE', 'ยังไม่ถึงจังหวะเล่นของคุณ');
      requireCondition(Date.now() < this.deadline, 'TIMEOUT', 'หมดเวลาตัดสินใจ');
      requireCondition(!p.acted && !evaluate(this.hands[id], this.rules).pok, 'ALREADY_ACTED', 'ตัดสินใจแล้ว หรือมีป๊อก');
      if (a.type === 'draw') {
        requireCondition(this.hands[id].length === 2 && this.stock.length > 0, 'CANNOT_DRAW', 'จั่วเพิ่มไม่ได้');
        this.hands[id].push(this.stock.pop()!); p.cardCount = this.hands[id].length;
        this.hooks.privateHand(id, this.hands[id]);
      }
      p.acted = true; this.advanceActions();
    } else throw new GameError('UNKNOWN_ACTION', 'ไม่รู้จักคำสั่ง');
    p.seen.add(a.actionId); this.hooks.changed();
  }
  private start() {
    const players = [...this.players.values()];
    requireCondition(players.length >= 2 && players.every(p => p.connected && !p.expired), 'NOT_ENOUGH_PLAYERS', 'ต้องมีผู้เล่นที่เชื่อมต่ออย่างน้อย 2 คน และไม่มีผู้เล่นหลุด');
    const dealer = this.players.get(this.dealerId)!;
    requireCondition(dealer && players.every(p => p.id === this.hostId || p.ready), 'NOT_READY', 'รอผู้เล่นทุกคนกดพร้อม');
    const maxMultiplier = Math.max(1, this.rules.pairMultiplier, this.rules.suitedTwoMultiplier, this.rules.suitedThreeMultiplier,
      this.rules.yellowMultiplier, this.rules.tripleMultiplier, this.rules.straightMultiplier, this.rules.straightFlushMultiplier);
    requireCondition(players.filter(p => p !== dealer).every(p => p.points >= p.bet * maxMultiplier), 'INSUFFICIENT_POINTS', 'ผู้เล่นมีแต้มไม่พอรับความเสียหายสูงสุด');
    requireCondition(dealer.points >= players.filter(p => p !== dealer).reduce((sum, p) => sum + p.bet * maxMultiplier, 0), 'DEALER_POINTS', 'เจ้ามือมีแต้มไม่พอรองรับเด้งสูงสุด ×' + maxMultiplier + ' กรุณาลดเดิมพันหรือเปลี่ยนเจ้ามือ');
    this.roundId++; this.results = []; this.catches.clear(); this.ledger = undefined; this.hands = {};
    this.stock = shuffle(deck(), this.random);
    for (const p of players) { this.hands[p.id] = []; p.seen.clear(); p.ready = false; p.acted = false; }
    for (let pass = 0; pass < 2; pass++) for (const p of players) this.hands[p.id].push(this.stock.pop()!);
    for (const p of players) {
      p.cardCount = 2; p.acted = evaluate(this.hands[p.id], this.rules).pok;
      this.hooks.privateHand(p.id, this.hands[p.id]);
    }
    this.phaseFor('DEALING', this.rules.dealMs, () => {
      if (evaluate(this.hands[this.dealerId], this.rules).pok) this.reveal();
      else {
        this.phaseFor('PLAYER_ACTIONS', this.rules.actionMs, () => {
          for (const p of this.players.values()) if (p.id !== this.dealerId) p.acted = true;
          this.advanceActions();
        });
        this.advanceActions();
      }
    });
  }
  private advanceActions() {
    if (this.phase === 'PLAYER_ACTIONS' && [...this.players.values()].filter(p => p.id !== this.dealerId).every(p => p.acted)) {
      this.beginDealerAction();
    } else if (this.phase === 'DEALER_ACTION' && this.players.get(this.dealerId)!.acted) this.reveal();
  }
  private beginDealerAction() {
    this.phaseFor('DEALER_ACTION', this.rules.actionMs, () => {
      this.players.get(this.dealerId)!.acted = true; this.reveal();
    });
  }
  private reveal() {
    const { ledger, results } = makeLedger(this.roundId, this.dealerId, this.hands,
      Object.fromEntries([...this.players.values()].map(p => [p.id, p.bet])), this.rules,
      Object.fromEntries([...this.catches].map(([id, result]) => [id, result.dealerCards!])));
    this.ledger = ledger; this.results = results;
    for (const result of results) if (result.caught) this.catches.set(result.id, copyResult(result));
    this.phaseFor('REVEAL', this.rules.revealMs, () => {
      const balances = applyLedger(Object.fromEntries([...this.players.values()].map(p => [p.id, p.points])), this.ledger!, this.settledRounds);
      for (const p of this.players.values()) p.points = balances[p.id];
      // Only the current round needs to remain in the idempotency set.
      for (const round of this.settledRounds) if (round !== this.roundId) this.settledRounds.delete(round);
      this.phaseFor('SETTLEMENT', this.rules.settlementMs, () => {
        this.phase = 'ROUND_END'; this.deadline = 0;
        for (const p of this.players.values()) {
          if (p.expired) this.players.delete(p.id);
          else { p.seen.clear(); p.ready = p.isBot; }
        }
        this.reassign(); this.hooks.changed();
      });
    });
  }
  private phaseFor(phase: Phase, ms: number, next: () => void) {
    if (this.timer) clearTimeout(this.timer);
    this.clearBotTimers();
    this.phase = phase; this.deadline = Date.now() + ms;
    this.timer = setTimeout(next, ms); this.hooks.changed();
    if (phase === 'PLAYER_ACTIONS' || phase === 'DEALER_ACTION') {
      const round = this.roundId;
      const bots = [...this.players.values()].filter(p => p.isBot && !p.acted
        && (phase === 'PLAYER_ACTIONS' ? p.id !== this.dealerId : p.id === this.dealerId));
      bots.forEach((bot, index) => {
        const timer = setTimeout(() => {
          this.botTimers.delete(timer);
          if (this.roundId !== round || this.phase !== phase || bot.acted) return;
          this.action(bot.id, { actionId: randomUUID(), roundId: round,
            type: botDecision(this.hands[bot.id], this.rules) });
        }, Math.min(650 + index * 180, Math.max(1, Math.floor(ms / 2))));
        this.botTimers.add(timer);
      });
    }
  }
  private clearBotTimers() { for (const timer of this.botTimers) clearTimeout(timer); this.botTimers.clear(); }
  dispose() { if (this.timer) clearTimeout(this.timer); this.clearBotTimers(); }
}
