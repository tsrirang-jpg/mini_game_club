import { Room, Client, ServerError } from '@colyseus/core';
import { GameError } from '../game.js';
import { ClientRateLimiter, SnapshotPublisher, claimRoomCode, roomCodes } from './room-resources.js';

interface CardGame {
  phase: string; players: Map<string,{isBot:boolean}>;
  add(name: string,id: string): unknown; addBot(): unknown;
  sync(id:string):void; action(id:string,message:unknown):void; snapshot():unknown;
  disconnect(id:string):void; reconnect(id:string):void; expire(id:string):void; dispose():void;
}
export interface CardRoomHooks { changed():void; hand(id:string,data:unknown):void }
// One transport owns rate limits, snapshot batching, reconnection and cleanup.
export abstract class CardRoom<G extends CardGame> extends Room {
  game!: G;
  protected abstract kind: string;
  protected abstract capacity: number;
  protected abstract makeGame(code:string,hooks:CardRoomHooks):G;
  protected configure(_options: Record<string,unknown>) {}
  private rates=new ClientRateLimiter();
  private publication=new SnapshotPublisher(()=>this.publishSnapshot());
  private initialBots=0; private joined=false;
  onCreate(options:Record<string,unknown>={}) {
    const count=options.botCount??0;
    if(typeof count!=='number'||!Number.isInteger(count)||count<0||count>=this.capacity)throw new ServerError(400,`เลือกจำนวนบอท 0–${this.capacity-1} ตัว`);
    this.configure(options);this.initialBots=count;this.autoDispose=true;
    const code=claimRoomCode();this.roomId=code;this.maxClients=this.capacity-count;
    this.game=this.makeGame(code,{changed:()=>this.publication.request(),hand:(id,data)=>this.clients.find(c=>c.sessionId===id)?.send('hand',data)});
    this.onMessage('sync',client=>{if(this.rates.allow(client)){this.game.sync(client.sessionId);client.send('snapshot',this.game.snapshot());}});
    this.onMessage('action',(client,message)=>{
      if(!this.rates.allow(client))return;
      try{this.game.action(client.sessionId,message);}catch(error){client.send('error',{code:error instanceof GameError?error.code:'INTERNAL',message:error instanceof GameError?error.message:'เกิดข้อผิดพลาด กรุณาลองใหม่'});}
    });
    this.onMessage('*',client=>{this.rates.allow(client);});
  }
  private publishSnapshot() {
    this.maxClients=this.capacity-[...this.game.players.values()].filter(p=>p.isBot).length;
    this.broadcast('snapshot',this.game.snapshot());
    if(!['LOBBY','RESULTS'].includes(this.game.phase)||this.game.players.size>=this.capacity)void this.lock();else void this.unlock();
  }
  onAuth(_client:Client,options:{name?:unknown;game?:unknown}) {
    if(options.game&&options.game!==this.kind)throw new ServerError(400,`ห้องนี้เป็น ${this.kind}`);
    if(typeof options.name!=='string'||!options.name.trim()||options.name.trim().length>20)throw new ServerError(400,'ชื่อยาว 1–20 ตัวอักษร');
    if(!['LOBBY','RESULTS'].includes(this.game.phase))throw new ServerError(409,'รอรอบนี้จบก่อน');
    if(this.game.players.size>=this.capacity)throw new ServerError(409,'ห้องเต็มแล้ว');return true;
  }
  onJoin(client:Client,options:{name:string}) {this.game.add(options.name,client.sessionId);if(!this.joined){this.joined=true;for(let n=0;n<this.initialBots;n++)this.game.addBot();}}
  async onDrop(client:Client){this.game.disconnect(client.sessionId);try{await this.allowReconnection(client,60);}catch{/* onLeave handles expiry */}}
  onReconnect(client:Client){this.game.reconnect(client.sessionId);}
  onLeave(client:Client){this.rates.delete(client.sessionId);this.game.disconnect(client.sessionId);this.game.expire(client.sessionId);}
  onDispose(){this.publication.dispose();this.game?.dispose();this.rates.clear();roomCodes.delete(this.roomId);}
}
