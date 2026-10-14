import { Room, Client, ServerError } from '@colyseus/core';
import { randomBytes } from 'node:crypto';
import { Game, GameError } from './game.js';
import type { GameHooks } from './game.js';

export class PokRoom extends Room {
  static codes = new Set<string>();
  game!: Game;
  private rates = new Map<string, { start: number; count: number }>();
  private initialBots = 0;
  private creatorJoined = false;

  onCreate(options: { botCount?: unknown } = {}) {
    const count = options.botCount ?? 0;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 5) {
      throw new ServerError(400, 'เลือกจำนวนบอท 0–5 ตัว');
    }
    this.initialBots = count;
    let code: string;
    do { code = randomBytes(5).toString('hex').toUpperCase(); } while (PokRoom.codes.has(code));
    PokRoom.codes.add(code);
    this.roomId = code;
    this.maxClients = 6;
    this.game = this.makeGame(code, {
      changed: () => this.publish(),
      privateHand: (id, cards) => {
        const client = this.clients.find(c => c.sessionId === id);
        client?.send('hand', { roundId: this.game.roundId, cards });
      },
    });
    this.onMessage('sync', client => {
      if (!this.limit(client)) return;
      // Resend private data through reconnect, never through a room broadcast.
      this.game.reconnect(client.sessionId);
      client.send('snapshot', this.game.snapshot());
    });
    this.onMessage('action', (client, message) => {
      if (!this.limit(client)) return;
      try { this.game.action(client.sessionId, message); }
      catch (error) {
        if (error instanceof GameError) client.send('error', { code: error.code, message: error.message });
        else {
          // Never include payloads/hands/tokens in logs.
          console.error('Game action failed');
          client.send('error', { code: 'INTERNAL', message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
        }
      }
    });
    this.onMessage('*', client => { this.limit(client); });
  }
  protected makeGame(code: string, hooks: GameHooks) { return new Game(code, hooks); }
  private limit(client: Client) {
    const now = Date.now();
    let rate = this.rates.get(client.sessionId);
    if (!rate || now - rate.start >= 1000) {
      rate = { start: now, count: 0 }; this.rates.set(client.sessionId, rate);
    }
    rate.count++;
    if (rate.count <= 20) return true;
    if (rate.count === 21) client.send('error', { code: 'RATE_LIMIT', message: 'ส่งคำสั่งเร็วเกินไป กรุณารอสักครู่' });
    if (rate.count >= 100) client.leave(4028);
    return false;
  }
  onAuth(_client: Client, options: { name?: unknown; game?: unknown }) {
    if (options.game && options.game !== 'pok') throw new ServerError(400, 'ห้องนี้เป็นป๊อกเด้ง');
    if (typeof options?.name !== 'string' || !options.name.trim() || options.name.trim().length > 20) {
      throw new ServerError(400, 'ชื่อยาว 1–20 ตัวอักษร');
    }
    if (!['LOBBY', 'ROUND_END'].includes(this.game.phase)) throw new ServerError(409, 'กรุณารอรอบนี้จบก่อน');
    return true;
  }
  onJoin(client: Client, options: { name: string }) {
    this.game.add(options.name, client.sessionId);
    if (!this.creatorJoined) {
      this.creatorJoined = true;
      for (let n = 0; n < this.initialBots; n++) {
        const botId = this.game.addBot();
        if (n === 0) this.game.action(client.sessionId, {
          type: 'selectDealer', value: botId, roundId: 0, actionId: 'initial-dealer',
        });
      }
    }
    client.send('snapshot', this.game.snapshot());
  }
  private publish() {
    if (!this.game) return;
    this.broadcast('snapshot', this.game.snapshot());
    const active = !['LOBBY', 'ROUND_END'].includes(this.game.phase);
    if (active || this.game.players.size >= this.maxClients) void this.lock();
    else void this.unlock();
  }
  async onDrop(client: Client) {
    this.game.disconnect(client.sessionId);
    try {
      await this.allowReconnection(client, this.game.rules.reconnectSeconds);
    } catch { /* onLeave handles expiration after the reconnection window. */ }
  }
  onReconnect(client: Client) { this.game.reconnect(client.sessionId); }
  onLeave(client: Client) {
    this.rates.delete(client.sessionId);
    this.game.disconnect(client.sessionId);
    this.game.expire(client.sessionId);
  }
  onDispose() {
    this.game.dispose(); this.rates.clear(); PokRoom.codes.delete(this.roomId);
  }
}
