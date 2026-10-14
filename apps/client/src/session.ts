import { Client, Room } from '@colyseus/sdk';
import { navigate } from './router';
import type { ActionType, Card, Snapshot } from '../../../packages/shared/src/index';
import type { PokerSnapshot, PokerAction } from '../../../packages/shared/src/poker';
import type { SpySnapshot, SpyAction, SpySecret } from '../../../packages/shared/src/spyfall';

type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting';
export interface SessionState<S = Snapshot> {
  status: Status; snapshot: S | null; hand: Card[]; handRound: number;
  playerId: string; error: string;
  secret: SpySecret | null;
}
const endpoint = import.meta.env.VITE_GAME_URL?.trim()
  || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${import.meta.env.DEV ? '/game' : ''}`;
const client = new Client(endpoint);
// sessionStorage isolates different tabs while keeping refresh reconnection.
export class GameSession<S extends { code: string; roundId: number } = Snapshot, A extends string = ActionType> {
  state: SessionState<S> = { status: 'idle', snapshot: null, hand: [], handRound: -1, playerId: '', error: '', secret: null };
  constructor(private roomName = 'pok', private playPath = '/play', private entryPath = '/rooms/create') {}
  private get key() { return `${this.roomName}.session.v1`; }
  private room?: Room;
  private listeners = new Set<() => void>();
  private generation = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private snapshotRound = -1;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(value: Partial<SessionState<S>>) {
    this.state = { ...this.state, ...value }; for (const listener of this.listeners) listener();
  }
  clearError() { this.update({ error: '' }); }
  private bind(room: Room, generation: number) {
    this.room = room;
    room.reconnection.minUptime = 0;
    room.reconnection.maxRetries = 30;
    room.reconnection.maxEnqueuedMessages = 0;
    sessionStorage.setItem(this.key, room.reconnectionToken);
    this.update({ playerId: room.sessionId, status: 'connected', error: '' });
    navigate(`${this.playPath}/${room.roomId}`, location.pathname.startsWith(this.playPath + '/'));
    room.onMessage('snapshot', (snapshot: S) => {
      if (generation !== this.generation) return;
      this.snapshotRound = snapshot.roundId;
      this.update({ snapshot,
        ...(this.state.handRound === snapshot.roundId ? {} : { hand: [] }) });
    });
    room.onMessage('hand', (message: { roundId: number; cards: Card[] }) => {
      if (generation === this.generation && message.roundId >= this.snapshotRound) {
        this.update({ hand: message.cards, handRound: message.roundId });
      }
    });
    room.onMessage('secret', (message: SpySecret) => {
      if (generation === this.generation && message.roundId >= this.snapshotRound) this.update({ secret: message });
    });
    room.onMessage('error', (error: { message: string }) => {
      if (generation === this.generation) this.update({ error: error.message });
    });
    room.onError(() => {
      if (generation === this.generation) this.update({ error: 'การเชื่อมต่อมีข้อผิดพลาด' });
    });
    room.onDrop(() => {
      if (generation === this.generation) this.update({ status: 'reconnecting' });
    });
    room.onReconnect(() => {
      if (generation !== this.generation) return;
      sessionStorage.setItem(this.key, room.reconnectionToken);
      this.update({ status: 'connected', error: '' }); room.send('sync');
    });
    room.onLeave(code => {
      if (generation !== this.generation) return;
      this.room = undefined;
      sessionStorage.removeItem(this.key);
      this.update({ status: 'idle', snapshot: null, hand: [], secret: null,
        error: code === 4028 ? 'ส่งคำสั่งมากเกินไป กรุณาเข้าห้องใหม่' : code === 4000 || code === 1000 ? '' : 'การเชื่อมต่อสิ้นสุด กรุณาเข้าห้องอีกครั้ง' });
      navigate(this.entryPath, true);
    });
    room.send('sync');
  }
  async connect(name: string, code?: string, botCount = 0, options: Record<string, unknown> = {}) {
    const generation = ++this.generation;
    this.snapshotRound = -1;
    this.update({ status: 'connecting', error: '', hand: [], snapshot: null, secret: null });
    try {
      const room = code ? await client.joinById(code.trim().toUpperCase(), { name: name.trim(), game: this.roomName })
        : await client.create(this.roomName, { ...options, name: name.trim(), botCount, game: this.roomName });
      if (generation !== this.generation) { await room.leave(); return; }
      this.bind(room, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.update({ status: 'idle', error: error instanceof Error ? error.message : 'เข้าห้องไม่ได้ ตรวจสอบรหัสห้องและ server' });
    }
  }
  async restore() {
    const token = sessionStorage.getItem(this.key); if (!token) return;
    const generation = ++this.generation;
    this.update({ status: 'reconnecting', error: '' });
    const until = Date.now() + 60_000;
    const attempt = async () => {
      if (generation !== this.generation) return;
      try {
        const room = await client.reconnect(token);
        if (generation !== this.generation) { await room.leave(); return; }
        this.bind(room, generation);
      } catch {
        if (generation !== this.generation) return;
        if (Date.now() >= until) {
          sessionStorage.removeItem(this.key);
          this.update({ status: 'idle', snapshot: null, hand: [], secret: null, error: 'หมดเวลาเชื่อมต่อใหม่ กรุณาเข้าห้องอีกครั้ง' });
        } else this.retryTimer = setTimeout(() => { void attempt(); }, 1500);
      }
    };
    await attempt();
  }
  send(type: A, value?: boolean | number | string) {
    if (!this.room || this.state.status !== 'connected' || !this.state.snapshot) return;
    this.room.send('action', { type, value, roundId: this.state.snapshot.roundId,
      actionId: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('') });
  }
  leave() {
    ++this.generation;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    sessionStorage.removeItem(this.key);
    void this.room?.leave(); this.room = undefined; this.snapshotRound = -1;
    this.update({ status: 'idle', snapshot: null, hand: [], handRound: -1, playerId: '', error: '', secret: null });
    navigate(this.entryPath);
  }
}
export const session = new GameSession();
export const pokerSession = new GameSession<PokerSnapshot, PokerAction>('poker', '/poker/play', '/poker/rooms/create');
export const spySession = new GameSession<SpySnapshot, SpyAction>('spyfall', '/spyfall/play', '/spyfall/rooms/create');
