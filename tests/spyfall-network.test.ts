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
it.each([{questionMinutes:6},{questionMinutes:'7'},{votingMinutes:0},{votingMinutes:4},{guessMinutes:4},{guessMinutes:'2'},{playerCount:2},{playerCount:9}])('rejects invalid creation settings %j',async settings=>{
  await expect(new Client(endpoint).create('spyfall',{name:'Invalid',...settings})).rejects.toThrow();
});
it('enforces room capacity, applies host changes and broadcasts the selected question/vote/answer durations',async()=>{
  const a=observe(await new Client(endpoint).create('spyfall',{name:'Settings A',questionMinutes:7,votingMinutes:2,guessMinutes:3,playerCount:4}));
  const group=[a];
  for(const name of ['B','C','D'])group.push(observe(await new Client(endpoint).joinById(a.room.roomId,{name})));
  await until(()=>group.every(o=>o.state?.players.length===4));
  expect(a.state).toMatchObject({questionMinutes:7,votingMinutes:2,guessMinutes:3,playerCount:4,votingDurationMs:4000,guessDurationMs:6000});
  await expect(new Client(endpoint).joinById(a.room.roomId,{name:'Too many'})).rejects.toThrow();
  send(group[1],'setVotingMinutes',1);await until(()=>group[1].errors.some(e=>e.includes('เฉพาะ')));
  send(a,'setPlayerCount',3);await until(()=>a.errors.some(e=>e.includes('ไม่น้อยกว่า')));
  send(a,'setPlayerCount',5);await until(()=>group.every(o=>o.state?.playerCount===5));
  group.push(observe(await new Client(endpoint).joinById(a.room.roomId,{name:'E'})));
  await until(()=>group.every(o=>o.state?.players.length===5));
  for(const o of group.slice(1))send(o,'setReady',true);
  await until(()=>a.state!.players.filter(p=>p.ready).length===4);send(a,'startRound');
  await until(()=>group.every(o=>o.state?.phase==='QUESTION'));
  expect(a.state!.phaseDurationMs).toBe(14000);
  for(const o of group)send(o,'readyVote',true);
  await until(()=>group.every(o=>o.state?.phase==='VOTING'));expect(a.state!.phaseDurationMs).toBe(4000);
  for(const o of group)send(o,'vote',o===a?group[1].room.sessionId:a.room.sessionId);
  await until(()=>group.every(o=>o.state?.phase==='GUESS'));expect(a.state!.phaseDurationMs).toBe(6000);
  send(a,'guess','โรงพยาบาล');await until(()=>group.every(o=>o.state?.phase==='RESULTS'));
  for(const o of group)expect(o.state?.result?.winner).toBe('spy');
  for(const o of group.reverse())await o.room.leave();
});
it.each(['wrong_answer','surrender'])('3 WebSocket clients get private roles, chat, reconnect and vote/%s without exposing hidden state',async(outcome)=>{
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
  send(b,'vote',c.room.sessionId);await until(()=>b.errors.some(e=>e.includes('เปลี่ยนเสียงไม่ได้')));
  expect(b.secret?.role?.ownVote).toBe(a.room.sessionId);expect(a.state!.phase).toBe('VOTING');
  send(c,'vote',a.room.sessionId);await until(()=>a.state!.phase==='GUESS');expect(JSON.stringify(a.state)).not.toContain('โรงพยาบาล');
  send(b,'chat','ห้ามบอกคำตอบ');await until(()=>b.errors.some(e=>e.includes('พักแชต')));
  send(c,'guess','โรงพยาบาล');await until(()=>c.errors.some(e=>e.includes('เฉพาะสายลับ')));
  send(c,'surrender');await until(()=>c.errors.some(e=>e.includes('ยอมแพ้ได้')));
  if(outcome==='surrender')send(a,'surrender');else send(a,'guess','โรงเรียน');
  await until(()=>a.state!.phase==='RESULTS'&&b.state!.phase==='RESULTS'&&c.state!.phase==='RESULTS');
  expect(a.state!.result!.winner).toBe('citizens');expect(a.state!.result!.location).toBe('โรงพยาบาล');expect(b.state!.players.find(p=>p.id===b.room.sessionId)?.score).toBe(1);
  for(const o of [a,b,c])expect(o.state!.result!.reason).toBe(outcome==='surrender'?'spy_surrendered':'wrong_guess');
  send(a,'prepareRound');await until(()=>b.state!.phase==='LOBBY'&&b.secret?.role===null);expect(a.state!.chat).toEqual([]);
});
it.each([[' HOSPITAL ','spy','correct_guess'],['โรงเรียน','citizens','wrong_guess']] as const)('spy can answer %s during questioning over WebSocket',async(answer,winner,reason)=>{
  const a=observe(await new Client(endpoint).create('spyfall',{name:'Spy'}));
  const b=observe(await new Client(endpoint).joinById(a.room.roomId,{name:'Citizen B',game:'spyfall'}));
  const c=observe(await new Client(endpoint).joinById(a.room.roomId,{name:'Citizen C',game:'spyfall'}));
  await until(()=>a.state?.players.length===3&&b.state?.players.length===3&&c.state?.players.length===3);
  send(b,'setReady',true);send(c,'setReady',true);await until(()=>a.state!.players.filter(p=>p.ready).length===2);send(a,'startRound');
  await until(()=>a.state?.phase==='QUESTION'&&a.secret?.role?.kind==='spy'&&b.secret?.role?.kind==='citizen');
  expect(a.secret?.role?.location).toBeUndefined();expect(JSON.stringify(a.state)).not.toContain('โรงพยาบาล');
  send(b,'guess','โรงพยาบาล');await until(()=>b.errors.some(e=>e.includes('เฉพาะสายลับ')));
  expect(a.state?.phase).toBe('QUESTION');send(a,'guess',answer);
  await until(()=>[a,b,c].every(o=>o.state?.phase==='RESULTS'));
  for(const o of [a,b,c])expect(o.state?.result).toMatchObject({winner,reason,accusedId:null,location:'โรงพยาบาล'});
  expect(a.state!.players.map(p=>p.score)).toEqual(winner==='spy'?[1,0,0]:[0,1,1]);
  send(a,'guess',answer);await until(()=>a.errors.some(e=>e.includes('เฉพาะสายลับ')));
  expect(a.state!.players.map(p=>p.score)).toEqual(winner==='spy'?[1,0,0]:[0,1,1]);
  for(const o of [c,b,a])await o.room.leave();
});
