import { ClientRateLimiter, SnapshotPublisher, claimRoomCode, roomCodes } from './runtime/room-resources.js';
import { Room, Client, ServerError } from '@colyseus/core';
import { PokerGame } from './poker-game.js';
import { GameError } from './game.js';
import type { GameHooks } from './game.js';
import { POKER_RECONNECT_SECONDS } from '../../../packages/shared/src/poker.js';
export class PokerRoom extends Room {
  game!: PokerGame;
  private botCount = 0; private joined = false;
  protected reconnectSeconds = POKER_RECONNECT_SECONDS;
  private closing = false; private closeScheduled = false;
  private rates = new ClientRateLimiter();
  private publication = new SnapshotPublisher(() => this.publishSnapshot());
  onCreate(options: { botCount?: unknown } = {}) {
    const count = options.botCount ?? 0;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 5) throw new ServerError(400, 'เลือกบอท 0–5 ตัว');
    this.botCount = count; this.maxClients = 6; this.autoDispose = true;
    const code = claimRoomCode(); this.roomId = code;
    this.game = this.makeGame(code, { changed: () => this.publish(), privateHand: (id, cards) => {
      this.clients.find(c => c.sessionId === id)?.send('hand', { roundId: this.game.roundId, cards });
    } });
    this.onMessage('sync', client => { if (this.limit(client)) { this.game.sync(client.sessionId); client.send('snapshot', this.game.snapshot()); } });
    this.onMessage('action', (client, message) => {
      if (!this.limit(client)) return;
      try { this.game.action(client.sessionId, message); }
      catch (error) { client.send('error', { code: error instanceof GameError ? error.code : 'INTERNAL',
        message: error instanceof GameError ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่' }); }
    });
    this.onMessage('*', client => { this.limit(client); });
  }
  protected makeGame(code: string, hooks: GameHooks) { return new PokerGame(code, hooks); }
  private publish() { this.publication.request(); }
  private publishSnapshot() {
    if (this.closing) return;
    this.broadcast('snapshot', this.game.snapshot());
    if (this.game.roomClosing || this.game.players.size >= 6) void this.lock(); else void this.unlock();
    if (this.game.closeAt && !this.closeScheduled) {
      this.closeScheduled = true;
      this.clock.setTimeout(() => {
        this.closing = true;
        this.broadcast('roomClosed', { message: 'Host ปิดห้อง Poker แล้ว' });
        void this.disconnect();
      }, Math.max(0, this.game.closeAt - Date.now()));
    }
  }
  private limit(client: Client) { return this.rates.allow(client); }
  onAuth(_client: Client, options: { name?: unknown; game?: unknown }) {
    if (options.game && options.game !== 'poker') throw new ServerError(400, 'ห้องนี้เป็น Poker');
    if (this.game.roomClosing) throw new ServerError(409, 'ห้องกำลังปิด');
    if (typeof options.name !== 'string' || !options.name.trim() || options.name.trim().length > 20) throw new ServerError(400, 'ชื่อยาว 1–20 ตัวอักษร');
    if (this.game.players.size >= 6) throw new ServerError(409, 'ห้องเต็มแล้ว');
    return true;
  }
  onJoin(client: Client, options: { name: string }) {
    this.game.add(options.name, client.sessionId);
    if (!this.joined) { this.joined = true; for (let n = 0; n < this.botCount; n++) this.game.addBot(); }
  }
  async onDrop(client: Client) {
    if (this.closing) return;
    this.game.disconnect(client.sessionId, this.reconnectSeconds);
    try { await this.allowReconnection(client, this.reconnectSeconds); } catch { /* onLeave expires the player. */ }
  }
  onReconnect(client: Client) { this.game.reconnect(client.sessionId); }
  onLeave(client: Client) { this.rates.delete(client.sessionId); if (!this.closing) this.game.expire(client.sessionId); }
  onDispose() { this.publication.dispose(); this.game?.dispose(); this.rates.clear(); roomCodes.delete(this.roomId); }
}
