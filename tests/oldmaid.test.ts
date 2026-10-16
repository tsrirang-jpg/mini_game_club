import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {OldMaidGame} from '../apps/server/src/oldmaid-game';
import type {Card} from '../packages/shared/src/index';
import type {OldMaidHandMessage} from '../packages/shared/src/oldmaid';
let game:OldMaidGame;let serial=0;let hands:Record<string,Card[]>;
let messages:Record<string,OldMaidHandMessage>;
const rng=(seed:number)=>(max:number)=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)%max;};
function create(count=3,seed=17){game=new OldMaidGame('TEST',{changed(){},hand(id,data){hands[id]=data.cards;messages[id]=data;}},rng(seed));for(let i=0;i<count;i++)game.add('Player '+i,'p'+i);}
function act(id:string,type:string,value?:unknown,actionId='action-'+(++serial),roundId=game.roundId){game.action(id,{type,value,actionId,roundId});}
function start(){for(const p of game.players.values())if(p.id!==game.hostId)act(p.id,'setReady',true);act(game.hostId,'startRound');}
function draw(){const s=game.snapshot(), own=hands[s.turnId!], target=hands[s.targetId!];let index=target.findIndex(c=>own.some(o=>o.rank===c.rank));if(index<0)index=0;act(s.turnId!,'draw',`${s.turnNumber}:${index}`);}
function invariant(){const s=game.snapshot();expect(s.players.reduce((n,p)=>n+p.cardCount,0)+s.discardedPairs*2).toBe(51);for(const p of s.players){expect(new Set(hands[p.id].map(c=>c.rank)).size).toBe(hands[p.id].length);expect(p.cardCount).toBe(hands[p.id].length);}expect('removedCard' in s).toBe(false);expect(s.players.every(p=>!('hand' in p)&&!('seen' in p))).toBe(true);}
beforeEach(()=>{vi.useFakeTimers();hands={};messages={};serial=0;create();});afterEach(()=>{game.dispose();vi.useRealTimers();});
describe('Old Maid authoritative game',()=>{
 it('requires 3–8 people, valid names, host start and everyone ready',()=>{expect(()=>game.add('','bad')).toThrow();expect(()=>act('p1','startRound')).toThrow('เฉพาะ');expect(()=>act('p0','startRound')).toThrow('พร้อม');game.expire('p2');expect(()=>act('p0','startRound')).toThrow('3–8');});
 it.each([3,4,5,6,7,8])('deals privately, discards pairs and finishes a %s-player round with exactly one loser',count=>{game.dispose();create(count);start();invariant();let turns=0;while(game.phase==='PLAYING'&&turns++<2500){draw();invariant();}expect(turns).toBeLessThan(2500);const s=game.snapshot();expect(s.phase).toBe('RESULTS');expect(s.discardedPairs).toBe(25);expect(s.result!.lastCard.rank).toBe(s.result!.removedCard.rank);expect(s.result!.lastCard.suit).not.toBe(s.result!.removedCard.suit);expect(s.result!.winners).toHaveLength(count-1);expect(s.players.filter(p=>p.finished)).toHaveLength(count-1);expect(s.players.reduce((a,p)=>a+p.wins,0)).toBe(count-1);expect(()=>act(s.result!.loserId,'draw','0:0')).toThrow();});
 it('allows up to eight people and rejects a ninth',()=>{for(let i=3;i<8;i++)game.add('Player '+i,'p'+i);expect(()=>game.add('Extra','extra')).toThrow('เต็ม');});
 it('removes any random rank, keeps it secret, and reveals the matching unpaired rank only at the end',()=>{game.dispose();game=new OldMaidGame('ANY',{changed(){},hand(id,data){hands[id]=data.cards;}},max=>max-1);for(let i=0;i<3;i++)game.add('P'+i,'p'+i);start();expect(game.snapshot().result).toBeNull();let n=0;while(game.phase==='PLAYING'&&n++<1000)draw();expect(game.snapshot().result!.removedCard).toEqual({rank:13,suit:'spades'});expect(game.snapshot().result!.lastCard.rank).toBe(13);});
 it('rejects non-turn players, bad indices, stale turn/replayed actions and round IDs',()=>{start();const s=game.snapshot();expect(()=>act(s.targetId!,'draw',`${s.turnNumber}:0`)).toThrow('ไม่ใช่ตา');for(const val of [-1,0,'bad',`${s.turnNumber}:-1`,`${s.turnNumber}:99`,`${s.turnNumber+1}:0`])expect(()=>act(s.turnId!,'draw',val)).toThrow();act(s.turnId!,'draw',`${s.turnNumber}:0`,'same');const next=game.snapshot();act(s.turnId!,'draw',`${s.turnNumber}:0`,'same');expect(game.snapshot()).toEqual(next);expect(()=>act(next.turnId!,'draw',`${next.turnNumber}:0`,'old',0)).toThrow('รอบเก่า');expect(()=>act(game.hostId,'prepareRound')).toThrow('รอรอบ');});
 it('keeps opponents private, clones hand messages and snapshots',()=>{start();const s=game.snapshot();expect(JSON.stringify(s.players)).not.toContain('"suit"');for(const card of s.lastPair)expect(Object.values(hands).flat().some(c=>c.rank===card.rank&&c.suit===card.suit)).toBe(false);hands.p0[0].rank=99;expect(game.players.get('p0')!.hand.every(c=>c.rank<=13)).toBe(true);s.players[0].cardCount=99;expect(game.snapshot().players[0].cardCount).not.toBe(99);});
 it('times out to one server draw, rotates the turn and resets the deadline',()=>{start();const before=game.snapshot();vi.advanceTimersByTime(30000);const after=game.snapshot();expect(after.turnNumber).toBe(before.turnNumber+1);expect(after.deadline).toBe(Date.now()+30000);invariant();});
 it('restores the private hand on reconnect without restarting the turn timer',()=>{start();const id=game.snapshot().targetId!,hand=[...hands[id]],deadline=game.deadline;game.disconnect(id);vi.advanceTimersByTime(1000);game.reconnect(id);expect(hands[id]).toEqual(hand);expect(game.deadline).toBe(deadline);expect(game.players.get(id)!.connected).toBe(true);});
 it('keeps departed hands in play, automatically finishes expired seats and moves host',()=>{start();const s=game.snapshot();game.disconnect('p0');game.expire('p0');expect(game.hostId).not.toBe('p0');expect(game.players.has('p0')).toBe(true);if(s.turnId==='p0'){const t=game.turnNumber;vi.advanceTimersByTime(500);expect(game.turnNumber).toBe(t+1);}let n=0;while(game.phase==='PLAYING'&&n++<2500){const id=game.turnId!;if(id==='p0')vi.advanceTimersByTime(500);else draw();invariant();}expect(game.phase).toBe('RESULTS');act(game.hostId,'prepareRound');expect(game.players.has('p0')).toBe(false);expect(game.phase).toBe('LOBBY');});
 it('resets hands, results and readiness for a new round while preserving wins',()=>{start();let n=0;while(game.phase==='PLAYING'&&n++<2500)draw();const scores=game.snapshot().players.map(p=>p.wins);act(game.hostId,'prepareRound');expect(game.snapshot()).toMatchObject({phase:'LOBBY',result:null,deadline:0,discardedPairs:0});expect(Object.values(hands).every(h=>h.length===0)).toBe(true);expect(game.snapshot().players.map(p=>p.wins)).toEqual(scores);start();expect(game.roundId).toBe(2);invariant();});
 it('does not retain timers after room disposal',()=>{start();const turn=game.turnNumber;game.dispose();vi.advanceTimersByTime(90000);expect(game.turnNumber).toBe(turn);});
});
describe('Old Maid draw feedback and history',()=>{
 it('records exact initial discarded pairs without exposing any remaining hand',()=>{
  start();const s=game.snapshot();expect(s.history.length).toBe(s.discardedPairs);
  for(const e of s.history){expect(e.kind).toBe('deal');expect(e.pair).toHaveLength(2);expect(e.pair[0].rank).toBe(e.pair[1].rank);expect(Object.values(hands).flat()).not.toContainEqual(e.pair[0]);}
  expect(Object.values(messages).every(m=>m.oldMaid.draws.length===0)).toBe(true);
 });
 it('keeps drawn cards private, reports exact pairs, and never reuses a previous pair for an unmatched draw',()=>{
  start();let pairSeen=false,noPairSeen=false,n=0;
  while(game.phase==='PLAYING'&&n++<300){
   const s=game.snapshot(),id=s.turnId!,own=hands[id],target=hands[s.targetId!];
   let index=target.findIndex(c=>own.some(a=>a.rank===c.rank)===!pairSeen);if(index<0)index=0;
   const card={...target[index]},matched=own.find(c=>c.rank===card.rank),others=Object.fromEntries(Object.entries(messages).filter(([p])=>p!==id).map(([p,m])=>[p,structuredClone(m.oldMaid.draws)]));
   act(id,'draw',`${s.turnNumber}:${index}`);const latest=messages[id].oldMaid.draws.at(-1)!,pub=game.snapshot().history.at(-1)!;
   expect(latest.drawnCard).toEqual(card);expect(latest.targetName).toBe(game.players.get(s.targetId!)!.name);
   expect(pub).not.toHaveProperty('drawnCard');expect(JSON.stringify(game.snapshot().players)).not.toContain('draws');
   for(const [p,draws]of Object.entries(others))expect(messages[p].oldMaid.draws).toEqual(draws);
   if(matched){pairSeen=true;expect(latest.pair).toEqual(expect.arrayContaining([card,matched]));expect(hands[id]).not.toContainEqual(card);}
   else{noPairSeen=true;expect(latest.pair).toEqual([]);expect(pub.pair).toEqual([]);expect(hands[id]).toContainEqual(card);}
   invariant();if(pairSeen&&noPairSeen)break;
  }
  expect(pairSeen&&noPairSeen).toBe(true);
 });
 it('restores private feedback on reconnect, clones messages, ignores replay and clears history for the next round',()=>{
  start();const s=game.snapshot(),id=s.turnId!;act(id,'draw',`${s.turnNumber}:0`,'feedback-draw');const saved=structuredClone(messages[id].oldMaid);
  act(id,'draw',`${s.turnNumber}:0`,'feedback-draw');expect(messages[id].oldMaid).toEqual(saved);
  messages[id].oldMaid.draws[0].drawnCard.rank=99;game.disconnect(id);game.reconnect(id);expect(messages[id].oldMaid).toEqual(saved);
  const snapshot=game.snapshot();snapshot.history[0].pair[0].rank=99;expect(game.snapshot().history[0].pair[0].rank).not.toBe(99);
  let n=0;while(game.phase==='PLAYING'&&n++<2500)draw();act(game.hostId,'prepareRound');expect(game.snapshot().history).toEqual([]);expect(Object.values(messages).every(m=>m.oldMaid.draws.length===0)).toBe(true);start();expect(game.snapshot().history.every(e=>e.kind==='deal')).toBe(true);
 });
});
describe('Old Maid bots',()=>{
 it('lets a single human start with two ready bots and draw automatically before the human deadline',()=>{
  game.dispose();create(1);const first=game.addBot(),second=game.addBot();expect(game.snapshot().players.filter(p=>p.isBot).map(p=>p.ready)).toEqual([true,true]);act('p0','startRound');
  while(game.turnId==='p0'&&game.phase==='PLAYING')draw();const s=game.snapshot();expect([first,second]).toContain(s.turnId);
  vi.advanceTimersByTime(699);expect(game.turnNumber).toBe(s.turnNumber);vi.advanceTimersByTime(1);expect(game.turnNumber).toBe(s.turnNumber+1);invariant();
 });
 it.each([2,7])('finishes a full round with one human and %s randomly drawing bots',count=>{
  game.dispose();create(1,29);for(let i=0;i<count;i++)game.addBot();act('p0','startRound');let n=0;
  while(game.phase==='PLAYING'&&n++<3000){if(game.players.get(game.turnId!)!.isBot)vi.advanceTimersByTime(700);else draw();invariant();}
  expect(n).toBeLessThan(3000);expect(game.phase).toBe('RESULTS');expect(game.snapshot().result!.winners).toHaveLength(count);
  const s=game.snapshot();expect(s.discardedPairs).toBe(25);expect(s.result!.lastCard.rank).toBe(s.result!.removedCard.rank);act('p0','prepareRound');expect(game.snapshot().players.filter(p=>p.isBot).every(p=>p.ready)).toBe(true);act('p0','startRound');expect(game.phase).toBe('PLAYING');
 });
 it('counts bots in the eight-seat limit, protects management and only removes bots before a round',()=>{
  expect(()=>act('p1','addBot')).toThrow('เฉพาะ');act('p0','addBot');const bot=game.snapshot().players.find(p=>p.isBot)!;expect(()=>act('p1','removeBot',bot.id)).toThrow('เฉพาะ');expect(()=>act('p0','removeBot','p1')).toThrow('เลือกบอท');act('p0','removeBot',bot.id);expect(game.players.has(bot.id)).toBe(false);
  for(let i=0;i<5;i++)act('p0','addBot');expect(()=>act('p0','addBot')).toThrow('เต็ม');start();expect(()=>act('p0','addBot')).toThrow('รอรอบ');expect(()=>act('p0','removeBot',game.snapshot().players.find(p=>p.isBot)!.id)).toThrow('รอรอบ');
 });
 it('never transfers host to a bot, keeps human reconnection and clears bot timers on disposal',()=>{
  game.dispose();create(1);game.addBot();game.addBot();game.disconnect('p0');expect(game.hostId).toBe('');game.reconnect('p0');expect(game.hostId).toBe('p0');act('p0','startRound');while(game.turnId==='p0'&&game.phase==='PLAYING')draw();expect(vi.getTimerCount()).toBe(2);const turn=game.turnNumber;game.dispose();expect(vi.getTimerCount()).toBe(0);vi.advanceTimersByTime(60000);expect(game.turnNumber).toBe(turn);
 });
});
