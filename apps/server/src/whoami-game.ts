import { joinMembership, canActInRound, admitWaitingPlayers } from '../../../packages/shared/src/room.js';
import { randomInt, randomUUID } from 'node:crypto';
import { WHO_CATEGORIES, WHO_DEFAULT_SETTINGS, WHO_GAME_ROUNDS, WHO_QUESTION_ROUNDS, WHO_TURN_MINUTES } from '../../../packages/shared/src/whoami.js';
import type { WhoAnswer, WhoGameResult, WhoGuess, WhoPhase, WhoPlayer, WhoPrivate, WhoQuestion, WhoSettings, WhoSnapshot } from '../../../packages/shared/src/whoami.js';
import { GameError } from './game.js';
import { WHO_WORDS, normalizeWhoWord } from './whoami-words.js';

function demand(ok: unknown, message: string): asserts ok { if (!ok) throw new GameError('INVALID_ACTION', message); }
export function validateWhoSettings(raw: unknown): WhoSettings {
  demand(raw && typeof raw === 'object' && !Array.isArray(raw), 'การตั้งค่าไม่ถูกต้อง');
  const s = raw as WhoSettings;
  demand(WHO_CATEGORIES.some(c => c.value === s.category), 'เลือกหมวดคำที่กำหนด');
  demand(WHO_TURN_MINUTES.some(n => n === s.turnMinutes), 'เลือกเวลา 1, 2 หรือ 3 นาที');
  demand(WHO_QUESTION_ROUNDS.some(n => n === s.questionRounds), 'เลือกรอบการถาม 4, 6, 8 หรือ 10 รอบ');
  demand(WHO_GAME_ROUNDS.some(n => n === s.gameRounds), 'เลือกรอบการเล่นเกม 3, 5, 7 หรือ 10 รอบ');
  return { category:s.category, turnMinutes:s.turnMinutes, questionRounds:s.questionRounds, gameRounds:s.gameRounds };
}
interface Player extends WhoPlayer { expired: boolean; seen: Set<string> }
export interface WhoHooks { changed(): void; identities(id: string, data: WhoPrivate): void }
export class WhoAmIGame {
  players = new Map<string, Player>();
  phase: WhoPhase = 'LOBBY'; roundId = 0; hostId = ''; deadline = 0;
  settings: WhoSettings = { ...WHO_DEFAULT_SETTINGS };
  private gameNumber = 0; private questionRound = 0; private turnNumber = 0; private turnId = '';
  private participants: string[] = []; private cursor = -1;
  private identities = new Map<string, typeof WHO_WORDS[number]>();
  private usedWords = new Set<string>(); private answers = new Map<string, WhoAnswer>();
  private history: WhoQuestion[] = []; private question: WhoQuestion | null = null;
  private lastGuess: WhoGuess | null = null; private result: WhoGameResult | null = null;
  private timer?: ReturnType<typeof setTimeout>; private disposed = false;
  constructor(public code: string, private hooks: WhoHooks, private random: (max:number)=>number = randomInt,
    private minuteMs = 60_000) {}
  add(name: unknown, id: string = randomUUID()) {
    demand(this.players.size < 8 && !this.players.has(id), 'ห้องเต็มแล้ว หรือผู้เล่นนี้อยู่ในห้องแล้ว');
    demand(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 20, 'ชื่อยาว 1–20 ตัวอักษร');
    const seats = new Set([...this.players.values()].map(p=>p.seat));
    const seat = Array.from({length:8},(_,n)=>n).find(n=>!seats.has(n))!;
    this.players.set(id,{...joinMembership(this.phase),id,name:name.trim(),seat,connected:true,ready:false,score:0,solved:false,expired:false,seen:new Set()});
    if (!this.hostId) this.hostId=id;
    this.changed(); return id;
  }
  disconnect(id:string) {
    const p=this.players.get(id); if(!p || !p.connected)return;
    p.connected=false;p.ready=false;this.reassign();this.resolveAnswers();this.changed();
  }
  reconnect(id:string) {
    const p=this.players.get(id);demand(p&&!p.expired,'หมดเวลา reconnect');p.connected=true;
    if(!this.hostId)this.hostId=id;this.sendPrivate(id);this.changed();
  }
  sync(id:string) { demand(this.players.get(id)&&!this.players.get(id)!.expired,'หมดเวลา reconnect');this.sendPrivate(id); }
  expire(id:string) {
    const p=this.players.get(id);if(!p)return;p.connected=false;p.expired=true;p.ready=false;
    if(this.phase==='LOBBY'||this.phase==='RESULTS'||p.waiting)this.players.delete(id);
    if(this.phase==='PLAYING'&&this.turnId===id)this.advance();
    this.reassign();this.resolveAnswers();this.changed();
  }
  private reassign() { if(!this.players.get(this.hostId)?.connected)this.hostId=[...this.players.values()].find(p=>p.connected&&!p.expired)?.id??''; }
  private changed() { if(!this.disposed)this.hooks.changed(); }
  private responders() { return this.participants.filter(id=>id!==this.turnId&&this.players.get(id)?.connected&&!this.players.get(id)?.expired); }
  private sendPrivate(id:string) {
    // Never include this recipient's identity, even after guessing it. Reveal
    // solved/end-of-game identities only through the explicit public result.
    this.hooks.identities(id,{roundId:this.roundId,turnNumber:this.turnNumber,
      identities:[...this.identities].filter(([pid])=>!this.players.get(id)?.waiting&&pid!==id).map(([playerId,w])=>({playerId,word:w.word,icon:w.icon})),
      ownAnswer:this.answers.get(id)??null});
  }
  private allPrivate() { for(const p of this.players.values())if(p.connected&&!p.expired)this.sendPrivate(p.id); }
  private copyQuestion(q:WhoQuestion):WhoQuestion { return {...q,respondedIds:[...q.respondedIds],counts:q.counts?{...q.counts}:null}; }
  snapshot():WhoSnapshot {
    return {game:'whoami',code:this.code,phase:this.phase,roundId:this.roundId,hostId:this.hostId,...this.settings,
      gameNumber:this.gameNumber,questionRound:this.questionRound,turnId:this.turnId,turnNumber:this.turnNumber,
      deadline:this.deadline,turnDurationMs:this.settings.turnMinutes*this.minuteMs,
      players:[...this.players.values()].map(({expired,seen,...p})=>({...p})),
      question:this.question?this.copyQuestion(this.question):null,history:this.history.map(q=>this.copyQuestion(q)),
      lastGuess:this.lastGuess?{...this.lastGuess}:null,
      result:this.result?{...this.result,identities:this.result.identities.map(p=>({...p}))}:null};
  }
  action(id:string,raw:unknown) {
    const p=this.players.get(id);demand(!this.disposed&&p?.connected&&!p.expired,'ไม่พบผู้เล่นที่เชื่อมต่อ');
    demand(canActInRound(p, this.phase), 'คุณกำลังรอเข้าร่วมรอบถัดไป');
    demand(raw&&typeof raw==='object'&&!Array.isArray(raw),'คำสั่งไม่ถูกต้อง');
    const a=raw as {type:string;actionId:string;roundId:number;turnNumber?:number;value?:unknown};
    demand(a.roundId===this.roundId&&Number.isInteger(a.roundId)&&typeof a.actionId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(a.actionId),'คำสั่งไม่ถูกต้องหรือมาจากเกมเก่า');
    if(p.seen.has(a.actionId))return;
    demand(p.seen.size<2048,'ส่งคำสั่งมากเกินไป');
    if(a.type==='setReady') {
      demand(this.phase==='LOBBY'&&typeof a.value==='boolean','กดพร้อมได้ในห้องรอ');p.ready=a.value;
    } else if(a.type==='setSettings') {
      demand(id===this.hostId&&this.phase==='LOBBY','เฉพาะผู้สร้างห้องตั้งค่าก่อนเริ่มเกม');
      this.settings=validateWhoSettings(a.value);for(const player of this.players.values())player.ready=false;
    } else if(a.type==='startRound') {
      demand(id===this.hostId&&this.phase==='LOBBY','เฉพาะผู้สร้างห้องเริ่มในห้องรอ');
      this.requireReady();this.gameNumber=0;this.usedWords.clear();
      for(const player of this.players.values())player.score=0;
      this.beginGame();
    } else if(a.type==='nextGame') {
      demand(id===this.hostId&&this.phase==='GAME_END','เฉพาะผู้สร้างห้องเริ่มเกมถัดไป');
      demand([...this.players.values()].filter(player=>player.connected&&!player.expired).length>=3,'ต้องมีผู้เล่นที่เชื่อมต่ออย่างน้อย 3 คน หรือกลับห้องรอ');
      this.beginGame();
    } else if(a.type==='prepareRound') {
      demand(id===this.hostId&&(this.phase==='GAME_END'||this.phase==='RESULTS'),'เฉพาะผู้สร้างห้องกลับห้องรอหลังจบเกม');
      this.clearTimer();this.phase='LOBBY';admitWaitingPlayers(this.players.values());this.deadline=0;this.turnId='';this.question=null;this.history=[];this.lastGuess=null;
      this.identities.clear();this.answers.clear();this.participants=[];this.result=null;this.questionRound=0;this.turnNumber=0;this.gameNumber=0;
      for(const [pid,player]of this.players){if(player.expired)this.players.delete(pid);else{player.ready=false;player.solved=false;player.seen.clear();}}
      this.allPrivate();
    } else {
      demand(this.phase==='PLAYING'&&Date.now()<this.deadline&&a.turnNumber===this.turnNumber&&this.participants.includes(id),'ยังไม่ถึงตา หมดเวลา หรือคำสั่งมาจากตาเก่า');
      if(a.type==='answer') {
        demand(id!==this.turnId&&this.question&&this.question.answer===null,'ตอบได้เฉพาะคำถามของเพื่อนที่ยังรอคำตอบ');
        demand(a.value==='yes'||a.value==='no'||a.value==='unknown','เลือก ใช่ ไม่ใช่ หรือไม่แน่ใจ');
        demand(!this.answers.has(id),'ยืนยันคำตอบแล้ว เปลี่ยนไม่ได้');this.answers.set(id,a.value);
        this.question.respondedIds=[...this.answers.keys()];this.sendPrivate(id);this.resolveAnswers();
      } else {
        demand(id===this.turnId&&!p.solved,'รอตาของคุณก่อน');
        if(a.type==='ask') {
          demand(!this.question,'ตานี้ถามแล้ว 1 คำถาม');
          demand(this.responders().length>0,'รอเพื่อนเชื่อมต่อก่อนถาม');
          const text=this.text(a.value,200,'คำถาม');
          this.question={id:this.turnNumber,turnNumber:this.turnNumber,playerId:id,name:p.name,text,answer:null,counts:null,respondedIds:[]};
          this.history.push(this.question);if(this.history.length>80)this.history.shift();
        } else if(a.type==='guess') {
          demand(!this.question,'ถามไปแล้ว ต้องรอทายในตาของคุณครั้งถัดไป');
          const text=this.text(a.value,80,'คำตอบ');
          const correct=this.identities.get(id)!.aliases.some(alias=>normalizeWhoWord(alias)===normalizeWhoWord(text));
          this.lastGuess={playerId:id,name:p.name,text,correct,turnNumber:this.turnNumber};
          if(correct){p.solved=true;p.score++;}
          this.advance();
        } else if(a.type==='endTurn') { this.completeQuestion();this.advance(); }
        else throw new GameError('UNKNOWN_ACTION','ไม่รู้จักคำสั่ง');
      }
    }
    p.seen.add(a.actionId);this.changed();
  }
  private text(value:unknown,max:number,label:string) {
    demand(typeof value==='string'&&value.trim().length>0&&value.trim().length<=max,`${label}ยาว 1–${max} ตัวอักษร`);
    return value.trim();
  }
  private requireReady() {
    const players=[...this.players.values()];
    demand(players.length>=3&&players.length<=8&&players.every(p=>p.connected&&!p.expired),'ต้องมีผู้เล่นที่เชื่อมต่อ 3–8 คน');
    demand(players.every(p=>p.id===this.hostId||p.ready),'รอทุกคนกดพร้อม');
  }
  private beginGame() {
    admitWaitingPlayers(this.players.values());
    this.clearTimer();this.gameNumber++;this.roundId++;this.turnNumber=0;this.questionRound=1;this.cursor=-1;
    this.participants=[...this.players.values()].filter(p=>!p.expired).sort((a,b)=>a.seat-b.seat).map(p=>p.id);
    this.history=[];this.question=null;this.lastGuess=null;this.result=null;this.answers.clear();this.identities.clear();
    const pool=WHO_WORDS.filter(w=>this.settings.category==='mixed'||w.category===this.settings.category);
    let available=pool.filter(w=>!this.usedWords.has(w.word));
    if(available.length<this.participants.length){this.usedWords.clear();available=[...pool];}
    for(const id of this.participants){
      const p=this.players.get(id)!;p.solved=false;p.ready=false;p.seen.clear();
      const [word]=available.splice(this.random(available.length),1);this.identities.set(id,word);this.usedWords.add(word.word);
    }
    this.phase='PLAYING';this.advance();
  }
  private advance() {
    this.completeQuestion();this.clearTimer();this.answers.clear();this.question=null;
    const unsolved=this.participants.filter(id=>!this.players.get(id)?.solved&&!this.players.get(id)?.expired);
    if(!unsolved.length){this.finish('all_solved');return;}
    const connected=this.participants.filter(id=>this.players.get(id)?.connected&&!this.players.get(id)?.expired);
    if(connected.length<2){this.finish('not_enough_players');return;}
    const limit=this.participants.length*this.settings.questionRounds;
    while(++this.cursor<limit){
      const id=this.participants[this.cursor%this.participants.length],p=this.players.get(id);
      if(!p?.connected||p.expired||p.solved)continue;
      this.turnId=id;this.questionRound=Math.floor(this.cursor/this.participants.length)+1;this.turnNumber++;
      const duration=this.settings.turnMinutes*this.minuteMs;this.deadline=Date.now()+duration;
      this.timer=setTimeout(()=>{if(!this.disposed){this.advance();this.changed();}},duration);
      this.allPrivate();return;
    }
    this.finish('round_limit');
  }
  private resolveAnswers() {
    if(this.phase!=='PLAYING'||!this.question||this.question.answer!==null)return;
    if(this.responders().every(id=>this.answers.has(id)))this.completeQuestion();
  }
  private completeQuestion() {
    if(!this.question||this.question.answer!==null)return;
    const counts:Record<WhoAnswer,number>={yes:0,no:0,unknown:0};
    for(const answer of this.answers.values())counts[answer]++;
    const total=new Set([...this.responders(),...this.answers.keys()]).size;
    this.question.answer=counts.yes>total/2?'yes':counts.no>total/2?'no':'unknown';
    this.question.counts=counts;
  }
  private finish(reason:WhoGameResult['reason']) {
    this.completeQuestion();this.clearTimer();this.deadline=0;this.turnId='';
    this.phase=this.gameNumber>=this.settings.gameRounds?'RESULTS':'GAME_END';
    this.result={gameNumber:this.gameNumber,reason,identities:this.participants.map(id=>{
      const p=this.players.get(id)!,word=this.identities.get(id)!;
      return {playerId:id,name:p.name,word:word.word,icon:word.icon,solved:p.solved,score:p.score};
    })};
    for(const [id,p]of this.players)if(p.expired)this.players.delete(id);
    this.reassign();this.allPrivate();
  }
  private clearTimer(){if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined;}
  dispose(){this.disposed=true;this.clearTimer();this.players.clear();this.identities.clear();this.answers.clear();this.history=[];this.usedWords.clear();}
}
