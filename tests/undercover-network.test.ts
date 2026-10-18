import {beforeAll,afterAll,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {Server} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,Room} from '@colyseus/sdk';
import {UndercoverRoom} from '../apps/server/src/undercover-room';
import {UndercoverGame} from '../apps/server/src/undercover-game';
import type {CardRoomHooks} from '../apps/server/src/runtime/card-room';
import type {UnderSnapshot,UnderSecret} from '../packages/shared/src/undercover';
class TestRoom extends UndercoverRoom {protected makeGame(code:string,hooks:CardRoomHooks){let seed=16;const g=new UndercoverGame(code,{changed:hooks.changed,secret:(id,data)=>this.clients.find(c=>c.sessionId===id)?.send('undercover',data)},max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;},.05);g.settings={turnMinutes:1,voteMinutes:1,undercoverCount:1,whiteCount:1};return g;}}
let server:Server,endpoint:string,serial=0;const rooms:Room[]=[];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean){const end=Date.now()+6000;while(!fn()){if(Date.now()>end)throw new Error('Undercover WebSocket timeout');await sleep(10);}}
interface Observer {room:Room;state?:UnderSnapshot;secret?:UnderSecret;errors:string[]}
function observe(room:Room){rooms.push(room);room.reconnection.enabled=false;const o:Observer={room,errors:[]};room.onMessage('snapshot',(s:UnderSnapshot)=>o.state=s);room.onMessage('undercover',(s:UnderSecret)=>o.secret=s);room.onMessage('error',(e:{message:string})=>o.errors.push(e.message));room.send('sync');return o;}
function send(o:Observer,type:string,value?:unknown){o.room.send('action',{type,value,roundId:o.state!.roundId,turnNumber:o.state!.turnNumber,actionId:'under-net-'+(++serial)});}
beforeAll(async()=>{const http=createServer();server=new Server({gracefullyShutdown:false,transport:new WebSocketTransport({server:http,maxPayload:4096})});server.define('undercover',TestRoom);await server.listen(0,'127.0.0.1');const a=http.address();if(!a||typeof a==='string')throw new Error('No address');endpoint=`ws://127.0.0.1:${a.port}`;});
afterAll(async()=>{await Promise.all(rooms.map(r=>Promise.race([r.leave().catch(()=>{}),sleep(100)])));await server.gracefullyShutdown(false);});
it.each([4,8])('%i clients keep words and votes private, reconnect, catch White and guess before results',async count=>{
 const group=[observe(await new Client(endpoint).create('undercover',{name:'Host'}))];for(let i=1;i<count;i++)group.push(observe(await new Client(endpoint).joinById(group[0].room.roomId,{name:'Friend '+i,game:'undercover'})));
 await until(()=>group.every(o=>o.state?.players.length===count));await expect(new Client(endpoint).joinById(group[0].room.roomId,{name:'Wrong',game:'liar'})).rejects.toThrow();
 for(const o of group.slice(1))send(o,'setReady',true);await until(()=>group[0].state!.players.filter(p=>p.ready).length===count-1);send(group[0],'startRound');await until(()=>group.every(o=>o.state?.phase==='WORD'&&o.secret?.roundId===1));
 for(const o of group){expect(Object.keys(o.secret!).sort()).toEqual(['canGuess','roundId','vote','word']);expect(JSON.stringify(o.state)).not.toMatch(/"role"|"word"|"answer"/);}
 const white=group.find(o=>o.secret!.word===null)!,word=group.map(o=>o.secret!.word).find(word=>word&&group.filter(o=>o.secret!.word===word).length>1)!;
 await expect(new Client(endpoint).joinById(group[0].room.roomId,{name:'Late',game:'undercover'})).rejects.toThrow();for(const o of group)send(o,'acknowledge');await until(()=>group.every(o=>o.state!.phase==='DESCRIBE'));
 const beforeChat=group[0].state!;send(group[1],'chat','คุยกันระหว่างรอ');await until(()=>group.every(o=>o.state!.chat.length===1));
 for(const o of group){expect(o.state!.chat[0]).toMatchObject({playerId:group[1].room.sessionId,name:'Friend 1',text:'คุยกันระหว่างรอ'});expect(o.state!.hints).toHaveLength(0);expect(o.state!.turnNumber).toBe(beforeChat.turnNumber);expect(o.state!.deadline).toBe(beforeChat.deadline);}
 for(let i=0;i<count;i++){const s=group[0].state!,actor=group.find(o=>o.room.sessionId===s.turnId)!;send(actor,'hint','คำใบ้ '+i);await until(()=>group.every(o=>o.state!.turnNumber>s.turnNumber));}
 await until(()=>group.every(o=>o.state!.phase==='DISCUSS'));
 expect(group[0].state!.deadline).toBe(0);send(group[0],'chat','สนทนาก่อนโหวต');await until(()=>group.every(o=>o.state!.chat.length===2));
 for(const o of group.slice(0,-1))send(o,'readyVote');await until(()=>group.every(o=>o.state!.voteReadyIds.length===count-1));
 expect(group.every(o=>o.state!.phase==='DISCUSS')).toBe(true);send(group.at(-1)!,'readyVote');
 await until(()=>group.every(o=>o.state!.phase==='VOTING'));const voter=group.find(o=>o!==white)!,witness=group.find(o=>o!==voter)!;send(voter,'vote',{targetId:white.room.sessionId});await until(()=>group.every(o=>o.state!.submittedIds.includes(voter.room.sessionId)));
 for(const o of group){expect(o.state!.lastVote).toBeNull();expect(JSON.stringify(o.state)).not.toContain('suspect');if(o!==voter)expect(o.secret!.vote).toBeNull();}
 const token=voter.room.reconnectionToken,id=voter.room.sessionId,saved=structuredClone(voter.secret),deadline=voter.state!.deadline;voter.room.connection.close(4010);await until(()=>witness.state!.players.find(p=>p.id===id)?.connected===false);const restored=observe(await new Client(endpoint).reconnect(token));group[group.indexOf(voter)]=restored;await until(()=>restored.secret?.roundId===1&&!!restored.state);expect(restored.secret).toEqual(saved);expect(restored.state!.deadline).toBe(deadline);expect(restored.state!.chat).toEqual(witness.state!.chat);send(restored,'vote',{targetId:white.room.sessionId});await until(()=>restored.errors.length>0);
 for(const o of group.filter(o=>o!==restored))send(o,'vote',{targetId:o===white?restored.room.sessionId:white.room.sessionId});
 await until(()=>group.every(o=>o.state!.phase==='REVEAL'));for(const o of group){expect(o.state!.lastVote).toMatchObject({targetId:white.room.sessionId,role:'white'});expect(o.state!.result).toBeNull();expect(o.state!.players.every(p=>!('role'in p))).toBe(true);expect(o.secret!.canGuess).toBe(false);}
 await until(()=>group.every(o=>o.state!.phase==='GUESS'));expect(white.secret!.canGuess).toBe(true);for(const o of group){expect(o.state!.result).toBeNull();expect(JSON.stringify(o.state)).not.toContain(word);if(o!==white)expect(o.secret!.canGuess).toBe(false);}
 send(restored,'guess',word);await until(()=>restored.errors.length>=2);send(white,'guess',word);await until(()=>group.every(o=>o.state!.phase==='RESULTS'));expect(group[0].state!.result).toMatchObject({reason:'white_guess',winnerIds:[white.room.sessionId],answer:word});
 send(group.find(o=>o.room.sessionId===group[0].state!.hostId)!,'prepareRound');await until(()=>group.every(o=>o.state!.phase==='LOBBY'&&o.secret!.word===null));for(const o of [...group].reverse())await o.room.leave();
});
it.each([0,4,'1',null])('rejects unsupported voting time %j',async voteMinutes=>{await expect(new Client(endpoint).create('undercover',{name:'Invalid',voteMinutes})).rejects.toThrow();});
it('rejects bot creation',async()=>{await expect(new Client(endpoint).create('undercover',{name:'Invalid',botCount:1})).rejects.toThrow('ผู้เล่นจริง');});
