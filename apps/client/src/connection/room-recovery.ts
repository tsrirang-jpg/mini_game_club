import type { Room } from '@colyseus/sdk';

const PING_TIMEOUT_MS = 1500;
const SYNC_TIMEOUT_MS = 4000;
const CONNECT_TIMEOUT_MS = 4000;
const RETRY_CLOSE_CODE = 4010; // Colyseus MAY_TRY_RECONNECT preserves the seat.

/** Wake-driven recovery, shared by all games. No background polling/keepalive. */
export class RoomRecovery {
  private disposed = false;
  private connecting = false;
  private recovering = false;
  private awaitingSync = false;
  private pongReceived = false;
  private wasHidden = document.hidden;
  private lastWake = -Infinity;
  private probeTimer?: ReturnType<typeof setTimeout>;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private originalReconnect: Room['connection']['reconnect'];

  constructor(private room: Room, private callbacks: {
    resuming(): void; ready(): void; isCurrent(): boolean;
  }) {
    room.reconnection.minDelay = 100;
    room.reconnection.maxDelay = 1000;
    this.originalReconnect = room.connection.reconnect;
    // The SDK may still have an older backoff callback queued when a wake event
    // starts an immediate attempt. Only one socket may connect at a time.
    room.connection.reconnect = (...args) => {
      if (!this.current() || !room.reconnection.enabled || room.connection.isOpen || this.connecting || !this.foreground()) return;
      this.connecting = true;
      try {
        this.originalReconnect.apply(room.connection, args);
        this.connectTimer = setTimeout(() => {
          this.connectTimer = undefined;
          if (this.current() && this.connecting) room.connection.close(RETRY_CLOSE_CODE);
        }, CONNECT_TIMEOUT_MS);
      } catch (error) {
        this.connecting = false;
        throw error;
      }
    };
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('pageshow', this.pageShow);
    window.addEventListener('online', this.online);
  }
  private current() { return !this.disposed && this.callbacks.isCurrent(); }
  private foreground() { return !document.hidden && navigator.onLine !== false; }
  private visibility = () => {
    if (document.hidden) {
      this.wasHidden = true;
      this.clearProbe();
    } else if (this.wasHidden) {
      this.wasHidden = false;
      this.wake();
    }
  };
  private pageShow = (event: PageTransitionEvent) => {
    if (event.persisted || this.wasHidden) { this.wasHidden = false; this.wake(); }
  };
  private online = () => this.wake();
  private wake() {
    if (!this.current() || !this.foreground() || this.awaitingSync || this.connecting || Date.now() - this.lastWake < 250) return;
    this.lastWake = Date.now();
    this.callbacks.resuming();
    if (!this.room.connection.isOpen || this.room.reconnection.isReconnecting) this.reconnectNow();
    else this.sync(true);
  }
  private sync(checkSocket: boolean) {
    this.clearProbe();
    this.awaitingSync = true;
    this.pongReceived = !checkSocket;
    this.armProbe(checkSocket ? PING_TIMEOUT_MS : SYNC_TIMEOUT_MS);
    try {
      if (checkSocket) {
        // A fresh protocol pong proves that an OPEN-looking socket still works.
        // Old snapshots queued while the page was frozen cannot satisfy this probe.
        this.room.ping(() => {
          if (!this.current() || !this.awaitingSync) return;
          this.pongReceived = true;
          this.armProbe(SYNC_TIMEOUT_MS);
          this.room.send('sync');
        });
      } else this.room.send('sync');
    } catch {
      this.clearProbe();
      this.room.connection.close(RETRY_CLOSE_CODE);
    }
  }
  receivedSnapshot() {
    if (!this.current() || !this.awaitingSync || !this.pongReceived) return;
    this.clearProbe();
    this.callbacks.ready();
  }
  dropped() {
    const firstDrop = !this.recovering;
    this.recovering = true;
    this.clearProbe();
    this.clearConnect();
    // Accelerate the first drop only. Repeated failures retain SDK backoff,
    // so an unavailable server cannot consume the retry budget in a tight loop.
    if (firstDrop) queueMicrotask(() => { if (this.current() && this.foreground()) this.reconnectNow(); });
  }
  reconnected() {
    if (!this.current()) return;
    this.recovering = false;
    this.clearConnect();
    this.callbacks.resuming();
    this.sync(false);
  }
  private reconnectNow() {
    if (!this.current() || !this.foreground()) return;
    try {
      this.room.connection.reconnect({ reconnectionToken: this.room.reconnectionToken.split(':')[1], skipHandshake: true });
    } catch { /* The SDK's bounded retry loop handles transport failures. */ }
  }
  private armProbe(timeout: number) {
    if (this.probeTimer !== undefined) clearTimeout(this.probeTimer);
    this.probeTimer = setTimeout(() => {
      this.clearProbe();
      if (this.current()) this.room.connection.close(RETRY_CLOSE_CODE);
    }, timeout);
  }
  private clearProbe() {
    if (this.probeTimer !== undefined) clearTimeout(this.probeTimer);
    this.probeTimer = undefined; this.awaitingSync = false; this.pongReceived = false;
  }
  private clearConnect() {
    if (this.connectTimer !== undefined) clearTimeout(this.connectTimer);
    this.connectTimer = undefined; this.connecting = false;
  }
  dispose() {
    this.disposed = true;
    this.clearProbe(); this.clearConnect();
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pageshow', this.pageShow);
    window.removeEventListener('online', this.online);
    // Keep the disposed guard installed: queued SDK callbacks must stay inert.
  }
}
