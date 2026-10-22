import { joinMembership, canActInRound, admitWaitingPlayers } from '../../../packages/shared/src/room.js';
import {randomInt,randomUUID} from 'node:crypto';
import {UNDER_DEFAULT_SETTINGS,UNDER_MINUTES,UNDER_REVEAL_MS,UNDER_CHAT_LIMIT,UNDER_CHAT_MAX_LENGTH} from '../../../packages/shared/src/undercover.js';
import type {UnderSettings,UnderPhase,UnderRole,UnderPlayer,UnderSecret,UnderVote,UnderSnapshot,UnderHint,UnderChatMessage,UnderVoteResult,UnderResult} from '../../../packages/shared/src/undercover.js';
import {UNDER_WORD_PAIRS} from './undercover-words.js';
import {GameError} from './game.js';

const demand:(ok:unknown,message:string)=>asserts ok=(ok,message)=>{if(!ok)throw new GameError('INVALID_ACTION',message);};
interface Player extends UnderPlayer {role:UnderRole;word:string|null;expired:boolean;seen:Set<string>;chatTimes:number[]}
export interface UnderHooks {changed():void;secret(id:string,data:UnderSecret):void}
export function validateUnderSettings(raw:unknown):UnderSettings {
 demand(raw&&typeof raw==='object'&&!Array.isArray(raw),'การตั้งค่าไม่ถูกต้อง');const s=raw as UnderSettings;
 demand(UNDER_MINUTES.some(n=>n===s.turnMinutes)&&UNDER_MINUTES.some(n=>n===s.voteMinutes),'เลือกเวลา 1, 2 หรือ 3 นาที');
 demand(Number.isInteger(s.undercoverCount)&&s.undercoverCount>=1&&s.undercoverCount<=2,'เลือก Undercover 1–2 คน');
 demand(Number.isInteger(s.whiteCount)&&s.whiteCount>=0&&s.whiteCount<=1,'เลือก Mr. White 0–1 คน');
 return {turnMinutes:s.turnMinutes,voteMinutes:s.voteMinutes,undercoverCount:s.undercoverCount,whiteCount:s.whiteCount};
}
const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export class UndercoverGame {
 players=new Map<string,Player>();settings={...UNDER_DEFAULT_SETTINGS};phase:UnderPhase='LOBBY';roundId=0;hostId='';
 turnId='';turnNumber=0;deadline=0;cycle=0;
 private voteReady=new Set<string>();private acknowledged=new Set<string>();private described=new Set<string>();private votes=new Map<string,UnderVote>();
 private eligibleIds:string[]=[];private runoff=false;private queue:string[]=[];private hints:UnderHint[]=[];
 private lastVote:UnderVoteResult|null=null;private guesserId='';private result:UnderResult|null=null;
 private chat:UnderChatMessage[]=[];private chatId=0;
 private answer='';private lastGuess:string|null=null;private activityId=0;private timer?:ReturnType<typeof setTimeout>;
 constructor(public code:string,private hooks:UnderHooks,private random:(max:number)=>number=randomInt,private timeScale=1){}
 private ordered(){return [...this.players.values()].sort((a,b)=>a.seat-b.seat);}
 private active(){return this.ordered().filter(p=>!p.waiting&&p.alive&&!p.expired);}
 private clearTimer(){if(this.timer)clearTimeout(this.timer);this.timer=undefined;}
 private arm(ms:number,fn:()=>void){this.clearTimer();this.deadline=Date.now()+ms*this.timeScale;this.timer=setTimeout(()=>{this.timer=undefined;fn();this.changed();},ms*this.timeScale);}
 private changed(){this.hooks.changed();}
 private assignHost(){if(!this.players.get(this.hostId)?.connected)this.hostId=this.ordered().find(p=>p.connected&&!p.expired)?.id??'';}
 private secret(p:Player){this.hooks.secret(p.id,{roundId:this.roundId,word:this.phase==='LOBBY'?null:p.word,canGuess:this.phase==='GUESS'&&this.guesserId===p.id,vote:this.votes.get(p.id)?{...this.votes.get(p.id)!}:null});}
 private secrets(){for(const p of this.players.values())if(!p.expired)this.secret(p);}
 add(name:unknown,id:string=randomUUID()){
  demand(this.players.size<8,'ห้องเต็มแล้ว');
  demand(typeof name==='string'&&name.trim().length>0&&name.trim().length<=20,'ชื่อยาว 1–20 ตัวอักษร');demand(!this.players.has(id),'อยู่ในห้องแล้ว');
  const seat=Array.from({length:8},(_,i)=>i).find(i=>!this.ordered().some(p=>p.seat===i))!;
  this.players.set(id,{...joinMembership(this.phase),id,name:name.trim(),seat,connected:true,ready:false,alive:true,isBot:false,role:'citizen',word:null,expired:false,seen:new Set(),chatTimes:[]});
  if(!this.hostId)this.hostId=id;this.changed();return id;
 }
 addBot(){throw new GameError('INVALID_ACTION','Undercover เล่นกับผู้เล่นจริง 3–8 คน');}
 sync(id:string){const p=this.players.get(id);demand(p&&!p.expired,'หมดเวลา reconnect');this.secret(p);}
 disconnect(id:string){const p=this.players.get(id);if(!p)return;p.connected=false;p.ready=false;this.assignHost();this.changed();}
 reconnect(id:string){const p=this.players.get(id);demand(p&&!p.expired,'หมดเวลา reconnect');p.connected=true;if(!this.hostId)this.hostId=id;this.secret(p);if(this.phase==='DISCUSS')this.maybeBeginVote();this.changed();}
 expire(id:string){
  const p=this.players.get(id);if(!p)return;if(p.waiting){this.players.delete(id);this.assignHost();this.changed();return;}p.expired=true;p.connected=false;p.alive=false;this.voteReady.delete(id);
  if(this.phase==='LOBBY'||this.phase==='RESULTS')this.players.delete(id);
  else if(this.phase==='GUESS'&&this.guesserId===id)this.resolveGuess(false);
  else if(this.phase!=='GUESS'&&this.phase!=='REVEAL'&&!this.checkWin()){
   if(this.phase==='WORD'&&this.active().every(p=>this.acknowledged.has(p.id)))this.beginCycle();
   else if(this.phase==='DESCRIBE'&&this.turnId===id)this.nextSpeaker();
   else if(this.phase==='DISCUSS')this.maybeBeginVote();
   else if(this.phase==='VOTING'){
    this.eligibleIds=this.eligibleIds.filter(x=>x!==id);this.votes.delete(id);
    for(const [voter,vote]of this.votes)if(vote.targetId===id)this.votes.delete(voter);
    this.secrets();if(this.active().every(p=>this.votes.has(p.id)))this.resolveVotes();
   }
  }
  this.assignHost();this.changed();
 }
 snapshot():UnderSnapshot {
  return {game:'undercover',code:this.code,roundId:this.roundId,phase:this.phase,hostId:this.hostId,...this.settings,
   players:this.ordered().map(({role,word,expired,seen,chatTimes,...p})=>({...p})),cycle:this.cycle,turnId:this.turnId,turnNumber:this.turnNumber,deadline:this.deadline,
   acknowledgedIds:[...this.acknowledged],describedIds:[...this.described],voteReadyIds:[...this.voteReady],submittedIds:[...this.votes.keys()],eligibleIds:[...this.eligibleIds],runoff:this.runoff,
   chat:this.chat.map(m=>({...m})),hints:structuredClone(this.hints),lastVote:this.lastVote?structuredClone(this.lastVote):null,guesserId:this.guesserId,result:this.result?structuredClone(this.result):null};
 }
 action(id:string,raw:unknown){
  const p=this.players.get(id);demand(p?.connected&&!p.expired,'ไม่พบผู้เล่นที่เชื่อมต่อ');demand(canActInRound(p,this.phase),'คุณกำลังรอเข้าร่วมรอบถัดไป');demand(raw&&typeof raw==='object'&&!Array.isArray(raw),'คำสั่งไม่ถูกต้อง');
  const a=raw as {type:string;value?:unknown;roundId:number;turnNumber?:number;actionId:string};
  demand(a.roundId===this.roundId&&Number.isInteger(a.roundId)&&typeof a.actionId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(a.actionId),'คำสั่งไม่ถูกต้องหรือรอบเก่า');
  if(p.seen.has(a.actionId))return;demand(p.seen.size<2048,'ส่งคำสั่งมากเกินไป');
  if(a.type==='chat'){
   demand((this.phase==='DESCRIBE'||this.phase==='DISCUSS')&&p.alive,'แชทได้ระหว่างอธิบายคำ เมื่อคุณยังอยู่ในรอบ');
   demand(typeof a.value==='string'&&a.value.trim().length>0&&a.value.trim().length<=UNDER_CHAT_MAX_LENGTH,'ข้อความยาว 1–500 ตัวอักษร');
   const now=Date.now();p.chatTimes=p.chatTimes.filter(t=>now-t<5000);
   demand(p.chatTimes.length<3,'ส่งแชทเร็วเกินไป รอสักครู่');p.chatTimes.push(now);
   this.chat.push({id:++this.chatId,playerId:id,name:p.name,text:a.value.trim(),timestamp:now});
   if(this.chat.length>UNDER_CHAT_LIMIT)this.chat.shift();
  }else if(a.type==='readyVote'){
   demand(this.phase==='DISCUSS'&&p.alive,'รอทุกคนส่งคำใบ้ครบก่อนกดพร้อมโหวต');
   demand(a.turnNumber===this.turnNumber,'คำสั่งมาจากตาเก่า');
   this.voteReady.add(id);this.maybeBeginVote();
  }else if(['acknowledge','hint','vote','guess','surrender'].includes(a.type)){
   demand(a.turnNumber===this.turnNumber,'คำสั่งมาจากตาเก่า');demand(Date.now()<this.deadline,'หมดเวลาแล้ว');
   if(a.type==='acknowledge'){demand(this.phase==='WORD'&&p.alive,'ยังไม่ถึงช่วงเปิดคำ');this.acknowledged.add(id);if(this.active().every(p=>this.acknowledged.has(p.id)))this.beginCycle();}
   else if(a.type==='hint'){
    demand(this.phase==='DESCRIBE'&&this.turnId===id&&p.alive,'ยังไม่ใช่ตาของคุณ');
    demand(typeof a.value==='string'&&a.value.trim().length>0&&a.value.trim().length<=120,'คำใบ้ยาว 1–120 ตัวอักษร');
    demand(!p.word||normalize(a.value)!==normalize(p.word),'อย่าพิมพ์คำลับตรง ๆ');this.recordHint(p,a.value.trim());this.described.add(id);this.nextSpeaker();
   }else if(a.type==='vote'){
    demand(this.phase==='VOTING'&&p.alive&&!this.votes.has(id),'โหวตแล้วหรือไม่ได้อยู่ในรอบโหวต');
    demand(a.value&&typeof a.value==='object'&&!Array.isArray(a.value),'เลือกผู้เล่นที่สงสัย');const vote=a.value as UnderVote;
    demand(typeof vote.targetId==='string'&&vote.targetId!==id&&this.eligibleIds.includes(vote.targetId)&&this.players.get(vote.targetId)?.alive,'เลือกผู้เล่นคนอื่นที่ยังอยู่');
    this.votes.set(id,{targetId:vote.targetId});this.secret(p);if(this.active().every(p=>this.votes.has(p.id)))this.resolveVotes();
   }else{
    demand(this.phase==='GUESS'&&this.guesserId===id,'เฉพาะผู้ถูกโหวตที่มีสิทธิ์ตอบ');
    if(a.type==='guess'){demand(typeof a.value==='string'&&a.value.trim().length>0&&a.value.trim().length<=80,'คำตอบยาว 1–80 ตัวอักษร');this.lastGuess=a.value.trim();this.resolveGuess(normalize(a.value)===normalize(this.answer));}
    else this.resolveGuess(false);
   }
  }else{
   demand(this.phase==='LOBBY'||this.phase==='RESULTS','รอรอบนี้จบก่อน');
   if(a.type==='setReady'){demand(this.phase==='LOBBY'&&typeof a.value==='boolean','สถานะพร้อมไม่ถูกต้อง');p.ready=a.value;}
   else{demand(id===this.hostId,'เฉพาะผู้สร้างห้องเท่านั้น');
    if(a.type==='setSettings'){demand(this.phase==='LOBBY','ตั้งค่าได้ก่อนเริ่ม');this.settings=validateUnderSettings(a.value);for(const other of this.players.values())other.ready=false;}
    else if(a.type==='startRound')this.start();
    else if(a.type==='prepareRound')this.prepare();else demand(false,'ไม่รู้จักคำสั่ง');
   }
  }
  p.seen.add(a.actionId);this.changed();
 }
 private start(){
  demand(this.phase==='LOBBY','เตรียมรอบใหม่ก่อน');const players=this.ordered(),s=this.settings;
  demand(players.length>=Math.max(3,2*s.undercoverCount+s.whiteCount+1),'จำนวนคนยังไม่พอกับรูปแบบที่เลือก');
  demand(players.every(p=>p.connected&&!p.expired&&(p.ready||p.id===this.hostId)),'รอทุกคนพร้อม');
  admitWaitingPlayers(this.players.values());
  this.clearTimer();this.roundId++;this.cycle=0;this.hints=[];this.activityId=0;this.chat=[];this.chatId=0;this.result=null;this.lastVote=null;this.guesserId='';this.lastGuess=null;this.acknowledged.clear();this.described.clear();this.voteReady.clear();this.votes.clear();this.runoff=false;this.eligibleIds=[];
  const pair=UNDER_WORD_PAIRS[this.random(UNDER_WORD_PAIRS.length)],flip=this.random(2);this.answer=pair[flip];
  const order=[...players];for(let i=order.length-1;i>0;i--){const j=this.random(i+1);[order[i],order[j]]=[order[j],order[i]];}
  order.forEach((p,i)=>{p.role=i<s.undercoverCount?'undercover':i<s.undercoverCount+s.whiteCount?'white':'citizen';p.word=p.role==='white'?null:p.role==='undercover'?pair[1-flip]:this.answer;p.alive=true;p.ready=false;p.seen.clear();p.chatTimes=[];});
  this.phase='WORD';this.turnId='';this.turnNumber++;this.arm(60_000,()=>this.beginCycle());this.secrets();
 }
 private recordHint(p:Player,text:string){this.hints.push({id:++this.activityId,playerId:p.id,name:p.name,cycle:this.cycle,text});if(this.hints.length>80)this.hints.shift();}
 private beginCycle(){
  if(this.checkWin())return;this.cycle++;this.described.clear();this.voteReady.clear();this.votes.clear();this.eligibleIds=[];this.runoff=false;this.guesserId='';
  const active=this.active(),offset=(this.cycle-1)%active.length;this.queue=[...active.slice(offset),...active.slice(0,offset)].map(p=>p.id);this.secrets();this.nextSpeaker();
 }
 private nextSpeaker(){
  this.clearTimer();this.queue=this.queue.filter(id=>this.players.get(id)?.alive&&!this.players.get(id)?.expired);
  const id=this.queue.shift();if(!id){this.beginDiscussion();return;}
  this.phase='DESCRIBE';this.turnId=id;this.turnNumber++;
  this.arm(this.settings.turnMinutes*60_000,()=>{const p=this.players.get(id)!;this.recordHint(p,'(หมดเวลา · ไม่ได้ส่งคำใบ้)');this.described.add(id);this.nextSpeaker();});
 }
 private beginDiscussion(){
  this.clearTimer();this.phase='DISCUSS';this.turnId='';this.turnNumber++;this.deadline=0;this.voteReady.clear();
 }
 private maybeBeginVote(){
  const active=this.active();if(active.length&&active.every(p=>p.connected&&this.voteReady.has(p.id)))this.beginVote(false);
 }
 private beginVote(runoff:boolean){
  this.phase='VOTING';this.turnId='';this.turnNumber++;this.votes.clear();this.runoff=runoff;
  if(!runoff)this.eligibleIds=this.active().map(p=>p.id);
  this.arm(this.settings.voteMinutes*60_000,()=>this.resolveVotes());this.secrets();
 }
 private resolveVotes(){
  this.clearTimer();const counts:Record<string,number>={};for(const vote of this.votes.values())if(this.players.get(vote.targetId)?.alive)counts[vote.targetId]=(counts[vote.targetId]??0)+1;
  const max=Math.max(0,...Object.values(counts)),top=Object.keys(counts).filter(id=>counts[id]===max);
  this.lastVote={targetId:top.length===1?top[0]:null,counts,tied:top.length>1,role:null};
  if(top.length!==1){if(top.length>1&&!this.runoff){this.eligibleIds=top;this.beginVote(true);}else this.beginCycle();return;}
  const p=this.players.get(top[0])!;p.alive=false;
  this.lastVote.role=p.role;this.phase='REVEAL';this.turnId='';this.turnNumber++;
  this.arm(UNDER_REVEAL_MS,()=>this.afterReveal());this.secrets();
 }
 private afterReveal(){
  const p=this.players.get(this.lastVote?.targetId??'');
  if(p?.role==='white'&&!p.expired){
   this.phase='GUESS';this.turnId='';this.guesserId=p.id;this.turnNumber++;this.arm(60_000,()=>this.resolveGuess(false));this.secrets();
  }else if(!this.checkWin())this.beginCycle();
 }
 private resolveGuess(correct:boolean){
  this.clearTimer();const id=this.guesserId;this.guesserId='';
  if(correct)this.finish('white_guess',[id]);else if(!this.checkWin())this.beginCycle();this.secrets();
 }
 private checkWin(){
  if(this.phase==='LOBBY'||this.phase==='RESULTS')return false;
  const active=this.active(),citizens=active.filter(p=>p.role==='citizen'),under=active.filter(p=>p.role==='undercover'),white=active.filter(p=>p.role==='white');
  if(!active.length){this.finish('not_enough_players',[]);return true;}
  if(!under.length&&!white.length){this.finish('citizens',this.ordered().filter(p=>!p.waiting&&p.role==='citizen').map(p=>p.id));return true;}
  if(under.length>=citizens.length&&under.length){this.finish('undercover',this.ordered().filter(p=>!p.waiting&&p.role==='undercover').map(p=>p.id));return true;}
  if(!citizens.length&&!under.length){this.finish('last_white',white.map(p=>p.id));return true;}return false;
 }
 private finish(reason:UnderResult['reason'],winnerIds:string[]){
  this.clearTimer();this.phase='RESULTS';this.deadline=0;this.turnId='';this.guesserId='';
  this.result={reason,winnerIds:[...winnerIds],words:this.ordered().filter(p=>!p.waiting).map(p=>({playerId:p.id,name:p.name,word:p.word})),answer:this.answer||null,guess:this.lastGuess};this.secrets();
 }
 private prepare(){
  demand(this.phase==='RESULTS','รอรอบนี้จบก่อน');this.clearTimer();this.phase='LOBBY';admitWaitingPlayers(this.players.values());this.deadline=0;this.turnId='';this.result=null;this.lastVote=null;this.guesserId='';this.answer='';this.lastGuess=null;this.hints=[];this.chat=[];this.chatId=0;this.queue=[];this.votes.clear();this.acknowledged.clear();this.described.clear();this.voteReady.clear();this.eligibleIds=[];this.runoff=false;this.cycle=0;
  for(const p of this.players.values()){if(p.expired){this.players.delete(p.id);continue;}p.ready=false;p.alive=true;p.word=null;p.role='citizen';p.seen.clear();p.chatTimes=[];}this.assignHost();this.secrets();
 }
 dispose(){this.clearTimer();this.chat=[];this.voteReady.clear();for(const p of this.players.values())p.chatTimes=[];}
}
