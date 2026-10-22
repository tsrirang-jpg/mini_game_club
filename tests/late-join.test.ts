import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Game } from '../apps/server/src/game';
import { PokerGame } from '../apps/server/src/poker-game';
import { SpyfallGame } from '../apps/server/src/spyfall-game';
import { OldMaidGame } from '../apps/server/src/oldmaid-game';
import { LiarGame } from '../apps/server/src/liar-game';
import { WhoAmIGame } from '../apps/server/src/whoami-game';
import { UndercoverGame } from '../apps/server/src/undercover-game';
import { DEFAULT_RULES } from '../packages/shared/src/index';
import type { Card } from '../packages/shared/src/index';
import { isBetweenRounds } from '../packages/shared/src/room';
const kinds=['pok','poker','spyfall','oldmaid','liar','whoami','undercover'] as const;
type Kind=typeof kinds[number];
type Engine=Game|PokerGame|SpyfallGame|OldMaidGame|LiarGame|WhoAmIGame|UndercoverGame;
const capacities={pok:10,poker:6,spyfall:8,oldmaid:8,liar:6,whoami:8,undercover:8};
let serial=0, engines:Engine[]=[];
function act(game:Engine,id:string,type:string,value?:unknown) {
 const snapshot=game.snapshot();game.action(id,{type,value,roundId:game.roundId,actionId:'late-'+(++serial),...('turnNumber' in snapshot?{turnNumber:snapshot.turnNumber}:{})});
}
function fixture(kind:Kind) {
 const hands:Record<string,Card[]>={},privateData:Record<string,any>={};let seed=17;
 const random=(max:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
 const common={changed(){},privateHand:(id:string,cards:Card[])=>hands[id]=structuredClone(cards)};
 let game:Engine;
 switch(kind){
 case 'pok':game=new Game('TEST',common,{...DEFAULT_RULES,dealMs:10,revealMs:5,settlementMs:5,actionMs:100},random);break;
 case 'poker':game=new PokerGame('TEST',common,random,{deal:10,turn:100,reveal:5,bot:5});break;
 case 'spyfall':game=new SpyfallGame('TEST',{changed(){},secret:(id,data)=>privateData[id]=data},random,{minute:100,voting:100,guess:100});break;
 case 'oldmaid':game=new OldMaidGame('TEST',{changed(){},hand:(id,data)=>hands[id]=data.cards},random);break;
 case 'liar':game=new LiarGame('TEST',{changed(){},hand:(id,data)=>hands[id]=data.cards},random);break;
 case 'whoami':game=new WhoAmIGame('TEST',{changed(){},identities:(id,data)=>privateData[id]=data},random,100);break;
 case 'undercover':game=new UndercoverGame('TEST',{changed(){},secret:(id,data)=>privateData[id]=data},random,.01);break;
 }
 engines.push(game);for(let i=0;i<3;i++)game.add('Player '+i,'p'+i);
 for(const id of ['p1','p2'])act(game,id,'setReady',true);act(game,'p0','startRound');
 expect(isBetweenRounds(game.phase)).toBe(false);return {game,hands,privateData};
}
function finish(game:Engine,hands:Record<string,Card[]>) {
 if(game instanceof Game){vi.advanceTimersByTime(1000);}
 else if(game instanceof PokerGame){vi.advanceTimersByTime(10);while(['PREFLOP','FLOP','TURN','RIVER'].includes(game.phase))act(game,game.turnId,'fold');vi.advanceTimersByTime(10);}
 else if(game instanceof SpyfallGame){vi.advanceTimersByTime(1000);}
 else if(game instanceof OldMaidGame){let n=0;while(game.phase==='PLAYING'&&n++<2500){const s=game.snapshot(),own=hands[s.turnId!],other=hands[s.targetId!];const match=other.findIndex(c=>own.some(o=>o.rank===c.rank));act(game,s.turnId!,'draw',s.turnNumber+':'+Math.max(0,match));}expect(n).toBeLessThan(2500);}
 else if(game instanceof LiarGame){act(game,game.turnId!,'play',game.turnNumber+'|1:clubs');for(let i=0;i<3;i++)act(game,game.turnId!,'skip',String(game.turnNumber));}
 else if(game instanceof WhoAmIGame){let n=0;while(game.phase==='PLAYING'&&n++<30)act(game,game.snapshot().turnId,'endTurn');}
 else {for(const id of ['p0','p1','p2'])act(game,id,'acknowledge');while(game.phase==='DESCRIBE')act(game,game.turnId,'hint','ตัวอย่างคำใบ้');for(const id of ['p0','p1','p2'])act(game,id,'readyVote');const target=[...game.players.values()].find(p=>p.role==='undercover')!.id;for(const id of ['p0','p1','p2'])act(game,id,'vote',{targetId:id===target?['p0','p1','p2'].find(other=>other!==id)!:target});vi.advanceTimersByTime(60);}
 expect(isBetweenRounds(game.phase)).toBe(true);
}
beforeEach(()=>{vi.useFakeTimers();engines=[];serial=0;});afterEach(()=>{for(const game of engines)game.dispose();vi.useRealTimers();});
describe.each(kinds)('%s late join',kind=>{
 it('reserves a private waiting seat, preserves the active round, excludes settlement and admits on the next round',()=>{
  const {game,hands,privateData}=fixture(kind),before=structuredClone(game.snapshot()),originalHands=structuredClone(hands);
  game.add('Waiting friend','waiting');game.sync('waiting');
  expect(game.snapshot().players.find(p=>p.id==='waiting')?.waiting).toBe(true);
  expect(game.phase).toBe(before.phase);expect(game.deadline).toBe(before.deadline);expect(game.roundId).toBe(before.roundId);
  expect(game.snapshot().players.filter(p=>p.id!=='waiting')).toEqual(before.players);
  for(const [id,cards]of Object.entries(originalHands))expect(hands[id]).toEqual(cards);
  if(['pok','poker','oldmaid','liar'].includes(kind))expect(hands.waiting).toEqual([]);
  if(kind==='spyfall')expect(privateData.waiting.role).toBeNull();
  if(kind==='whoami')expect(privateData.waiting.identities).toEqual([]);
  if(kind==='undercover')expect(privateData.waiting).toMatchObject({word:null,canGuess:false,vote:null});
  const attempted=kind==='spyfall'?'chat':kind==='whoami'?'answer':kind==='undercover'?'acknowledge':kind==='liar'?'challenge':kind==='oldmaid'?'draw':kind==='pok'?'draw':'allIn';
  expect(()=>act(game,'waiting',attempted,'bad')).toThrow('รอเข้าร่วมรอบถัดไป');
  game.disconnect('waiting');game.reconnect('waiting');expect(game.snapshot().players.find(p=>p.id==='waiting')?.waiting).toBe(true);expect(game.deadline).toBe(before.deadline);
  finish(game,hands);const ended=JSON.stringify(game.snapshot());
  const snapshot=game.snapshot();
  if('results' in snapshot)expect(snapshot.results.some(result=>result.id==='waiting')).toBe(false);
  if(game instanceof OldMaidGame){expect(game.snapshot().result!.winners).not.toContain('waiting');expect(game.players.get('waiting')!.wins).toBe(0);}
  if(game instanceof LiarGame)expect(game.snapshot().result!.hands.some(p=>p.playerId==='waiting')).toBe(false);
  if(game instanceof SpyfallGame)expect(game.players.get('waiting')!.score).toBe(0);
  if(game instanceof UndercoverGame){expect(game.snapshot().result!.winnerIds).not.toContain('waiting');expect(game.snapshot().result!.words.some(p=>p.playerId==='waiting')).toBe(false);}
  if(game instanceof WhoAmIGame)expect(game.snapshot().result!.identities.some(p=>p.playerId==='waiting')).toBe(false);
  expect(ended.length).toBeGreaterThan(0);
  act(game,game.hostId,'prepareRound');expect(game.players.get('waiting')?.waiting).not.toBe(true);
  for(const p of game.players.values())if(p.id!==game.hostId)act(game,p.id,'setReady',true);act(game,game.hostId,'startRound');
  expect(game.roundId).toBe(2);expect(game.players.get('waiting')?.waiting).not.toBe(true);game.sync('waiting');
  if(['pok','poker'].includes(kind))expect(hands.waiting).toHaveLength(2);
  if(['oldmaid','liar'].includes(kind))expect(hands.waiting.length).toBeGreaterThan(0);
  if(kind==='spyfall')expect(privateData.waiting.role).not.toBeNull();
  if(kind==='whoami')expect(privateData.waiting.identities).toHaveLength(3);
  if(kind==='undercover')expect(privateData.waiting.word).not.toBeNull();
 });
 it('enforces capacity and immediately frees a departing waiting seat without restarting a turn',()=>{
  const {game}=fixture(kind),phase=game.phase,deadline=game.deadline;
  for(let i=3;i<capacities[kind];i++)game.add('Waiting '+i,'w'+i);
  expect(()=>game.add('Overflow','extra')).toThrow('เต็ม');game.expire('w3');expect(game.players.has('w3')).toBe(false);
  game.add('Replacement','replacement');expect(game.players.size).toBe(capacities[kind]);expect(game.phase).toBe(phase);expect(game.deadline).toBe(deadline);
 });
});
it('Who am I also admits waiters at the next game within a multi-game set',()=>{
 const {game,hands,privateData}=fixture('whoami');if(!(game instanceof WhoAmIGame))throw Error('fixture');game.add('Next game','waiting');finish(game,hands);expect(game.phase).toBe('GAME_END');
 act(game,game.hostId,'nextGame');expect(game.players.get('waiting')?.waiting).not.toBe(true);expect(privateData.waiting.identities).toHaveLength(3);
});

it('a waiting Pokdeng guest leaving never replaces a disconnected dealer in the active round',()=>{
 const {game}=fixture('pok');if(!(game instanceof Game))throw Error('fixture');const dealer=game.dealerId,deadline=game.deadline;
 game.disconnect(dealer);game.add('Waiting','waiting');game.expire('waiting');expect(game.dealerId).toBe(dealer);expect(game.deadline).toBe(deadline);expect(game.players.has(dealer)).toBe(true);
});
