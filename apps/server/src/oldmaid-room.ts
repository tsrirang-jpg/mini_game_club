import { CardRoom } from './runtime/card-room.js';
import { OldMaidGame } from './oldmaid-game.js';
import type { OldMaidHooks } from './oldmaid-game.js';

export class OldMaidRoom extends CardRoom<OldMaidGame> {
  protected kind='oldmaid'; protected capacity=8;
  protected makeGame(code:string,hooks:OldMaidHooks){return new OldMaidGame(code,hooks);}
}
