import { randomInt, randomUUID } from 'node:crypto';
import { SPY_QUESTION_MINUTES, SPY_TURN_MINUTES, SPY_PLAYER_COUNTS, SPY_VOTING_MS, SPY_GUESS_MS } from '../../../packages/shared/src/spyfall.js';
import type { SpyPlayer, SpyRole, SpySecret, SpySnapshot, SpyPhase, SpyResult, ChatMessage } from '../../../packages/shared/src/spyfall.js';
import { SPY_LOCATIONS, normalizeLocation } from './spyfall-locations.js';
import { GameError } from './game.js';
const demand = (ok: unknown, message: string) => { if (!ok) throw new GameError('INVALID_ACTION', message); };
interface Player extends SpyPlayer { expired: boolean; seen: Set<string>; chatTimes: number[] }
export interface SpyHooks { changed(): void; secret(id: string, data: SpySecret): void }
export class SpyfallGame {
  players = new Map<string, Player>(); phase: SpyPhase = 'LOBBY'; roundId = 0; deadline = 0; hostId = '';
  questionMinutes = 5; votingMinutes = 1; guessMinutes = 1; playerCount = 8; private phaseDurationMs = 0;
  private participants: string[] = []; private spyId = ''; private locationIndex = -1;
  private roles = new Map<string, SpyRole>(); private votes = new Map<string, string>();
  private chat: ChatMessage[] = []; private result: SpyResult | null = null;
  private timer?: ReturnType<typeof setTimeout>; private settled = false;
  constructor(public code: string, private hooks: SpyHooks, private random: (max: number) => number = randomInt,
    public timings = { minute: 60_000, voting: SPY_VOTING_MS, guess: SPY_GUESS_MS }) {}
  private idle() { return this.phase === 'LOBBY' || this.phase === 'RESULTS'; }
  add(name: unknown, id: string = randomUUID()) {
    demand(this.idle(), 'รอรอบนี้จบก่อน'); demand(this.players.size < this.playerCount, `ห้องเต็มแล้ว (สูงสุด ${this.playerCount} คน)`);
    demand(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 20, 'ชื่อยาว 1–20 ตัวอักษร');
    demand(!this.players.has(id), 'ผู้เล่นนี้อยู่ในห้องแล้ว');
    const seat = Array.from({ length: 8 }, (_, i) => i).find(i => ![...this.players.values()].some(p => p.seat === i))!;
    this.players.set(id, { id, name: (name as string).trim(), seat, connected: true, ready: false, readyVote: false,
      hasVoted: false, score: 0, expired: false, seen: new Set(), chatTimes: [] });
    if (!this.hostId) this.hostId = id;
    this.changed(); return id;
  }
  private changed() { this.hooks.changed(); }
  private reassign() { if (!this.players.get(this.hostId)?.connected) this.hostId = [...this.players.values()].find(p => p.connected)?.id ?? ''; }
  disconnect(id: string) { const p = this.players.get(id); if (!p) return; p.connected = false; p.ready = false; this.reassign(); this.changed(); }
  sync(id: string) { const p = this.players.get(id); demand(p && !p.expired, 'หมดเวลา reconnect'); this.sendSecret(id); }
  reconnect(id: string) {
    const p = this.players.get(id); demand(p && !p.expired, 'หมดเวลา reconnect'); p!.connected = true;
    if (!this.hostId) this.hostId = id; this.sendSecret(id); this.changed();
  }
  expire(id: string) {
    const p = this.players.get(id); if (!p) return; p.expired = true; p.connected = false;
    if (this.idle()) this.players.delete(id); this.reassign(); this.changed();
  }
  private sendSecret(id: string) {
    const role = this.roles.get(id);
    this.hooks.secret(id, { roundId: this.roundId, role: role ? { ...role, ownVote: this.votes.get(id) ?? null } : null });
  }
  snapshot(): SpySnapshot {
    return { game: 'spyfall', code: this.code, phase: this.phase, roundId: this.roundId, deadline: this.deadline,
      hostId: this.hostId, questionMinutes: this.questionMinutes, phaseDurationMs: this.phaseDurationMs,
      votingMinutes: this.votingMinutes, guessMinutes: this.guessMinutes, playerCount: this.playerCount,
      votingDurationMs: this.votingMinutes * this.timings.voting, guessDurationMs: this.guessMinutes * this.timings.guess,
      players: [...this.players.values()].map(({ expired, seen, chatTimes, ...p }) => ({ ...p })),
      chat: this.chat.map(m => ({ ...m })), caughtSpyId: this.phase === 'GUESS' ? this.spyId : null,
      result: this.result ? { ...this.result, votes: { ...this.result.votes }, tally: { ...this.result.tally } } : null };
  }
  action(id: string, raw: unknown) {
    const p = this.players.get(id); demand(p?.connected && !p.expired, 'ไม่พบผู้เล่นที่เชื่อมต่อ');
    demand(raw && typeof raw === 'object' && !Array.isArray(raw), 'คำสั่งไม่ถูกต้อง');
    const a = raw as { type: string; actionId: string; roundId: number; value?: unknown };
    demand(Number.isInteger(a.roundId) && a.roundId === this.roundId && typeof a.actionId === 'string'
      && /^[a-zA-Z0-9-]{1,80}$/.test(a.actionId), 'คำสั่งไม่ถูกต้องหรือมาจากรอบเก่า');
    if (p!.seen.has(a.actionId)) return;
    demand(p!.seen.size < 2048, 'ส่งคำสั่งมากเกินไป');
    if (a.type === 'chat') {
      demand(['LOBBY', 'QUESTION', 'VOTING', 'RESULTS'].includes(this.phase), 'พักแชตระหว่างสายลับตอบสถานที่');
      demand(typeof a.value === 'string' && a.value.trim().length >= 1 && a.value.trim().length <= 500, 'ข้อความยาว 1–500 ตัวอักษร');
      const now = Date.now(); p!.chatTimes = p!.chatTimes.filter(time => now - time < 5000);
      demand(p!.chatTimes.length < 3, 'ส่งแชตเร็วเกินไป รอสักครู่'); p!.chatTimes.push(now);
      this.chat.push({ id: randomUUID(), playerId: id, name: p!.name, text: (a.value as string).trim(), timestamp: now, roundId: this.roundId });
      if (this.chat.length > 100) this.chat.shift();
    } else if (['setReady','setQuestionMinutes','setVotingMinutes','setGuessMinutes','setPlayerCount','startRound','prepareRound'].includes(a.type)) {
      demand(this.idle(), 'ตั้งค่าได้ก่อนเริ่มรอบเท่านั้น');
      if (a.type === 'setReady') { demand(typeof a.value === 'boolean', 'สถานะพร้อมไม่ถูกต้อง'); p!.ready = a.value as boolean; }
      else {
        demand(id === this.hostId, 'เฉพาะผู้สร้างห้องเท่านั้น');
        if (a.type === 'setQuestionMinutes') {
          demand(typeof a.value === 'number' && SPY_QUESTION_MINUTES.some(value => value === a.value), 'เลือกเวลาถาม 5, 7 หรือ 10 นาที');
          this.questionMinutes = a.value as number; for (const player of this.players.values()) player.ready = false;
        } else if (a.type === 'setVotingMinutes' || a.type === 'setGuessMinutes') {
          demand(typeof a.value === 'number' && SPY_TURN_MINUTES.some(value => value === a.value), 'เลือกเวลา 1, 2 หรือ 3 นาที');
          if (a.type === 'setVotingMinutes') this.votingMinutes = a.value as number;
          else this.guessMinutes = a.value as number;
          for (const player of this.players.values()) player.ready = false;
        } else if (a.type === 'setPlayerCount') {
          demand(typeof a.value === 'number' && SPY_PLAYER_COUNTS.some(value => value === a.value), 'เลือกจำนวนผู้เล่นสูงสุด 3–8 คน');
          demand((a.value as number) >= this.players.size, 'จำนวนสูงสุดต้องไม่น้อยกว่าผู้เล่นที่อยู่ในห้อง');
          this.playerCount = a.value as number;
          for (const player of this.players.values()) player.ready = false;
        } else if (a.type === 'startRound') this.start();
        else {
          demand(this.phase === 'RESULTS', 'รอรอบจบก่อน'); this.clearTimer(); this.phase = 'LOBBY'; this.deadline = 0; this.phaseDurationMs = 0;
          this.result = null; this.roles.clear(); this.votes.clear(); this.chat = []; this.participants = []; this.spyId = ''; this.locationIndex = -1;
          for (const player of this.players.values()) { player.ready = false; player.readyVote = false; player.hasVoted = false; this.sendSecret(player.id); }
        }
      }
    } else if (a.type === 'readyVote') {
      demand(this.phase === 'QUESTION' && Date.now() < this.deadline && this.participants.includes(id), 'ยังไม่อยู่ในช่วงถาม');
      demand(typeof a.value === 'boolean', 'สถานะพร้อมโหวตไม่ถูกต้อง'); p!.readyVote = a.value as boolean;
      if (this.participants.every(pid => this.players.get(pid)!.readyVote)) this.beginVoting();
    } else if (a.type === 'vote') {
      demand(this.phase === 'VOTING' && Date.now() < this.deadline && this.participants.includes(id), 'ยังไม่อยู่ในช่วงโหวต');
      demand(!this.votes.has(id), 'ยืนยันโหวตแล้ว เปลี่ยนเสียงไม่ได้');
      demand(typeof a.value === 'string' && a.value !== id && this.participants.includes(a.value), 'เลือกผู้เล่นคนอื่นในรอบนี้');
      this.votes.set(id, a.value as string); p!.hasVoted = true; this.sendSecret(id);
      if (this.participants.every(pid => this.votes.has(pid))) this.resolveVote();
    } else if (a.type === 'surrender') {
      demand(this.phase === 'GUESS' && id === this.spyId && Date.now() < this.deadline,
        'เฉพาะสายลับที่ถูกจับเท่านั้นที่ยอมแพ้ได้ก่อนหมดเวลาตอบ');
      this.finish('citizens', 'spy_surrendered', this.spyId);
    } else if (a.type === 'guess') {
      demand((this.phase === 'QUESTION' || this.phase === 'GUESS') && id === this.spyId && Date.now() < this.deadline,
        'เฉพาะสายลับตอบได้ในช่วงสอบสวนหรือหลังโหวตจับได้');
      demand(typeof a.value === 'string' && a.value.trim().length > 0 && a.value.trim().length <= 80, 'พิมพ์สถานที่ 1–80 ตัวอักษร');
      const guess = (a.value as string).trim(); const correct = SPY_LOCATIONS[this.locationIndex].aliases.some(alias => normalizeLocation(alias) === normalizeLocation(guess));
      this.finish(correct ? 'spy' : 'citizens', correct ? 'correct_guess' : 'wrong_guess', this.phase === 'GUESS' ? this.spyId : null, guess);
    } else throw new GameError('UNKNOWN_ACTION', 'ไม่รู้จักคำสั่ง');
    p!.seen.add(a.actionId); this.changed();
  }
  private start() {
    const players = [...this.players.values()].sort((a,b) => a.seat - b.seat);
    demand(players.length >= 3 && players.length <= this.playerCount && players.every(p => p.connected && !p.expired), 'ต้องมีผู้เล่นที่เชื่อมต่อ 3–8 คน');
    demand(players.every(p => p.id === this.hostId || p.ready), 'รอทุกคนกดพร้อม');
    this.roundId++; this.settled = false; this.result = null; this.roles.clear(); this.votes.clear(); this.chat = [];
    this.participants = players.map(p => p.id); this.spyId = this.participants[this.random(players.length)];
    this.locationIndex = this.random(SPY_LOCATIONS.length); const location = SPY_LOCATIONS[this.locationIndex]; let roleIndex = 0;
    for (const p of players) {
      p.ready = false; p.readyVote = false; p.hasVoted = false; p.seen.clear(); p.chatTimes = [];
      this.roles.set(p.id, p.id === this.spyId ? { kind: 'spy', ownVote: null }
        : { kind: 'citizen', location: location.name, occupation: location.roles[roleIndex++ % location.roles.length], ownVote: null });
      this.sendSecret(p.id);
    }
    this.phaseFor('QUESTION', this.questionMinutes * this.timings.minute, () => this.beginVoting());
  }
  private beginVoting() { this.phaseFor('VOTING', this.votingMinutes * this.timings.voting, () => this.resolveVote()); }
  private tally() { const tally: Record<string, number> = {}; for (const target of this.votes.values()) tally[target] = (tally[target] ?? 0) + 1; return tally; }
  private resolveVote() {
    const tally = this.tally(); const accusedId = Object.keys(tally).find(id => tally[id] > this.participants.length / 2) ?? null;
    if (!accusedId) this.finish('spy', 'no_majority', null);
    else if (accusedId !== this.spyId) this.finish('spy', 'wrong_accusation', accusedId);
    else this.phaseFor('GUESS', this.guessMinutes * this.timings.guess, () => this.finish('citizens', 'guess_timeout', this.spyId));
  }
  private finish(winner: 'spy' | 'citizens', reason: SpyResult['reason'], accusedId: string | null, guess = '') {
    if (this.settled) return; this.settled = true; this.clearTimer(); this.phase = 'RESULTS'; this.deadline = 0; this.phaseDurationMs = 0;
    this.result = { winner, reason, spyId: this.spyId, location: SPY_LOCATIONS[this.locationIndex].name, guess, accusedId,
      votes: Object.fromEntries(this.participants.map(id => [id, this.votes.get(id) ?? null])), tally: this.tally() };
    for (const id of this.participants) {
      const p = this.players.get(id)!; if (winner === 'spy' ? id === this.spyId : id !== this.spyId) p.score++;
      if (p.expired) this.players.delete(id); else p.seen.clear();
    }
    this.reassign(); this.changed();
  }
  private phaseFor(phase: SpyPhase, duration: number, callback: () => void) {
    this.clearTimer(); this.phase = phase; this.phaseDurationMs = duration; this.deadline = Date.now() + duration;
    this.timer = setTimeout(callback, duration); this.changed();
  }
  private clearTimer() { if (this.timer) clearTimeout(this.timer); }
  dispose() { this.clearTimer(); }
}
