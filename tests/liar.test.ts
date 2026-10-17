import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { LiarGame } from '../apps/server/src/liar-game';
import { liarPoints, liarCardKey } from '../packages/shared/src/liar';
import type { Card } from '../packages/shared/src/index';
let game:LiarGame, hands:Record<string,Card[]>, serial:number;
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-18T00:00:00Z'));serial=0;hands={};let seed=27;
  game=new LiarGame('ABCDEF0123',{changed(){},hand(id,m){hands[id]=m.cards;}},max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;});
  for(let i=0;i<3;i++)game.add('Player '+i,'p'+i);
});
afterEach(()=>{game.dispose();vi.useRealTimers();});
function act(id:string,type:string,value?:unknown,actionId='action-'+(++serial),roundId=game.roundId){game.action(id,{type,value,actionId,roundId});}
function start(){for(const p of game.players.values())if(p.id!==game.hostId)act(p.id,'setReady',true);act(game.hostId,'startRound');}
function open(){const id=game.turnId!;act(id,'play',`${game.turnNumber}|1:clubs`);}
function play(key?:string){const id=game.turnId!,p=game.players.get(id)!;act(id,'play',`${game.turnNumber}|${key??liarCardKey(p.hand[0])}`);return id;}
function invariant(){const s=game.snapshot();expect([...game.players.values()].reduce((n,p)=>n+p.hand.length,0)+s.discardedCount+(['RESPONSE','REVEAL'].includes(s.phase)?1:0)).toBe(52);}
it.each([2,3,4,5,6])('deals all 52 cards across %i people and opens only A clubs',count=>{
  if(count===2)game.players.delete('p2');else for(let i=3;i<count;i++)game.add('P'+i,'p'+i);
  start();expect(Object.values(hands).flat()).toHaveLength(52);expect(new Set(Object.values(hands).flat().map(liarCardKey)).size).toBe(52);
  expect(game.players.get(game.turnId!)!.hand).toContainEqual({rank:1,suit:'clubs'});
  expect(()=>act(game.turnId!,'skip',String(game.turnNumber))).toThrow('เปิด A');
  const other=game.players.get(game.turnId!)!.hand.find(c=>liarCardKey(c)!=='1:clubs')!;
  expect(()=>play(liarCardKey(other))).toThrow('A♣');open();expect(game.requiredRank).toBe(2);expect(game.snapshot().latest?.card).toEqual({rank:1,suit:'clubs'});invariant();
});
it('skips retain rank, advance seat, and all consecutive skips count scores',()=>{
 start();open();const rank=game.requiredRank, first=game.turnId;for(let i=0;i<3;i++){act(game.turnId!,'skip',String(game.turnNumber));expect(game.requiredRank).toBe(rank);}
 expect(game.phase).toBe('RESULTS');expect(game.turnId).toBeNull();expect(first).toBeTruthy();const result=game.snapshot().result!;
 expect(result.reason).toBe('all_skipped');const max=Math.max(...result.hands.map(h=>h.points));expect(result.loserIds).toEqual(result.hands.filter(h=>h.points===max).map(h=>h.playerId));invariant();
});
it('resets consecutive skips on any played card even when caught, returns only latest card',()=>{
 start();open();act(game.turnId!,'skip',String(game.turnNumber));const p=game.players.get(game.turnId!)!,bad=p.hand.find(c=>c.rank!==game.requiredRank)!,before=p.hand.length,discarded=game.snapshot().discardedCount;
 play(liarCardKey(bad));expect(game.skipCount).toBe(0);expect(game.snapshot().latest?.card).toBeNull();const challenger=[...game.players.values()].find(x=>x.id!==p.id)!;
 act(challenger.id,'challenge',game.snapshot().latest!.id);expect(game.phase).toBe('REVEAL');expect(game.snapshot().latest).toMatchObject({card:bad,truthful:false});invariant();
 vi.advanceTimersByTime(2500);expect(p.hand.length).toBe(before);expect(game.snapshot().discardedCount).toBe(discarded);expect(game.requiredRank).toBe(3);invariant();
});
it('a truthful challenge has no penalty for anyone and only latest card is revealed',()=>{
 start();open();let p=game.players.get(game.turnId!)!;let good=p.hand.find(c=>c.rank===2);
 // Reach a player who holds a 2 without changing the required rank.
 while(!good){act(p.id,'skip',String(game.turnNumber));p=game.players.get(game.turnId!)!;good=p.hand.find(c=>c.rank===2);}
 const challenger=[...game.players.values()].find(x=>x.id!==p.id)!,before=challenger.hand.map(liarCardKey),size=p.hand.length;
 play(liarCardKey(good));act(challenger.id,'challenge',game.snapshot().latest!.id);expect(game.snapshot().latest?.truthful).toBe(true);
 vi.advanceTimersByTime(2500);expect(challenger.hand.map(liarCardKey)).toEqual(before);expect(p.hand).toHaveLength(size-1);invariant();
});
it('accepts a bluff if nobody challenges, keeps it hidden, and closes stale challenges',()=>{
 start();open();const p=game.players.get(game.turnId!)!,bad=p.hand.find(c=>c.rank!==2)!;play(liarCardKey(bad));const id=game.snapshot().latest!.id;
 expect(game.snapshot().latest?.card).toBeNull();vi.advanceTimersByTime(5000);expect(game.requiredRank).toBe(3);expect(game.snapshot().latest?.card).toBeNull();
 expect(()=>act([...game.players.keys()].find(x=>x!==p.id)!,'challenge',id)).toThrow('หมดเวลา');invariant();
});
it('guards duplicate, out-of-turn, stale turn, forged card, stale round, own and concurrent challenge actions',()=>{
 start();open();const s=game.snapshot(),id=s.turnId!,other=[...game.players.keys()].find(x=>x!==id)!;
 expect(()=>act(other,'play',`${s.turnNumber}|1:clubs`)).toThrow('ไม่ใช่ตา');expect(()=>act(id,'play',`${s.turnNumber-1}|1:clubs`)).toThrow('จบแล้ว');
 expect(()=>act(id,'play',`${s.turnNumber}|99:hearts`)).toThrow('ในมือ');expect(()=>act(id,'play',`${s.turnNumber}|2:hearts|3:clubs`)).toThrow('1 ใบ');
 expect(()=>act(id,'skip',String(s.turnNumber),'old',0)).toThrow('รอบเก่า');
 const key=liarCardKey(game.players.get(id)!.hand[0]);act(id,'play',`${s.turnNumber}|${key}`,'repeat');const after=game.snapshot();act(id,'play',`${s.turnNumber}|${key}`,'repeat');expect(game.snapshot()).toEqual(after);
 expect(()=>act(id,'challenge',after.latest!.id)).toThrow('คนอื่น');act(other,'challenge',after.latest!.id);expect(()=>act([...game.players.keys()].find(x=>x!==other&&x!==id)!,'challenge',after.latest!.id)).toThrow('หมดเวลา');
});
it('does not finish an empty hand until challenge closes; caught last card restores eligibility',()=>{
 start();open();const p=game.players.get(game.turnId!)!;p.hand=[{rank:9,suit:'hearts'}];play();expect(p.finished).toBe(false);expect(p.hand).toHaveLength(0);
 act([...game.players.keys()].find(x=>x!==p.id)!,'challenge',game.snapshot().latest!.id);vi.advanceTimersByTime(2500);expect(p.finished).toBe(false);expect(p.hand).toHaveLength(1);
});
it('winners leave turn order, remaining players continue, and last remaining player loses',()=>{
 start();open();const p=game.players.get(game.turnId!)!;p.hand=[{rank:2,suit:'clubs'}];play();expect(p.finished).toBe(false);vi.advanceTimersByTime(5000);expect(p.finished).toBe(true);expect(p.wins).toBe(1);expect(game.phase).toBe('PLAYING');
 const next=game.players.get(game.turnId!)!;next.hand=[{rank:3,suit:'hearts'}];play();vi.advanceTimersByTime(5000);expect(game.phase).toBe('RESULTS');expect(game.snapshot().result?.reason).toBe('last_player');expect(game.snapshot().result?.loserIds).toHaveLength(1);
});
it('counts A as 1 and every face or ten as 10, including tied losers',()=>{
 expect(liarPoints([{rank:1,suit:'clubs'},{rank:9,suit:'hearts'},...[10,11,12,13].map(rank=>({rank,suit:'spades' as const}))])).toBe(50);
 start();open();for(const p of game.players.values())p.hand=[{rank:13,suit:'hearts'}];for(let i=0;i<3;i++)act(game.turnId!,'skip',String(game.turnNumber));expect(game.snapshot().result?.loserIds).toHaveLength(3);
});
it('wraps K to A, uses timeout skip, and auto-opens A clubs',()=>{
 start();vi.advanceTimersByTime(30000);expect(game.requiredRank).toBe(2);expect(game.opening).toBe(false);const turn=game.turnNumber;vi.advanceTimersByTime(30000);expect(game.turnNumber).toBe(turn+1);expect(game.requiredRank).toBe(2);
 game.requiredRank=13;play();vi.advanceTimersByTime(5000);expect(game.requiredRank).toBe(1);invariant();
});
it('restores private hand without resetting deadline and migrates host; expired seats skip',()=>{
 start();open();const id=game.turnId!,deadline=game.deadline,original=hands[id];game.disconnect(id);vi.advanceTimersByTime(1000);game.reconnect(id);expect(game.deadline).toBe(deadline);expect(hands[id]).toEqual(original);
 game.disconnect('p0');game.expire('p0');expect(game.hostId).not.toBe('p0');if(game.turnId==='p0'){const t=game.turnNumber;vi.advanceTimersByTime(500);expect(game.turnNumber).toBe(t+1);}invariant();
});
it('bounds history, clones snapshots and private hands, clears timers and state for replay',()=>{
 start();open();hands.p0[0].rank=99;expect(game.players.get('p0')!.hand.every(c=>c.rank<=13)).toBe(true);
 const s=game.snapshot();s.players[0].cardCount=99;expect(game.snapshot().players[0].cardCount).not.toBe(99);expect(JSON.stringify(s.players)).not.toContain('suit');
 for(let i=0;i<3;i++)act(game.turnId!,'skip',String(game.turnNumber));act(game.hostId,'prepareRound');expect(game.snapshot()).toMatchObject({phase:'LOBBY',result:null,latest:null,history:[],skipCount:0,discardedCount:0});expect(Object.values(hands).every(h=>h.length===0)).toBe(true);
 game.dispose();expect(vi.getTimerCount()).toBe(0);
});
it('bots and departed players operate with bounded timers and conserve all cards',()=>{
 game.addBot();start();open();for(let n=0;n<150&&game.phase!=='RESULTS';n++){
  if(game.phase==='PLAYING'){const p=game.players.get(game.turnId!)!;if(!p.isBot){const c=p.hand.find(c=>c.rank===game.requiredRank);if(c)play(liarCardKey(c));else act(p.id,'skip',String(game.turnNumber));}else vi.advanceTimersByTime(900);}
  else vi.advanceTimersByTime(5000);invariant();
 }
 expect(game.snapshot().history.length).toBeLessThanOrEqual(40);game.dispose();expect(vi.getTimerCount()).toBe(0);
});
