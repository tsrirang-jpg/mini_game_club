import { Room, Client, ServerError } from '@colyseus/core';
import { randomBytes } from 'node:crypto';
import { PokRoom } from './room.js';
import { PokerGame } from './poker-game.js';
import { GameError } from './game.js';
import type { GameHooks } from './game.js';
import { POKER_RECONNECT_SECONDS } from '../../../packages/shared/src/poker.js';
export class PokerRoom extends Room {
  game!: PokerGame;
  private botCount = 0; private joined = false;
  protected reconnectSeconds = POKER_RECONNECT_SECONDS;
  private closing = false; private closeScheduled = false;
  private rates = new Map<string, { at: number; count: number }>();
  onCreate(options: { botCount?: unknown } = {}) {
    const count = options.botCount ?? 0;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 5) throw new ServerError(400, 'เลือกบอท 0–5 ตัว');
    this.botCount = count; this.maxClients = 6; this.autoDispose = true;
    let code: string; do { code = randomBytes(5).toString('hex').toUpperCase(); } while (PokRoom.codes.has(code));
    PokRoom.codes.add(code); this.roomId = code;
    this.game = this.makeGame(code, { changed: () => this.publish(), privateHand: (id, cards) => {
      this.clients.find(c => c.sessionId === id)?.send('hand', { roundId: this.game.roundId, cards });
    } });
    this.onMessage('sync', client => { if (this.limit(client)) this.game.reconnect(client.sessionId); });
    this.onMessage('action', (client, message) => {
      if (!this.limit(client)) return;
      try { this.game.action(client.sessionId, message); }
      catch (error) { client.send('error', { code: error instanceof GameError ? error.code : 'INTERNAL',
        message: error instanceof GameError ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่' }); }
    });
    this.onMessage('*', client => { this.limit(client); });
  }
  protected makeGame(code: string, hooks: GameHooks) { return new PokerGame(code, hooks); }
  private publish() {
    if (this.closing) return;
    this.broadcast('snapshot', this.game.snapshot());
    if (this.game.roomClosing || !['LOBBY', 'ROUND_END'].includes(this.game.phase) || this.game.players.size >= 6) void this.lock(); else void this.unlock();
    if (this.game.closeAt && !this.closeScheduled) {
      this.closeScheduled = true;
      this.clock.setTimeout(() => {
        this.closing = true;
        this.broadcast('roomClosed', { message: 'Host ปิดห้อง Poker แล้ว' });
        void this.disconnect();
      }, Math.max(0, this.game.closeAt - Date.now()));
    }
  }
  private limit(client: Client) {
    let rate = this.rates.get(client.sessionId);
    if (!rate || Date.now() - rate.at >= 1000) { rate = { at: Date.now(), count: 0 }; this.rates.set(client.sessionId, rate); }
    if (++rate.count <= 20) return true;
    if (rate.count === 21) client.send('error', { code: 'RATE_LIMIT', message: 'ส่งคำสั่งเร็วเกินไป' });
    if (rate.count >= 100) client.leave(4028); return false;
  }
  onAuth(_client: Client, options: { name?: unknown; game?: unknown }) {
    if (options.game && options.game !== 'poker') throw new ServerError(400, 'ห้องนี้เป็น Poker');
    if (this.game.roomClosing) throw new ServerError(409, 'ห้องกำลังปิด');
    if (typeof options.name !== 'string' || !options.name.trim() || options.name.trim().length > 20) throw new ServerError(400, 'ชื่อยาว 1–20 ตัวอักษร');
    if (!['LOBBY', 'ROUND_END'].includes(this.game.phase)) throw new ServerError(409, 'รอรอบนี้จบก่อน');
    return true;
  }
  onJoin(client: Client, options: { name: string }) {
    this.game.add(options.name, client.sessionId);
    if (!this.joined) { this.joined = true; for (let n = 0; n < this.botCount; n++) this.game.addBot(); }
    client.send('snapshot', this.game.snapshot());
  }
  async onDrop(client: Client) {
    if (this.closing) return;
    this.game.disconnect(client.sessionId, this.reconnectSeconds);
    try { await this.allowReconnection(client, this.reconnectSeconds); } catch { /* onLeave expires the player. */ }
  }
  onReconnect(client: Client) { this.game.reconnect(client.sessionId); }
  onLeave(client: Client) { this.rates.delete(client.sessionId); if (!this.closing) this.game.expire(client.sessionId); }
  onDispose() { this.game?.dispose(); this.rates.clear(); PokRoom.codes.delete(this.roomId); }
}
