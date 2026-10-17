import {ServerError} from '@colyseus/core';
import {CardRoom} from './runtime/card-room.js';
import type {CardRoomHooks} from './runtime/card-room.js';
import {UndercoverGame,validateUnderSettings} from './undercover-game.js';
import {UNDER_DEFAULT_SETTINGS} from '../../../packages/shared/src/undercover.js';
export class UndercoverRoom extends CardRoom<UndercoverGame>{
 protected kind='undercover';protected capacity=8;private settings={...UNDER_DEFAULT_SETTINGS};
 protected configure(options:Record<string,unknown>){
  try{if(options.botCount!==undefined&&options.botCount!==0)throw new Error('Undercover เล่นกับผู้เล่นจริง 3–8 คน');this.settings=validateUnderSettings({...UNDER_DEFAULT_SETTINGS,...Object.fromEntries(Object.keys(UNDER_DEFAULT_SETTINGS).filter(k=>options[k]!==undefined).map(k=>[k,options[k]]))});}
  catch(error){throw new ServerError(400,error instanceof Error?error.message:'การตั้งค่าไม่ถูกต้อง');}
 }
 protected makeGame(code:string,hooks:CardRoomHooks){const game=new UndercoverGame(code,{changed:hooks.changed,secret:(id,data)=>this.clients.find(c=>c.sessionId===id)?.send('undercover',data)});game.settings={...this.settings};return game;}
}
