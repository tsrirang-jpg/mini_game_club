import { Room, Client, ServerError } from '@colyseus/core';
import { randomBytes } from 'node:crypto';
import { PokRoom } from './room.js';
import { OldMaidGame } from './oldmaid-game.js';
import type { OldMaidHooks } from './oldmaid-game.js';
import { GameError } from './game.js';

export class OldMaidRoom extends Room {
  game!: OldMaidGame;
  private rates = new Map<string, {at: number; count: number}>();
  private initialBots = 0; private joined = false;
  onCreate(options: {botCount?: unknown} = {}) {
    const count = options.botCount ?? 0;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 7) throw new ServerError(400, 'เลือกจำนวนบอท 0–7 ตัว');
    this.initialBots = count; this.autoDispose = true;
    let code: string; do { code = randomBytes(5).toString('hex').toUpperCase(); } while (PokRoom.codes.has(code));
    PokRoom.codes.add(code); this.roomId = code; this.maxClients = 8 - count;
    this.game = this.makeGame(code, {changed: () => this.publish(), hand: (id,data) => this.clients.find(c => c.sessionId === id)?.send('hand',data)});
    this.onMessage('sync', client => { if (this.limit(client)) this.game.reconnect(client.sessionId); });
    this.onMessage('action', (client,message) => {
      if (!this.limit(client)) return;
      try { this.game.action(client.sessionId,message); }
      catch (error) { client.send('error', {code: error instanceof GameError ? error.code : 'INTERNAL', message: error instanceof GameError ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่'}); }
    });
    this.onMessage('*', client => { this.limit(client); });
  }
  protected makeGame(code: string, hooks: OldMaidHooks) { return new OldMaidGame(code,hooks); }
  private publish() {
    this.maxClients = 8 - [...this.game.players.values()].filter(p => p.isBot).length;
    this.broadcast('snapshot',this.game.snapshot());
    if (this.game.phase === 'PLAYING' || this.game.players.size >= 8) void this.lock(); else void this.unlock();
  }
  private limit(client: Client) {
    let rate = this.rates.get(client.sessionId);
    if (!rate || Date.now() - rate.at >= 1000) { rate = {at:Date.now(), count:0}; this.rates.set(client.sessionId,rate); }
    if (++rate.count <= 20) return true;
    if (rate.count === 21) client.send('error',{code:'RATE_LIMIT',message:'ส่งคำสั่งเร็วเกินไป'});
    if (rate.count >= 100) client.leave(4028); return false;
  }
  onAuth(_client: Client, options: {name?: unknown; game?: unknown}) {
    if (options.game && options.game !== 'oldmaid') throw new ServerError(400,'ห้องนี้เป็น Old Maid');
    if (typeof options.name !== 'string' || !options.name.trim() || options.name.trim().length > 20) throw new ServerError(400,'ชื่อยาว 1–20 ตัวอักษร');
    if (this.game.phase === 'PLAYING') throw new ServerError(409,'รอรอบนี้จบก่อน');
    if (this.game.players.size >= 8) throw new ServerError(409,'ห้องเต็มแล้ว'); return true;
  }
  onJoin(client: Client, options: {name: string}) {
    this.game.add(options.name,client.sessionId);
    if (!this.joined) { this.joined = true; for (let n = 0; n < this.initialBots; n++) this.game.addBot(); }
    client.send('snapshot',this.game.snapshot());
  }
  async onDrop(client: Client) { this.game.disconnect(client.sessionId); try { await this.allowReconnection(client,60); } catch { /* expiry handled in onLeave */ } }
  onReconnect(client: Client) { this.game.reconnect(client.sessionId); }
  onLeave(client: Client) { this.rates.delete(client.sessionId); this.game.disconnect(client.sessionId); this.game.expire(client.sessionId); }
  onDispose() { this.game?.dispose(); this.rates.clear(); PokRoom.codes.delete(this.roomId); }
}
