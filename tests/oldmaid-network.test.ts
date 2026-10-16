import {beforeAll,afterAll,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {Server} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,Room} from '@colyseus/sdk';
import {OldMaidRoom} from '../apps/server/src/oldmaid-room';
import {OldMaidGame} from '../apps/server/src/oldmaid-game';
import type {OldMaidHooks} from '../apps/server/src/oldmaid-game';
import type {OldMaidSnapshot} from '../packages/shared/src/oldmaid';
import type {Card} from '../packages/shared/src/index';
class TestRoom extends OldMaidRoom {protected makeGame(code:string,hooks:OldMaidHooks){let seed=27;return new OldMaidGame(code,hooks,max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;},30000);}}
let server:Server,endpoint:string,serial=0;const rooms:Room[]=[];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean){const end=Date.now()+4000;while(!fn()){if(Date.now()>end)throw new Error('Old Maid WebSocket timeout');await sleep(10);}}
interface Observer {room:Room;state?:OldMaidSnapshot;hand:Card[];errors:string[]}
function observe(room:Room){room.reconnection.enabled=false;rooms.push(room);const o:Observer={room,hand:[],errors:[]};room.onMessage('snapshot',(s:OldMaidSnapshot)=>o.state=s);room.onMessage('hand',(m:{cards:Card[]})=>o.hand=m.cards);room.onMessage('error',(e:{message:string})=>o.errors.push(e.message));room.send('sync');return o;}
function send(o:Observer,type:string,value?:unknown){o.room.send('action',{type,value,roundId:o.state!.roundId,actionId:'old-net-'+(++serial)});}
beforeAll(async()=>{const http=createServer();server=new Server({gracefullyShutdown:false,transport:new WebSocketTransport({server:http,maxPayload:4096})});server.define('oldmaid',TestRoom);await server.listen(0,'127.0.0.1');const address=http.address();if(!address||typeof address==='string')throw new Error('No address');endpoint=`ws://127.0.0.1:${address.port}`;});
afterAll(async()=>{await Promise.all(rooms.map(r=>Promise.race([r.leave().catch(()=>{}),sleep(200)])));await server.gracefullyShutdown(false);});
it.each([3,8])('%s real clients keep hands private, reconnect and complete a round',async count=>{
 const group:Observer[]=[observe(await new Client(endpoint).create('oldmaid',{name:'Player 0',game:'oldmaid'}))];
 for(let i=1;i<count;i++)group.push(observe(await new Client(endpoint).joinById(group[0].room.roomId,{name:'Player '+i,game:'oldmaid'})));
 await until(()=>group.every(o=>o.state?.players.length===count));
 await expect(new Client(endpoint).joinById(group[0].room.roomId,{name:'Wrong',game:'spyfall'})).rejects.toThrow();
 if(count===8)await expect(new Client(endpoint).joinById(group[0].room.roomId,{name:'Extra',game:'oldmaid'})).rejects.toThrow();
 for(const o of group.slice(1))send(o,'setReady',true);
 await until(()=>group[0].state!.players.filter(p=>p.ready).length===count-1);send(group[0],'startRound');
 await until(()=>group.every(o=>o.state?.phase==='PLAYING'&&o.hand.length===o.state.players.find(p=>p.id===o.room.sessionId)!.cardCount));
 for(const o of group){expect(JSON.stringify(o.state!.players)).not.toContain('"suit"');expect(o.state!.result).toBeNull();expect('removedCard' in o.state!).toBe(false);}
 await expect(new Client(endpoint).joinById(group[0].room.roomId,{name:'Mid-round',game:'oldmaid'})).rejects.toThrow();
 const turn=group.find(o=>o.room.sessionId===group[0].state!.turnId)!,other=group.find(o=>o!==turn)!;
 send(other,'draw',`${other.state!.turnNumber}:0`);await until(()=>other.errors.some(e=>e.includes('ไม่ใช่ตา')));
 const token=other.room.reconnectionToken,id=other.room.sessionId,hand=[...other.hand],deadline=other.state!.deadline;
 const witness=group.find(o=>o!==other)!;other.room.connection.close(4010);await until(()=>witness.state!.players.find(p=>p.id===id)?.connected===false);
 const restored=observe(await new Client(endpoint).reconnect(token));group[group.indexOf(other)]=restored;
 await until(()=>restored.hand.length===hand.length&&restored.state?.players.find(p=>p.id===id)?.connected===true);expect(restored.hand).toEqual(hand);expect(restored.state!.deadline).toBe(deadline);
 let n=0;while(group[0].state!.phase==='PLAYING'&&n++<250){
  const s=group[0].state!,actor=group.find(o=>o.room.sessionId===s.turnId)!,target=group.find(o=>o.room.sessionId===s.targetId)!;
  await sleep(30);let index=target.hand.findIndex(c=>actor.hand.some(a=>a.rank===c.rank));if(index<0)index=0;
  send(actor,'draw',`${s.turnNumber}:${index}`);await until(()=>group.every(o=>o.state!.turnNumber>s.turnNumber||o.state!.phase==='RESULTS'));
 }
 await until(()=>group.every(o=>o.state?.phase==='RESULTS'));expect(n).toBeLessThan(250);
 for(const o of group){expect(o.state!.result!.winners).toHaveLength(count-1);expect(o.state!.result!.lastCard.rank).toBe(o.state!.result!.removedCard.rank);expect(o.state!.discardedPairs).toBe(25);}
 send(group.find(o=>o.room.sessionId===group[0].state!.hostId)!,'prepareRound');await until(()=>group.every(o=>o.state?.phase==='LOBBY'&&o.hand.length===0));
 for(const o of [...group].reverse())await o.room.leave();
});
