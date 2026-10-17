import {beforeAll,afterAll,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {Server} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,Room} from '@colyseus/sdk';
import {WhoAmIRoom} from '../apps/server/src/whoami-room';
import {WhoAmIGame} from '../apps/server/src/whoami-game';
import type {WhoHooks} from '../apps/server/src/whoami-game';
import type {WhoSnapshot,WhoPrivate} from '../packages/shared/src/whoami';
class TestWhoRoom extends WhoAmIRoom {protected makeGame(code:string,hooks:WhoHooks){return new WhoAmIGame(code,hooks,()=>0,15000);}}
interface Observer {room:Room;state?:WhoSnapshot;private?:WhoPrivate;errors:string[]}
const rooms:Room[]=[],sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let server:Server,endpoint:string,serial=0;
async function until(fn:()=>boolean){const end=Date.now()+5000;while(!fn()){if(Date.now()>end)throw new Error('Who am I network timeout');await sleep(10);}}
function observe(room:Room):Observer{rooms.push(room);room.reconnection.enabled=false;const o:Observer={room,errors:[]};room.onMessage('snapshot',(s:WhoSnapshot)=>o.state=s);room.onMessage('identities',(p:WhoPrivate)=>o.private=p);room.onMessage('error',(e:{message:string})=>o.errors.push(e.message));room.send('sync');return o;}
function send(o:Observer,type:string,value?:unknown,extra:Record<string,unknown>={}){o.room.send('action',{type,value,roundId:o.state!.roundId,turnNumber:o.state!.turnNumber,actionId:`who-net-${++serial}`,...extra});}
async function group(){const a=observe(await new Client(endpoint).create('whoami',{name:'A'}));const b=observe(await new Client(endpoint).joinById(a.room.roomId,{name:'B',game:'whoami'}));const c=observe(await new Client(endpoint).joinById(a.room.roomId,{name:'C',game:'whoami'}));await until(()=>[a,b,c].every(o=>o.state?.players.length===3));send(b,'setReady',true);send(c,'setReady',true);await until(()=>a.state!.players.filter(p=>p.ready).length===2);send(a,'startRound');await until(()=>[a,b,c].every(o=>o.state?.phase==='PLAYING'&&o.private?.roundId===o.state.roundId));return[a,b,c];}
const ownWord=(group:Observer[],o:Observer)=>group.find(p=>p!==o)!.private!.identities.find(p=>p.playerId===o.room.sessionId)!.word;
beforeAll(async()=>{const http=createServer();server=new Server({gracefullyShutdown:false,transport:new WebSocketTransport({server:http,maxPayload:4096})});server.define('whoami',TestWhoRoom);await server.listen(0,'127.0.0.1');const address=http.address();if(!address||typeof address==='string')throw new Error('Missing port');endpoint=`ws://127.0.0.1:${address.port}`;});
afterAll(async()=>{await Promise.all(rooms.filter(room=>room.connection.isOpen).map(room=>Promise.race([room.leave().catch(()=>{}),sleep(200)])));await server.gracefullyShutdown(false);});
it.each([{questionRounds:5},{gameRounds:4},{turnMinutes:0},{category:'invalid'},{questionRounds:'4'},{botCount:1}])('rejects invalid room settings %j',async settings=>{await expect(new Client(endpoint).create('whoami',{name:'Bad settings',...settings})).rejects.toThrow();});
it('protects every own identity over real sockets, locks answers and restores private state without resetting the turn',async()=>{
 let [a,b,c]=await group();const participants=[a,b,c];
 for(const o of participants){expect(o.private!.identities).toHaveLength(2);expect(o.private!.identities.some(p=>p.playerId===o.room.sessionId)).toBe(false);expect(JSON.stringify(o.state)).not.toContain(ownWord(participants,o));}
 const deadline=a.state!.deadline,turnNumber=a.state!.turnNumber;send(a,'ask','ฉันมีชีวิตใช่ไหม?');await until(()=>!!c.state!.question);
 send(b,'answer','yes');await until(()=>b.private?.ownAnswer==='yes');
 const token=b.room.reconnectionToken,id=b.room.sessionId;b.room.connection.close(4010);await until(()=>a.state!.players.find(p=>p.id===id)?.connected===false);
 b=observe(await new Client(endpoint).reconnect(token));await until(()=>b.private?.ownAnswer==='yes'&&b.state?.turnNumber===turnNumber);
 expect(b.state!.deadline).toBe(deadline);expect(b.room.sessionId).toBe(id);expect(b.private!.identities.some(p=>p.playerId===id)).toBe(false);
 send(b,'answer','no');await until(()=>b.errors.some(e=>e.includes('เปลี่ยนไม่ได้')));send(c,'answer','yes');await until(()=>a.state?.question?.answer==='yes');
 send(a,'guess',ownWord([a,b,c],a));await until(()=>a.errors.some(e=>e.includes('ครั้งถัดไป')));expect(a.state!.players.find(p=>p.id===a.room.sessionId)!.score).toBe(0);
 for(const o of [a,b,c]){const n=a.state!.turnNumber;send(o,'endTurn');await until(()=>a.state!.turnNumber>n);}
 const n=a.state!.turnNumber;send(a,'guess',ownWord([a,b,c],a));await until(()=>a.state!.turnNumber>n);expect(a.state!.players.find(p=>p.id===a.room.sessionId)!.score).toBe(1);
 send(b,'ask','bad',{turnNumber});await until(()=>b.errors.some(e=>e.includes('ตาเก่า')));
 for(const o of [c,b,a])await o.room.leave();
});
it('finishes three games with exact cumulative scores, unique new identities, public reveal and clean lobby reset',async()=>{
 const participants=await group(),[a,b,c]=participants;
 for(let n=1;n<=3;n++){
  for(const o of participants){await until(()=>o.state?.turnId===o.room.sessionId&&o.private?.roundId===o.state.roundId);send(o,'guess',ownWord(participants,o));}
  await until(()=>participants.every(o=>o.state?.phase===(n===3?'RESULTS':'GAME_END')));
  for(const o of participants){expect(o.state!.result!.identities).toHaveLength(3);expect(o.state!.players.map(p=>p.score)).toEqual([n,n,n]);}
  if(n<3){const previous=a.private!.identities.map(p=>p.word),round=a.state!.roundId;send(a,'nextGame');await until(()=>participants.every(o=>o.state?.roundId===round+1&&o.private?.roundId===round+1));expect(a.private!.identities.map(p=>p.word)).not.toEqual(previous);}
 }
 send(a,'prepareRound');await until(()=>participants.every(o=>o.state?.phase==='LOBBY'&&o.private?.identities.length===0));expect(a.state!.history).toEqual([]);expect(a.state!.result).toBeNull();
 for(const o of [c,b,a])await o.room.leave();
});
it('isolates games, limits capacity and transfers host on consented exit',async()=>{
 const a=observe(await new Client(endpoint).create('whoami',{name:'Host',questionRounds:8,gameRounds:7,turnMinutes:2,category:'jobs'}));
 await until(()=>!!a.state);expect(a.state).toMatchObject({questionRounds:8,gameRounds:7,turnMinutes:2,category:'jobs'});
 await expect(new Client(endpoint).joinById(a.room.roomId,{name:'Wrong game',game:'poker'})).rejects.toThrow();
 const b=observe(await new Client(endpoint).joinById(a.room.roomId,{name:'B'}));await until(()=>b.state?.players.length===2);await a.room.leave();await until(()=>b.state?.hostId===b.room.sessionId&&b.state?.players.length===1);await b.room.leave();
});
