import { ClientRateLimiter, SnapshotPublisher, claimRoomCode, roomCodes } from './runtime/room-resources.js';
import { Room, Client, ServerError } from '@colyseus/core';
import { SpyfallGame } from './spyfall-game.js';
import type { SpyHooks } from './spyfall-game.js';
import { GameError } from './game.js';
import { SPY_DEFAULT_SETTINGS, SPY_QUESTION_MINUTES, SPY_TURN_MINUTES, SPY_PLAYER_COUNTS } from '../../../packages/shared/src/spyfall.js';
export class SpyfallRoom extends Room {
  game!: SpyfallGame; private rates = new ClientRateLimiter();
  private publication = new SnapshotPublisher(() => this.publishSnapshot());
  onCreate(options: { questionMinutes?: unknown; votingMinutes?: unknown; guessMinutes?: unknown; playerCount?: unknown; botCount?: unknown } = {}) {
    const settings = { questionMinutes: options.questionMinutes ?? SPY_DEFAULT_SETTINGS.questionMinutes,
      votingMinutes: options.votingMinutes ?? SPY_DEFAULT_SETTINGS.votingMinutes,
      guessMinutes: options.guessMinutes ?? SPY_DEFAULT_SETTINGS.guessMinutes,
      playerCount: options.playerCount ?? SPY_DEFAULT_SETTINGS.playerCount };
    if (typeof settings.questionMinutes !== 'number' || !SPY_QUESTION_MINUTES.some(value => value === settings.questionMinutes)) throw new ServerError(400, 'เลือกเวลาถาม 5, 7 หรือ 10 นาที');
    for (const key of ['votingMinutes', 'guessMinutes'] as const) {
      if (typeof settings[key] !== 'number' || !SPY_TURN_MINUTES.some(value => value === settings[key])) throw new ServerError(400, 'เลือกเวลาโหวตและสายลับตอบ 1, 2 หรือ 3 นาที');
    }
    if (typeof settings.playerCount !== 'number' || !SPY_PLAYER_COUNTS.some(value => value === settings.playerCount)) throw new ServerError(400, 'เลือกจำนวนผู้เล่นสูงสุด 3–8 คน');
    if (options.botCount && options.botCount !== 0) throw new ServerError(400, 'Spyfall เวอร์ชันนี้เล่นกับผู้เล่นจริง');
    const code = claimRoomCode(); this.roomId = code; this.maxClients = settings.playerCount as number;
    this.game = this.makeGame(code, { changed: () => this.publish(), secret: (id, data) => {
      this.clients.find(c => c.sessionId === id)?.send('secret', data);
    } });
    this.game.questionMinutes = settings.questionMinutes as number;
    this.game.votingMinutes = settings.votingMinutes as number;
    this.game.guessMinutes = settings.guessMinutes as number;
    this.game.playerCount = settings.playerCount as number;
    this.onMessage('sync', client => { if (this.limit(client)) { this.game.sync(client.sessionId); client.send('snapshot', this.game.snapshot()); } });
    this.onMessage('action', (client, message) => {
      if (!this.limit(client)) return;
      try { this.game.action(client.sessionId, message); }
      catch (error) { client.send('error', { code: error instanceof GameError ? error.code : 'INTERNAL',
        message: error instanceof GameError ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่' }); }
    });
    this.onMessage('*', client => { this.limit(client); });
  }
  protected makeGame(code: string, hooks: SpyHooks) { return new SpyfallGame(code, hooks); }
  private publish() { this.publication.request(); }
  private publishSnapshot() {
    this.maxClients = this.game.playerCount;
    this.broadcast('snapshot', this.game.snapshot());
    if (!['LOBBY','RESULTS'].includes(this.game.phase) || this.game.players.size >= this.game.playerCount) void this.lock(); else void this.unlock();
  }
  private limit(client: Client) { return this.rates.allow(client); }
  onAuth(_client: Client, options: { name?: unknown; game?: unknown }) {
    if (options.game && options.game !== 'spyfall') throw new ServerError(400, 'ห้องนี้เป็น Spyfall');
    if (typeof options.name !== 'string' || !options.name.trim() || options.name.trim().length > 20) throw new ServerError(400, 'ชื่อยาว 1–20 ตัวอักษร');
    if (!['LOBBY','RESULTS'].includes(this.game.phase)) throw new ServerError(409, 'รอรอบนี้จบก่อน');
    if (this.game.players.size >= this.game.playerCount) throw new ServerError(409, 'ห้องเต็มแล้ว');
    return true;
  }
  onJoin(client: Client, options: { name: string }) { this.game.add(options.name, client.sessionId); }
  async onDrop(client: Client) { this.game.disconnect(client.sessionId); try { await this.allowReconnection(client, 60); } catch { /* expiry in onLeave */ } }
  onReconnect(client: Client) { this.game.reconnect(client.sessionId); }
  onLeave(client: Client) { this.rates.delete(client.sessionId); this.game.disconnect(client.sessionId); this.game.expire(client.sessionId); }
  onDispose() { this.publication.dispose(); this.game?.dispose(); this.rates.clear(); roomCodes.delete(this.roomId); }
}
