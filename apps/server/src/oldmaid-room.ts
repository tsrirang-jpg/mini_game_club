import { ClientRateLimiter, SnapshotPublisher, claimRoomCode, roomCodes } from './runtime/room-resources.js';
import { Room, Client, ServerError } from '@colyseus/core';
import { OldMaidGame } from './oldmaid-game.js';
import type { OldMaidHooks } from './oldmaid-game.js';
import { GameError } from './game.js';

export class OldMaidRoom extends Room {
  game!: OldMaidGame;
  private rates = new ClientRateLimiter();
  private publication = new SnapshotPublisher(() => this.publishSnapshot());
  private initialBots = 0; private joined = false;
  onCreate(options: {botCount?: unknown} = {}) {
    const count = options.botCount ?? 0;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 7) throw new ServerError(400, 'เลือกจำนวนบอท 0–7 ตัว');
    this.initialBots = count; this.autoDispose = true;
    const code = claimRoomCode(); this.roomId = code; this.maxClients = 8 - count;
    this.game = this.makeGame(code, {changed: () => this.publish(), hand: (id,data) => this.clients.find(c => c.sessionId === id)?.send('hand',data)});
    this.onMessage('sync', client => { if (this.limit(client)) { this.game.sync(client.sessionId); client.send('snapshot', this.game.snapshot()); } });
    this.onMessage('action', (client,message) => {
      if (!this.limit(client)) return;
      try { this.game.action(client.sessionId,message); }
      catch (error) { client.send('error', {code: error instanceof GameError ? error.code : 'INTERNAL', message: error instanceof GameError ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่'}); }
    });
    this.onMessage('*', client => { this.limit(client); });
  }
  protected makeGame(code: string, hooks: OldMaidHooks) { return new OldMaidGame(code,hooks); }
  private publish() { this.publication.request(); }
  private publishSnapshot() {
    this.maxClients = 8 - [...this.game.players.values()].filter(p => p.isBot).length;
    this.broadcast('snapshot',this.game.snapshot());
    if (this.game.phase === 'PLAYING' || this.game.players.size >= 8) void this.lock(); else void this.unlock();
  }
  private limit(client: Client) { return this.rates.allow(client); }
  onAuth(_client: Client, options: {name?: unknown; game?: unknown}) {
    if (options.game && options.game !== 'oldmaid') throw new ServerError(400,'ห้องนี้เป็น Old Maid');
    if (typeof options.name !== 'string' || !options.name.trim() || options.name.trim().length > 20) throw new ServerError(400,'ชื่อยาว 1–20 ตัวอักษร');
    if (this.game.phase === 'PLAYING') throw new ServerError(409,'รอรอบนี้จบก่อน');
    if (this.game.players.size >= 8) throw new ServerError(409,'ห้องเต็มแล้ว'); return true;
  }
  onJoin(client: Client, options: {name: string}) {
    this.game.add(options.name,client.sessionId);
    if (!this.joined) { this.joined = true; for (let n = 0; n < this.initialBots; n++) this.game.addBot(); }
  }
  async onDrop(client: Client) { this.game.disconnect(client.sessionId); try { await this.allowReconnection(client,60); } catch { /* expiry handled in onLeave */ } }
  onReconnect(client: Client) { this.game.reconnect(client.sessionId); }
  onLeave(client: Client) { this.rates.delete(client.sessionId); this.game.disconnect(client.sessionId); this.game.expire(client.sessionId); }
  onDispose() { this.publication.dispose(); this.game?.dispose(); this.rates.clear(); roomCodes.delete(this.roomId); }
}
