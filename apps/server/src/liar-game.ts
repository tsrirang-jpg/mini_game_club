import { joinMembership, canActInRound, admitWaitingPlayers } from '../../../packages/shared/src/room.js';
import { randomInt, randomUUID } from 'node:crypto';
import { deck, shuffle } from '../../../packages/shared/src/index.js';
import type { Card } from '../../../packages/shared/src/index.js';
import { LIAR_MAX_PLAYERS, LIAR_MIN_PLAYERS, LIAR_CHALLENGE_MS, liarPoints, liarRank, liarCardKey } from '../../../packages/shared/src/liar.js';
import type { LiarPlayer, LiarPhase, LiarLatest, LiarSnapshot, LiarActivity, LiarResult } from '../../../packages/shared/src/liar.js';
import { GameError } from './game.js';

const demand: (ok: unknown, message: string) => asserts ok = (ok, message) => { if (!ok) throw new GameError('INVALID_ACTION', message); };
interface Player extends LiarPlayer { hand: Card[]; expired: boolean; seen: Set<string> }
export interface LiarHooks { changed(): void; hand(id: string, data: {roundId: number; cards: Card[]}): void }

export class LiarGame {
  players = new Map<string, Player>();
  phase: LiarPhase = 'LOBBY'; roundId = 0; hostId = ''; turnId: string | null = null;
  turnNumber = 0; deadline = 0; requiredRank = 1; opening = true; skipCount = 0;
  private latest: LiarLatest | null = null;
  private pendingCard: Card | null = null;
  private discarded: Card[] = [];
  private history: LiarActivity[] = [];
  private result: LiarResult | null = null;
  private activityId = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  constructor(public code: string, private hooks: LiarHooks, private random = randomInt,
    public turnDurationMs = 30_000, public challengeMs = LIAR_CHALLENGE_MS, private revealMs = 2_500, private botDelayMs = 850) {}
  private ordered() { return [...this.players.values()].sort((a,b) => a.seat-b.seat); }
  private active() { return this.ordered().filter(p => p.hand.length > 0); }
  private clearTimers() { for (const t of this.timers) clearTimeout(t); this.timers.clear(); }
  private later(fn: () => void, delay: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, delay); this.timers.add(timer);
  }
  private changed() { this.hooks.changed(); }
  private hand(p: Player) { this.hooks.hand(p.id, {roundId: this.roundId, cards: p.hand.map(c => ({...c}))}); }
  private assignHost() {
    if (!this.players.get(this.hostId)?.connected) this.hostId = this.ordered().find(p => p.connected && !p.expired && !p.isBot)?.id ?? '';
  }
  add(name: unknown, id: string = randomUUID(), isBot = false) {
    demand(!isBot || this.phase === 'LOBBY' || this.phase === 'RESULTS', 'รอรอบนี้จบก่อน');
    demand(this.players.size < LIAR_MAX_PLAYERS, 'ห้องเต็มแล้ว (สูงสุด 6 คน)');
    demand(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 20, 'ชื่อยาว 1–20 ตัวอักษร');
    demand(!this.players.has(id), 'ผู้เล่นนี้อยู่ในห้องแล้ว');
    const seat = Array.from({length:LIAR_MAX_PLAYERS}, (_,i) => i).find(i => !this.ordered().some(p => p.seat === i))!;
    this.players.set(id, {...joinMembership(this.phase), id, name:name.trim(), seat, connected:true, ready:isBot, isBot, cardCount:0,
      finished:false, wins:0, hand:[], expired:false, seen:new Set()});
    if (!this.hostId && !isBot) this.hostId = id;
    this.changed(); return id;
  }
  addBot() {
    demand(this.phase === 'LOBBY', 'เพิ่มบอทได้ก่อนเริ่มรอบเท่านั้น');
    let n=1; while(this.ordered().some(p => p.name === `บอท ${n}`)) n++;
    return this.add(`บอท ${n}`, `bot-${randomUUID()}`, true);
  }
  sync(id: string) { const p=this.players.get(id); demand(p && !p.expired, 'หมดเวลา reconnect'); this.hand(p); }
  disconnect(id: string) { const p=this.players.get(id); if (!p) return; p.connected=false; p.ready=false; this.assignHost(); this.changed(); }
  reconnect(id: string) { const p=this.players.get(id); demand(p && !p.expired, 'หมดเวลา reconnect'); p.connected=true; if(!this.hostId)this.hostId=id; this.hand(p); this.changed(); }
  expire(id: string) {
    const p=this.players.get(id); if(!p)return; p.expired=true; p.connected=false;
    if(this.phase==='LOBBY'||this.phase==='RESULTS'||p.waiting)this.players.delete(id);
    // Keep dealt cards conserved. Expired seats automatically skip (or open A♣).
    else if(this.phase==='PLAYING'&&this.turnId===id)this.scheduleTurn();
    this.assignHost(); this.changed();
  }
  snapshot(): LiarSnapshot {
    return {game:'liar', code:this.code, roundId:this.roundId, phase:this.phase, hostId:this.hostId,
      players:this.ordered().map(({hand,expired,seen,...p}) => ({...p,cardCount:hand.length})),
      turnId:this.turnId, turnNumber:this.turnNumber, requiredRank:this.requiredRank, opening:this.opening,
      deadline:this.deadline, turnDurationMs:this.turnDurationMs, challengeMs:this.challengeMs,
      skipCount:this.skipCount, activeCount:this.active().length, discardedCount:this.discarded.length,
      latest:this.latest?structuredClone(this.latest):null, history:structuredClone(this.history), result:this.result?structuredClone(this.result):null};
  }
  action(id: string, raw: unknown) {
    const p=this.players.get(id); demand(p?.connected && !p.expired, 'ไม่พบผู้เล่นที่เชื่อมต่อ');
    demand(canActInRound(p, this.phase), 'คุณกำลังรอเข้าร่วมรอบถัดไป');
    demand(raw && typeof raw==='object' && !Array.isArray(raw), 'คำสั่งไม่ถูกต้อง');
    const a=raw as {type:string; actionId:string; roundId:number; value?:unknown};
    demand(Number.isInteger(a.roundId) && a.roundId===this.roundId && typeof a.actionId==='string' && /^[a-zA-Z0-9-]{1,80}$/.test(a.actionId), 'คำสั่งไม่ถูกต้องหรือมาจากรอบเก่า');
    if(p.seen.has(a.actionId))return;
    demand(p.seen.size<2048, 'ส่งคำสั่งมากเกินไป');
    if(a.type==='play'||a.type==='skip') {
      demand(this.phase==='PLAYING'&&this.turnId===id&&Date.now()<this.deadline, 'ยังไม่ใช่ตาของคุณ');
      demand(typeof a.value==='string', 'คำสั่งตาไม่ถูกต้อง');
      const [turn,...parts]=a.value.split('|');
      demand(turn===String(this.turnNumber), 'ตานี้จบแล้ว กรุณาเลือกอีกครั้ง');
      if(a.type==='skip'){ demand(!this.opening && parts.length===0, 'ต้องเปิด A♣ ก่อน'); this.skip(p); }
      else { demand(parts.length===1, 'ลงได้ครั้งละ 1 ใบ'); this.play(p,parts[0]); }
    } else if(a.type==='challenge') {
      demand(this.phase==='RESPONSE' && Date.now()<this.deadline && this.latest && a.value===this.latest.id, 'หมดเวลาจับไพ่ใบนี้แล้ว');
      demand(this.latest.playerId!==id && !p.finished && p.hand.length>0, 'จับได้เฉพาะไพ่ของผู้เล่นคนอื่นที่ยังเล่นอยู่');
      this.challenge(id);
    } else {
      demand(this.phase==='LOBBY'||this.phase==='RESULTS', 'รอรอบนี้จบก่อน');
      if(a.type==='setReady') { demand(this.phase==='LOBBY' && typeof a.value==='boolean', 'สถานะพร้อมไม่ถูกต้อง'); p.ready=a.value; }
      else {
        demand(id===this.hostId, 'เฉพาะผู้สร้างห้องเท่านั้น');
        if(a.type==='addBot')this.addBot();
        else if(a.type==='removeBot') {
          demand(this.phase==='LOBBY' && typeof a.value==='string' && this.players.get(a.value)?.isBot, 'เลือกบอทในห้องก่อนเริ่ม'); this.players.delete(a.value);
        } else if(a.type==='startRound')this.start();
        else if(a.type==='prepareRound')this.prepare();
        else demand(false,'ไม่รู้จักคำสั่ง');
      }
    }
    p.seen.add(a.actionId); this.changed();
  }
  private record(p: Player, text: string) {
    this.history.push({id:++this.activityId,playerId:p.id,text:`${p.name} ${text}`});
    if(this.history.length>40)this.history.shift();
  }
  private start() {
    demand(this.phase==='LOBBY', 'เตรียมรอบใหม่ก่อน');
    const players=this.ordered(); demand(players.length>=LIAR_MIN_PLAYERS, 'ต้องมีผู้เล่น 2–6 คน');
    demand(players.every(p=>p.connected&&!p.expired&&(p.isBot||p.id===this.hostId||p.ready)), 'รอทุกคนพร้อมก่อน');
    admitWaitingPlayers(this.players.values());
    this.clearTimers(); this.roundId++; this.phase='PLAYING'; this.requiredRank=1; this.opening=true; this.skipCount=0;
    this.discarded=[]; this.pendingCard=null; this.latest=null; this.result=null; this.history=[]; this.activityId=0;
    for(const p of players){p.hand=[];p.finished=false;p.ready=false;p.seen.clear();}
    shuffle(deck(),this.random).forEach((card,i)=>players[i%players.length].hand.push(card));
    for(const p of players){p.hand.sort((a,b)=>a.rank-b.rank||a.suit.localeCompare(b.suit));this.hand(p);}
    this.turnId=players.find(p=>p.hand.some(c=>c.rank===1&&c.suit==='clubs'))!.id;
    this.scheduleTurn();
  }
  private prepare() {
    demand(this.phase==='RESULTS', 'รอรอบนี้จบก่อน'); this.clearTimers(); this.phase='LOBBY'; admitWaitingPlayers(this.players.values()); this.turnId=null; this.deadline=0;
    this.result=null;this.latest=null;this.pendingCard=null;this.discarded=[];this.history=[];this.skipCount=0;this.requiredRank=1;this.opening=true;
    for(const p of this.players.values()) {if(p.expired){this.players.delete(p.id);continue;}p.hand=[];p.finished=false;p.ready=p.isBot;p.seen.clear();this.hand(p);}
    this.assignHost();
  }
  private scheduleTurn() {
    this.clearTimers(); this.phase='PLAYING'; this.turnNumber++;
    const p=this.players.get(this.turnId!)!;
    const delay=p.expired?Math.min(500,this.turnDurationMs):this.turnDurationMs;
    this.deadline=Date.now()+delay;
    this.later(()=>{if(this.opening)this.play(p,'1:clubs');else this.skip(p);this.changed();},delay);
    if(p.isBot)this.later(()=>{
      if(this.opening)this.play(p,'1:clubs');
      else { const matching=p.hand.find(c=>c.rank===this.requiredRank);
        if(matching)this.play(p,liarCardKey(matching));
        else if(this.random(3)===0)this.play(p,liarCardKey(p.hand[this.random(p.hand.length)]));
        else this.skip(p);
      } this.changed();
    },Math.min(this.botDelayMs,Math.floor(delay/2)));
  }
  private play(p: Player, key: string) {
    const index=p.hand.findIndex(c=>liarCardKey(c)===key); demand(index>=0,'เลือกไพ่ที่อยู่ในมือ');
    demand(!this.opening || key==='1:clubs', 'ใบแรกต้องเป็น A♣');
    this.clearTimers(); this.pendingCard=p.hand.splice(index,1)[0]; this.skipCount=0;
    this.latest={id:this.turnNumber,playerId:p.id,rank:this.requiredRank,card:this.opening?{...this.pendingCard}:null,
      challengerId:null,truthful:this.opening?true:null,opening:this.opening};
    this.hand(p); this.record(p, this.opening?'เปิด A♣':`ลงไพ่คว่ำ อ้างว่าเป็น ${liarRank(this.requiredRank)}`);
    if(this.opening) { this.opening=false;this.settleLatest(); return; }
    this.phase='RESPONSE'; this.deadline=Date.now()+this.challengeMs;
    this.later(()=>{this.settleLatest();this.changed();},this.challengeMs);
    // Bots decide from public claim only; never inspect the pending card.
    const challenger=this.active().find(other=>other.isBot&&other.id!==p.id&&this.random(5)===0);
    if(challenger)this.later(()=>{this.challenge(challenger.id);this.changed();},Math.min(this.botDelayMs,this.challengeMs/2));
  }
  private challenge(id: string) {
    this.clearTimers(); const latest=this.latest!, card=this.pendingCard!;
    latest.card={...card}; latest.challengerId=id; latest.truthful=card.rank===latest.rank;
    this.record(this.players.get(id)!, latest.truthful?'จับผิด · ไพ่ตรง ไม่มีบทลงโทษ':'จับโกหกสำเร็จ · คืนเฉพาะใบล่าสุด');
    this.phase='REVEAL'; this.deadline=Date.now()+this.revealMs;
    this.later(()=>{this.settleLatest();this.changed();},this.revealMs);
  }
  private settleLatest() {
    this.clearTimers(); const p=this.players.get(this.latest!.playerId)!;
    if(this.latest!.truthful===false){p.hand.push(this.pendingCard!);p.hand.sort((a,b)=>a.rank-b.rank||a.suit.localeCompare(b.suit));}
    else this.discarded.push(this.pendingCard!);
    this.pendingCard=null;
    if(!p.hand.length&&!p.finished){p.finished=true;p.wins++;this.record(p,'ไพ่หมดแล้ว · ชนะ');}
    this.hand(p);this.requiredRank=this.requiredRank%13+1;
    if(this.active().length<=1){this.finish('last_player');return;}
    this.next(p);
  }
  private skip(p: Player) {
    this.clearTimers();this.skipCount++;this.latest=null;
    this.record(p,`ข้าม · ยังลงเลข ${liarRank(this.requiredRank)}`);
    if(this.skipCount>=this.active().length){this.finish('all_skipped');return;}
    this.next(p);
  }
  private next(p: Player) {
    const all=this.ordered(), index=all.findIndex(other=>other.id===p.id);
    this.turnId=Array.from({length:all.length},(_,i)=>all[(index+i+1)%all.length]).find(other=>other.hand.length>0)!.id;
    this.scheduleTurn();
  }
  private finish(reason: LiarResult['reason']) {
    this.clearTimers();this.phase='RESULTS';this.turnId=null;this.deadline=0;
    const hands=this.ordered().filter(p=>!p.waiting).map(p=>({playerId:p.id,cards:p.hand.map(c=>({...c})),points:liarPoints(p.hand),finished:p.finished}));
    const max=Math.max(...hands.map(h=>h.points));
    this.result={reason,hands,loserIds:hands.filter(h=>!h.finished&&h.points===max).map(h=>h.playerId)};
  }
  dispose() {this.clearTimers();}
}
