import {beforeAll,afterAll,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {Server} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,Room} from '@colyseus/sdk';
import {SpyfallRoom} from '../apps/server/src/spyfall-room';
import {SpyfallGame} from '../apps/server/src/spyfall-game';
import type {SpyHooks} from '../apps/server/src/spyfall-game';
import type {SpySnapshot,SpySecret} from '../packages/shared/src/spyfall';
class TestSpyRoom extends SpyfallRoom { protected makeGame(code:string,hooks:SpyHooks){return new SpyfallGame(code,hooks,()=>0,{minute:2000,voting:2000,guess:2000});} }
let server:Server;let endpoint:string;const rooms:Room[]=[];let serial=0;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean){const end=Date.now()+4000;while(!fn()){if(Date.now()>end)throw new Error('Spy WebSocket timeout');await sleep(10);}}
interface Observer {room:Room;state?:SpySnapshot;secret?:SpySecret;errors:string[]}
function observe(room:Room):Observer{room.reconnection.enabled=false;rooms.push(room);const o:Observer={room,errors:[]};room.onMessage('snapshot',(s:SpySnapshot)=>o.state=s);room.onMessage('secret',(s:SpySecret)=>o.secret=s);room.onMessage('error',(e:{message:string})=>o.errors.push(e.message));room.send('sync');return o;}
function send(o:Observer,type:string,value?:unknown){o.room.send('action',{type,value,roundId:o.state!.roundId,actionId:`net-spy-${++serial}`});}
beforeAll(async()=>{const http=createServer();server=new Server({gracefullyShutdown:false,transport:new WebSocketTransport({server:http,maxPayload:4096})});server.define('spyfall',TestSpyRoom);await server.listen(0,'127.0.0.1');const address=http.address();if(!address||typeof address==='string')throw new Error('No address');endpoint=`ws://127.0.0.1:${address.port}`;});
afterAll(async()=>{await Promise.all(rooms.map(r=>Promise.race([r.leave().catch(()=>{}),sleep(200)])));await server.gracefullyShutdown(false);});
it('3 WebSocket clients get private roles, chat, reconnect and vote/guess without exposing hidden state',async()=>{
  const a=observe(await new Client(endpoint).create('spyfall',{name:'A',questionMinutes:5}));
  let b=observe(await new Client(endpoint).joinById(a.room.roomId,{name:'B',game:'spyfall'}));
  const c=observe(await new Client(endpoint).joinById(a.room.roomId,{name:'C',game:'spyfall'}));
  await until(()=>a.state?.players.length===3&&b.state?.players.length===3&&c.state?.players.length===3);
  send(b,'setReady',true);send(c,'setReady',true);await until(()=>a.state!.players.filter(p=>p.ready).length===2);send(a,'startRound');
  await until(()=>a.secret?.role?.kind==='spy'&&b.secret?.role?.kind==='citizen'&&c.secret?.role?.kind==='citizen');
  expect(a.secret!.role!.location).toBeUndefined();expect(b.secret!.role!.location).toBe('โรงพยาบาล');expect(c.secret!.role!.location).toBe('โรงพยาบาล');
  expect(JSON.stringify(a.state)).not.toContain('โรงพยาบาล');expect(a.state!.result).toBeNull();
  send(a,'chat','ที่นี่คนเยอะไหม?');await until(()=>b.state!.chat.length===1&&c.state!.chat.length===1);
  expect(c.state!.chat[0].text).toBe('ที่นี่คนเยอะไหม?');
  const oldId=b.room.sessionId,token=b.room.reconnectionToken;b.room.connection.close(4010);await until(()=>a.state!.players.find(p=>p.id===oldId)?.connected===false);
  b=observe(await new Client(endpoint).reconnect(token));await until(()=>b.secret?.role?.location==='โรงพยาบาล');expect(b.room.sessionId).toBe(oldId);
  send(a,'readyVote',true);send(b,'readyVote',true);await sleep(20);expect(a.state!.phase).toBe('QUESTION');send(c,'readyVote',true);await until(()=>a.state!.phase==='VOTING'&&b.state!.phase==='VOTING'&&c.state!.phase==='VOTING');
  send(a,'vote',b.room.sessionId);send(b,'vote',a.room.sessionId);await until(()=>a.state!.players.filter(p=>p.hasVoted).length===2);
  expect(a.state!.result).toBeNull();expect('votes'in a.state!).toBe(false);expect(b.secret?.role?.ownVote).toBe(a.room.sessionId);
  send(c,'vote',a.room.sessionId);await until(()=>a.state!.phase==='GUESS');expect(JSON.stringify(a.state)).not.toContain('โรงพยาบาล');
  send(b,'chat','ห้ามบอกคำตอบ');await until(()=>b.errors.some(e=>e.includes('พักแชต')));
  send(c,'guess','โรงพยาบาล');await until(()=>c.errors.some(e=>e.includes('เฉพาะสายลับ')));
  send(a,'guess','โรงเรียน');await until(()=>a.state!.phase==='RESULTS'&&b.state!.phase==='RESULTS'&&c.state!.phase==='RESULTS');
  expect(a.state!.result!.winner).toBe('citizens');expect(a.state!.result!.location).toBe('โรงพยาบาล');expect(b.state!.players.find(p=>p.id===b.room.sessionId)?.score).toBe(1);
  send(a,'prepareRound');await until(()=>b.state!.phase==='LOBBY'&&b.secret?.role===null);expect(a.state!.chat).toEqual([]);
});
