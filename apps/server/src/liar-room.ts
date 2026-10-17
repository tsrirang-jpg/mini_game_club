import { ServerError } from '@colyseus/core';
import { LIAR_TURN_SECONDS } from '../../../packages/shared/src/liar.js';
import { CardRoom } from './runtime/card-room.js';
import { LiarGame } from './liar-game.js';
import type { LiarHooks } from './liar-game.js';

export class LiarRoom extends CardRoom<LiarGame> {
  protected kind='liar'; protected capacity=6;
  private turnMs=30_000;
  protected configure(options:Record<string,unknown>) {
    const seconds=options.turnSeconds??30;
    if(typeof seconds!=='number'||!LIAR_TURN_SECONDS.some(n=>n===seconds))throw new ServerError(400,'เลือกเวลาต่อเทิร์น 15, 30 หรือ 60 วินาที');
    this.turnMs=seconds*1000;
  }
  protected makeGame(code:string,hooks:LiarHooks){return new LiarGame(code,hooks,undefined,this.turnMs);}
}
