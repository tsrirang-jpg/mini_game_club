import { ClientRateLimiter, SnapshotPublisher, claimRoomCode, roomCodes } from './runtime/room-resources.js';
import { Room, Client, ServerError } from '@colyseus/core';
import { Game, GameError } from './game.js';
import type { GameHooks } from './game.js';
import { DEFAULT_RULES } from '../../../packages/shared/src/index.js';

export class PokRoom extends Room {
  static codes = roomCodes;
  game!: Game;
  private rates = new ClientRateLimiter('ส่งคำสั่งเร็วเกินไป กรุณารอสักครู่');
  private publication = new SnapshotPublisher(() => this.publishSnapshot());
  private initialBots = 0;
  private creatorJoined = false;

  onCreate(options: { botCount?: unknown } = {}) {
    const count = options.botCount ?? 0;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count >= DEFAULT_RULES.maxPlayers) {
      throw new ServerError(400, `เลือกจำนวนบอท 0–${DEFAULT_RULES.maxPlayers - 1} ตัว`);
    }
    this.initialBots = count;
    const code = claimRoomCode();
    this.roomId = code;
    this.maxClients = DEFAULT_RULES.maxPlayers - count;
    this.game = this.makeGame(code, {
      changed: () => this.publish(),
      privateHand: (id, cards) => {
        const client = this.clients.find(c => c.sessionId === id);
        client?.send('hand', { roundId: this.game.roundId, cards });
      },
    });
    this.onMessage('sync', client => {
      if (!this.limit(client)) return;
      // Sync private data to its owner without broadcasting a fake state change.
      this.game.sync(client.sessionId);
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
  private limit(client: Client) { return this.rates.allow(client); }
  onAuth(_client: Client, options: { name?: unknown; game?: unknown }) {
    if (options.game && options.game !== 'pok') throw new ServerError(400, 'ห้องนี้เป็นป๊อกเด้ง');
    if (typeof options?.name !== 'string' || !options.name.trim() || options.name.trim().length > 20) {
      throw new ServerError(400, 'ชื่อยาว 1–20 ตัวอักษร');
    }
    if (!['LOBBY', 'ROUND_END'].includes(this.game.phase)) throw new ServerError(409, 'กรุณารอรอบนี้จบก่อน');
    if (this.game.players.size >= this.game.rules.maxPlayers) throw new ServerError(409, 'ห้องเต็มแล้ว');
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
  }
  private publish() { this.publication.request(); }
  private publishSnapshot() {
    if (!this.game) return;
    this.broadcast('snapshot', this.game.snapshot());
    const active = !['LOBBY', 'ROUND_END'].includes(this.game.phase);
    // Bots occupy game seats but do not have transport clients. Reopen a human slot after removing a bot.
    this.maxClients = this.game.rules.maxPlayers - [...this.game.players.values()].filter(p => p.isBot).length;
    if (active || this.game.players.size >= this.game.rules.maxPlayers) void this.lock();
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
  onDispose() { this.publication.dispose();
    this.game.dispose(); this.rates.clear(); roomCodes.delete(this.roomId);
  }
}
