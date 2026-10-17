import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client, Room } from '@colyseus/sdk';
import { PokRoom } from '../apps/server/src/room';
import { PokerRoom } from '../apps/server/src/poker-room';
import { SpyfallRoom } from '../apps/server/src/spyfall-room';
import { OldMaidRoom } from '../apps/server/src/oldmaid-room';
let server:Server,endpoint:string;
const rooms:Room[]=[];
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn:()=>boolean){const end=Date.now()+3000;while(!fn()){if(Date.now()>end)throw new Error('Sync test timeout');await sleep(10);}}
beforeAll(async()=>{const http=createServer();server=new Server({gracefullyShutdown:false,transport:new WebSocketTransport({server:http,maxPayload:4096})});server.define('pok',PokRoom);server.define('poker',PokerRoom);server.define('spyfall',SpyfallRoom);server.define('oldmaid',OldMaidRoom);await server.listen(0,'127.0.0.1');const address=http.address();if(!address||typeof address==='string')throw new Error('No port');endpoint=`ws://127.0.0.1:${address.port}`;});
afterAll(async()=>{await Promise.all(rooms.map(room=>room.leave().catch(()=>{})));await server.gracefullyShutdown(false);});
for(const game of ['pok','poker','spyfall','oldmaid'])it(`${game}: sync sends exactly one snapshot to its requester without waking peers`,async()=>{
 const client=new Client(endpoint),a=await client.create(game,{name:'Host',botCount:0});rooms.push(a);a.reconnection.enabled=false;
 let peer=0,own=0,privateMessages=0;a.onMessage('snapshot',()=>peer++);a.onMessage('hand',()=>{});a.onMessage('secret',()=>{});
 const b=await client.joinById(a.roomId,{name:'Guest',game});rooms.push(b);b.reconnection.enabled=false;b.onMessage('snapshot',()=>own++);b.onMessage(game==='spyfall'?'secret':'hand',()=>privateMessages++);
 b.send('sync');await until(()=>own>0&&privateMessages>0);await sleep(30);const beforePeer=peer,beforeOwn=own,beforePrivate=privateMessages;
 b.send('sync');await until(()=>own>beforeOwn);await sleep(30);
 expect(peer).toBe(beforePeer);expect(own-beforeOwn).toBe(1);expect(privateMessages-beforePrivate).toBe(1);
});
