import type { Client, Room } from '@colyseus/sdk';
import { navigate } from './router';
import { RoomRecovery } from './connection/room-recovery';
import type { ActionType, Card, Snapshot } from '../../../packages/shared/src/index';
import type { PokerSnapshot, PokerAction } from '../../../packages/shared/src/poker';
import { POKER_RECONNECT_SECONDS } from '../../../packages/shared/src/poker';
import type { SpySnapshot, SpyAction, SpySecret } from '../../../packages/shared/src/spyfall';
import type { OldMaidSnapshot, OldMaidAction, OldMaidPrivateState } from '../../../packages/shared/src/oldmaid';

import type { WhoSnapshot, WhoAction, WhoPrivate, WhoSettings } from '../../../packages/shared/src/whoami';
import type { LiarSnapshot, LiarAction } from '../../../packages/shared/src/liar';
import type { UnderSnapshot, UnderAction, UnderSecret, UnderSettings, UnderVote } from '../../../packages/shared/src/undercover';

type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting';
export interface SessionState<S = Snapshot> {
  status: Status; snapshot: S | null; hand: Card[]; handRound: number;
  playerId: string; error: string;
  secret: SpySecret | null;
  oldMaid?: OldMaidPrivateState | null;
  whoAmI?: WhoPrivate | null;
  undercover?: UnderSecret | null;
}
const endpoint = import.meta.env.VITE_GAME_URL?.trim()
  || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${import.meta.env.DEV ? '/game' : ''}`;
let clientPromise: Promise<Client> | undefined;
function getClient() {
  return clientPromise ??= import('@colyseus/sdk').then(({ Client }) => new Client(endpoint)).catch(error => {
    clientPromise = undefined; throw error;
  });
}
function closeRoom(room: Room) {
  room.reconnection.enabled = false;
  void room.leave();
  room.connection.close(1000);
}
// sessionStorage isolates different tabs while keeping refresh reconnection.
export class GameSession<S extends { code: string; roundId: number } = Snapshot, A extends string = ActionType> {
  state: SessionState<S> = { status: 'idle', snapshot: null, hand: [], handRound: -1, playerId: '', error: '', secret: null };
  constructor(private roomName = 'pok', private playPath = '/play', private entryPath = '/rooms/create') {}
  private get key() { return `${this.roomName}.session.v1`; }
  private room?: Room;
  private listeners = new Set<() => void>();
  private generation = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private snapshotRound = -1;
  private recovery?: RoomRecovery;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(value: Partial<SessionState<S>>) {
    this.state = { ...this.state, ...value }; for (const listener of this.listeners) listener();
  }
  clearError() { this.update({ error: '' }); }
  private clearTimers() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.retryTimer = undefined; this.reconnectTimer = undefined;
  }
  private bind(room: Room, generation: number) {
    this.clearTimers();
    this.recovery?.dispose();
    this.room = room;
    room.reconnection.minUptime = 0;
    room.reconnection.maxRetries = 60;
    room.reconnection.maxEnqueuedMessages = 0;
    const recovery = this.recovery = new RoomRecovery(room, {
      isCurrent: () => generation === this.generation && this.room === room,
      resuming: () => this.update({ status: 'reconnecting' }),
      ready: () => this.update({ status: 'connected', error: '' }),
    });
    sessionStorage.setItem(this.key, room.reconnectionToken);
    this.update({ playerId: room.sessionId, status: 'connected', error: '' });
    navigate(`${this.playPath}/${room.roomId}`, location.pathname.startsWith(this.playPath + '/'));
    room.onMessage('snapshot', (snapshot: S) => {
      if (generation !== this.generation) return;
      this.snapshotRound = snapshot.roundId;
      this.update({ snapshot,
        ...(this.state.handRound === snapshot.roundId ? {} : { hand: [] }) });
      recovery.receivedSnapshot();
    });
    room.onMessage('hand', (message: { roundId: number; cards: Card[]; oldMaid?: OldMaidPrivateState }) => {
      if (generation === this.generation && message.roundId >= this.snapshotRound) {
        this.update({ hand: message.cards, handRound: message.roundId,
          ...(this.roomName === 'oldmaid' ? {oldMaid:message.oldMaid ?? null} : {}) });
      }
    });
    room.onMessage('secret', (message: SpySecret) => {
      if (generation === this.generation && message.roundId >= this.snapshotRound) this.update({ secret: message });
    });
    room.onMessage('identities', (message: WhoPrivate) => {
      if (generation === this.generation && message.roundId >= this.snapshotRound) this.update({ whoAmI: message });
    });
    room.onMessage('undercover', (message: UnderSecret) => {
      if (generation === this.generation && message.roundId >= this.snapshotRound) this.update({ undercover: message });
    });
    room.onMessage('error', (error: { message: string }) => {
      if (generation === this.generation) this.update({ error: error.message });
    });
    let closedMessage = '';
    room.onMessage('roomClosed', (message: { message: string }) => {
      if (generation !== this.generation) return;
      closedMessage = message.message;
      room.reconnection.enabled = false;
      sessionStorage.removeItem(this.key);
      // Proxies may delay forwarding the server's close frame. The authoritative
      // closure message is enough to return to entry and close our socket normally.
      this.leave(); this.update({ error: closedMessage });
    });
    room.onError(() => {
      if (generation === this.generation) this.update({ error: 'การเชื่อมต่อมีข้อผิดพลาด' });
    });
    room.onDrop(() => {
      if (generation !== this.generation) return;
      recovery.dropped();
      this.update({ status: 'reconnecting' });
      if (!this.reconnectTimer) this.reconnectTimer = setTimeout(() => {
        if (generation !== this.generation) return;
        this.leave(); this.update({ error: 'หมดเวลาเชื่อมต่อใหม่ กรุณาเข้าห้องอีกครั้ง' });
      }, POKER_RECONNECT_SECONDS * 1000);
    });
    room.onReconnect(() => {
      if (generation !== this.generation) { closeRoom(room); return; }
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      // SDK 0.18 emits onReconnect before assigning the rotated token. Persist
      // after that handshake frame so a subsequent refresh uses the current token.
      queueMicrotask(() => {
        if (generation !== this.generation || this.room !== room) return;
        sessionStorage.setItem(this.key, room.reconnectionToken);
        recovery.reconnected();
      });
    });
    room.onLeave(code => {
      if (generation !== this.generation) return;
      this.clearTimers();
      recovery.dispose(); this.recovery = undefined;
      this.room = undefined; this.snapshotRound = -1;
      sessionStorage.removeItem(this.key);
      this.update({ status: 'idle', snapshot: null, hand: [], handRound: -1, playerId: '', secret: null, oldMaid:null, whoAmI:null, undercover:null,
        error: closedMessage || (code === 4028 ? 'ส่งคำสั่งมากเกินไป กรุณาเข้าห้องใหม่' : code === 4000 || code === 1000 ? '' : 'การเชื่อมต่อสิ้นสุด กรุณาเข้าห้องอีกครั้ง') });
      navigate(this.entryPath, true);
    });
    room.send('sync');
  }
  async connect(name: string, code?: string, botCount = 0, options: Record<string, unknown> = {}) {
    if (this.state.status !== 'idle' || this.room) return;
    const generation = ++this.generation;
    this.clearTimers();
    this.snapshotRound = -1;
    this.update({ status: 'connecting', error: '', hand: [], snapshot: null, secret: null, oldMaid:null, whoAmI:null, undercover:null });
    try {
      const client = await getClient();
      if (generation !== this.generation) return;
      const room = code ? await client.joinById(code.trim().toUpperCase(), { name: name.trim(), game: this.roomName })
        : await client.create(this.roomName, { ...options, name: name.trim(), botCount, game: this.roomName });
      if (generation !== this.generation) { closeRoom(room); return; }
      this.bind(room, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.update({ status: 'idle', error: error instanceof Error ? error.message : 'เข้าห้องไม่ได้ ตรวจสอบรหัสห้องและ server' });
    }
  }
  async restore() {
    if (this.room || this.state.status !== 'idle') return;
    const token = sessionStorage.getItem(this.key); if (!token) return;
    const generation = ++this.generation;
    this.update({ status: 'reconnecting', error: '' });
    const until = Date.now() + 60_000;
    const attempt = async () => {
      if (generation !== this.generation) return;
      try {
        const client = await getClient();
        if (generation !== this.generation) return;
        const room = await client.reconnect(token);
        if (generation !== this.generation) { closeRoom(room); return; }
        this.bind(room, generation);
      } catch {
        if (generation !== this.generation) return;
        if (Date.now() >= until) {
          sessionStorage.removeItem(this.key);
          this.update({ status: 'idle', snapshot: null, hand: [], handRound: -1, playerId: '', secret: null, oldMaid:null, whoAmI:null, undercover:null, error: 'หมดเวลาเชื่อมต่อใหม่ กรุณาเข้าห้องอีกครั้ง' });
        } else this.retryTimer = setTimeout(() => { void attempt(); }, 1500);
      }
    };
    await attempt();
  }
  send(type: A, value?: boolean | number | string | WhoSettings | UnderSettings | UnderVote) {
    if (!this.room || this.state.status !== 'connected' || !this.state.snapshot) return;
    this.room.send('action', { type, value, roundId: this.state.snapshot.roundId,
      ...(['whoami','undercover'].includes(this.roomName) && 'turnNumber' in this.state.snapshot ? { turnNumber: this.state.snapshot.turnNumber } : {}),
      actionId: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('') });
  }
  leave(destination = this.entryPath) {
    ++this.generation;
    this.clearTimers();
    this.recovery?.dispose(); this.recovery = undefined;
    sessionStorage.removeItem(this.key);
    if (this.room) {
      const wasDisconnected = !this.room.connection.isOpen;
      const departingToken = this.room.reconnectionToken;
      // Send the consented-leave message before closing the socket. An intentional
      // exit must not start automatic reconnection if a proxy drops the close frame.
      this.room.reconnection.enabled = false;
      void this.room.leave();
      this.room.connection.close(1000);
      if (this.roomName === 'poker' && wasDisconnected) {
        // If transport has recovered, release the reserved seat without restoring
        // the page. If still offline, the server's bounded reconnect window cleans it.
        void getClient().then(client => client.reconnect(departingToken)).then(departing => {
          departing.reconnection.enabled = false;
          departing.onMessage('*', () => {});
          void departing.leave(); departing.connection.close(1000);
        }).catch(() => {});
      }
    }
    this.room = undefined; this.snapshotRound = -1;
    this.update({ status: 'idle', snapshot: null, hand: [], handRound: -1, playerId: '', error: '', secret: null, oldMaid:null, whoAmI:null, undercover:null });
    navigate(destination);
  }
}
export const session = new GameSession();
export const pokerSession = new GameSession<PokerSnapshot, PokerAction>('poker', '/poker/play', '/poker/rooms/create');
export const spySession = new GameSession<SpySnapshot, SpyAction>('spyfall', '/spyfall/play', '/spyfall/rooms/create');
export const oldMaidSession = new GameSession<OldMaidSnapshot, OldMaidAction>('oldmaid', '/oldmaid/play', '/oldmaid/rooms/create');

export const whoAmISession = new GameSession<WhoSnapshot, WhoAction>('whoami', '/whoami/play', '/whoami/rooms/create');
export const liarSession = new GameSession<LiarSnapshot, LiarAction>('liar', '/liar/play', '/liar/rooms/create');
export const underSession = new GameSession<UnderSnapshot, UnderAction>('undercover', '/undercover/play', '/undercover/rooms/create');
