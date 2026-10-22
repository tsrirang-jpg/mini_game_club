import { Room, Client, ServerError } from '@colyseus/core';
import { ClientRateLimiter, SnapshotPublisher, claimRoomCode, roomCodes } from './runtime/room-resources.js';
import { WhoAmIGame, validateWhoSettings } from './whoami-game.js';
import type { WhoHooks } from './whoami-game.js';
import { WHO_DEFAULT_SETTINGS } from '../../../packages/shared/src/whoami.js';
import { GameError } from './game.js';

export class WhoAmIRoom extends Room {
  game!: WhoAmIGame;
  private rates=new ClientRateLimiter();
  private publication=new SnapshotPublisher(()=>this.publishSnapshot());
  onCreate(options:Record<string,unknown>={}) {
    let settings;
    try {
      settings=validateWhoSettings(Object.fromEntries(Object.entries(WHO_DEFAULT_SETTINGS).map(([key,value])=>[key,options[key]??value])));
      if(options.botCount!==undefined&&options.botCount!==0)throw new GameError('INVALID_ACTION','Who am I เล่นกับผู้เล่นจริง 3–8 คน');
    } catch(error){throw new ServerError(400,error instanceof Error?error.message:'การตั้งค่าไม่ถูกต้อง');}
    const code=claimRoomCode();this.roomId=code;this.maxClients=8;
    this.game=this.makeGame(code,{changed:()=>this.publication.request(),identities:(id,data)=>this.clients.find(c=>c.sessionId===id)?.send('identities',data)});
    this.game.settings=settings;
    this.onMessage('sync',client=>{if(this.rates.allow(client)){this.game.sync(client.sessionId);client.send('snapshot',this.game.snapshot());}});
    this.onMessage('action',(client,message)=>{
      if(!this.rates.allow(client))return;
      try{this.game.action(client.sessionId,message);}catch(error){client.send('error',{code:error instanceof GameError?error.code:'INTERNAL',message:error instanceof GameError?error.message:'เกิดข้อผิดพลาด กรุณาลองใหม่'});}
    });
    this.onMessage('*',client=>{this.rates.allow(client);});
  }
  protected makeGame(code:string,hooks:WhoHooks){return new WhoAmIGame(code,hooks);}
  private publishSnapshot(){
    this.broadcast('snapshot',this.game.snapshot());
    if(this.game.players.size>=8)void this.lock();else void this.unlock();
  }
  onAuth(_client:Client,options:{name?:unknown;game?:unknown}) {
    if(options.game&&options.game!=='whoami')throw new ServerError(400,'ห้องนี้เป็น Who am I');
    if(typeof options.name!=='string'||!options.name.trim()||options.name.trim().length>20)throw new ServerError(400,'ชื่อยาว 1–20 ตัวอักษร');
    if(this.game.players.size>=8)throw new ServerError(409,'ห้องเต็มแล้ว');return true;
  }
  onJoin(client:Client,options:{name:string}){this.game.add(options.name,client.sessionId);}
  async onDrop(client:Client){this.game.disconnect(client.sessionId);try{await this.allowReconnection(client,60);}catch{/* expiry in onLeave */}}
  onReconnect(client:Client){this.game.reconnect(client.sessionId);}
  onLeave(client:Client){this.rates.delete(client.sessionId);this.game.disconnect(client.sessionId);this.game.expire(client.sessionId);}
  onDispose(){this.publication.dispose();this.game?.dispose();this.rates.clear();roomCodes.delete(this.roomId);}
}
