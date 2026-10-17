import {beforeAll,afterAll,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {Server} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,Room} from '@colyseus/sdk';
import {LiarRoom} from '../apps/server/src/liar-room';
import {LiarGame} from '../apps/server/src/liar-game';
import type {LiarHooks} from '../apps/server/src/liar-game';
import type {LiarSnapshot} from '../packages/shared/src/liar';
import {liarCardKey,liarPoints} from '../packages/shared/src/liar';
import type {Card} from '../packages/shared/src/index';
class TestRoom extends LiarRoom {protected makeGame(code:string,hooks:LiarHooks){let seed=27;return new LiarGame(code,hooks,max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;},30000,300,100,100);}}
let server:Server,endpoint:string,serial=0;const rooms:Room[]=[];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean){const end=Date.now()+5000;while(!fn()){if(Date.now()>end)throw new Error('Liar WebSocket timeout');await sleep(10);}}
interface Observer{room:Room;state?:LiarSnapshot;hand:Card[];errors:string[]}
function observe(room:Room){room.reconnection.enabled=false;rooms.push(room);const o:Observer={room,hand:[],errors:[]};room.onMessage('snapshot',(s:LiarSnapshot)=>o.state=s);room.onMessage('hand',(m:{cards:Card[]})=>o.hand=m.cards);room.onMessage('error',(e:{message:string})=>o.errors.push(e.message));room.send('sync');return o;}
function send(o:Observer,type:string,value?:unknown){o.room.send('action',{type,value,roundId:o.state!.roundId,actionId:'liar-net-'+(++serial)});}
beforeAll(async()=>{const http=createServer();server=new Server({gracefullyShutdown:false,transport:new WebSocketTransport({server:http,maxPayload:4096})});server.define('liar',TestRoom);await server.listen(0,'127.0.0.1');const address=http.address();if(!address||typeof address==='string')throw new Error('No address');endpoint=`ws://127.0.0.1:${address.port}`;});
afterAll(async()=>{await Promise.all(rooms.map(r=>Promise.race([r.leave().catch(()=>{}),sleep(100)])));await server.gracefullyShutdown(false);});
it.each([2,3,6])('%i real clients: private deals, reconnect, immediate single-card challenge, skip ending and replay',async count=>{
 const group=[observe(await new Client(endpoint).create('liar',{name:'Host',game:'liar'}))];
 for(let i=1;i<count;i++)group.push(observe(await new Client(endpoint).joinById(group[0].room.roomId,{name:'Friend '+i,game:'liar'})));
 await until(()=>group.every(o=>o.state?.players.length===count));
 await expect(new Client(endpoint).joinById(group[0].room.roomId,{name:'Wrong',game:'oldmaid'})).rejects.toThrow();
 for(const o of group.slice(1))send(o,'setReady',true);await until(()=>group[0].state!.players.filter(p=>p.ready).length===count-1);send(group[0],'startRound');
 await until(()=>group.every(o=>o.state?.phase==='PLAYING'&&o.hand.length===o.state.players.find(p=>p.id===o.room.sessionId)!.cardCount));
 expect(group.flatMap(o=>o.hand)).toHaveLength(52);for(const o of group)expect(JSON.stringify(o.state!.players)).not.toContain('suit');
 const actor=group.find(o=>o.room.sessionId===group[0].state!.turnId)!;send(actor,'play',`${actor.state!.turnNumber}|1:clubs`);
 await until(()=>group.every(o=>o.state!.requiredRank===2));const next=group.find(o=>o.room.sessionId===group[0].state!.turnId)!,other=group.find(o=>o!==next)!,bad=next.hand.find(c=>c.rank!==2)!,before=next.hand.length;
 send(next,'play',`${next.state!.turnNumber}|${liarCardKey(bad)}`);await until(()=>other.state!.phase==='RESPONSE');expect(other.state!.latest?.card).toBeNull();expect(JSON.stringify(other.state!.players)).not.toContain('suit');send(other,'challenge',other.state!.latest!.id);
 await until(()=>group.every(o=>o.state!.phase==='REVEAL'));expect(other.state!.latest?.card).toEqual(bad);expect(other.state!.latest?.truthful).toBe(false);
 await until(()=>group.every(o=>o.state!.phase==='PLAYING'&&o.state!.requiredRank===3));expect(next.hand).toHaveLength(before);
 const token=other.room.reconnectionToken,id=other.room.sessionId,hand=structuredClone(other.hand),deadline=other.state!.deadline,witness=group.find(o=>o!==other)!;
 other.room.connection.close(4010);await until(()=>witness.state!.players.find(p=>p.id===id)?.connected===false);
 const restored=observe(await new Client(endpoint).reconnect(token));group[group.indexOf(other)]=restored;await until(()=>restored.state?.players.find(p=>p.id===id)?.connected===true&&restored.hand.length===hand.length);expect(restored.hand).toEqual(hand);expect(restored.state!.deadline).toBe(deadline);
 for(let i=0;i<count;i++){const s=group[0].state!,turn=group.find(o=>o.room.sessionId===s.turnId)!;send(turn,'skip',String(s.turnNumber));await until(()=>group.every(o=>o.state!.turnNumber>s.turnNumber||o.state!.phase==='RESULTS'));}
 for(const o of group){expect(o.state!.phase).toBe('RESULTS');expect(o.state!.result!.reason).toBe('all_skipped');for(const h of o.state!.result!.hands)expect(h.points).toBe(liarPoints(h.cards));}
 send(group.find(o=>o.room.sessionId===group[0].state!.hostId)!,'prepareRound');await until(()=>group.every(o=>o.state?.phase==='LOBBY'&&o.hand.length===0));for(const o of [...group].reverse())await o.room.leave();
});
it.each([-1,6,1.5,'2',true])('rejects invalid bot count %j',async botCount=>{await expect(new Client(endpoint).create('liar',{name:'Invalid',botCount})).rejects.toThrow('0–5');});
it.each([0,14,31,'30'])('rejects invalid turn seconds %j',async turnSeconds=>{await expect(new Client(endpoint).create('liar',{name:'Invalid',turnSeconds})).rejects.toThrow('15, 30');});
it('reserves bot seats and removes a bot before allowing another person',async()=>{
 const a=observe(await new Client(endpoint).create('liar',{name:'Solo',botCount:5}));await until(()=>a.state?.players.length===6);await expect(new Client(endpoint).joinById(a.room.roomId,{name:'Full',game:'liar'})).rejects.toThrow();
 send(a,'removeBot',a.state!.players.find(p=>p.isBot)!.id);await until(()=>a.state!.players.length===5);await sleep(50);const b=observe(await new Client(endpoint).joinById(a.room.roomId,{name:'Friend',game:'liar'}));await until(()=>b.state?.players.length===6);expect(b.state!.players.filter(p=>p.isBot)).toHaveLength(4);await b.room.leave();await a.room.leave();
});
