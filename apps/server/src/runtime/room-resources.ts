import { randomBytes } from 'node:crypto';
import type { Client } from '@colyseus/core';

export const roomCodes = new Set<string>();
export function claimRoomCode() {
  let code: string;
  do { code = randomBytes(5).toString('hex').toUpperCase(); } while (roomCodes.has(code));
  roomCodes.add(code); return code;
}
export class ClientRateLimiter {
  private readonly clients = new Map<string, { at: number; count: number }>();
  constructor(private message = 'ส่งคำสั่งเร็วเกินไป') {}
  allow(client: Pick<Client, 'sessionId' | 'send' | 'leave'>) {
    const now = Date.now();
    let rate = this.clients.get(client.sessionId);
    if (!rate || now - rate.at >= 1000) { rate = { at: now, count: 0 }; this.clients.set(client.sessionId, rate); }
    if (++rate.count <= 20) return true;
    if (rate.count === 21) client.send('error', { code: 'RATE_LIMIT', message: this.message });
    if (rate.count >= 100) void client.leave(4028);
    return false;
  }
  delete(id: string) { this.clients.delete(id); }
  clear() { this.clients.clear(); }
}
// Combine synchronous state transitions into one final public snapshot. Private
// messages still go only to their owner. No timeout or pending job survives dispose.
export class SnapshotPublisher {
  private queued = false;
  private disposed = false;
  constructor(private readonly publish: () => void) {}
  request() {
    if (this.queued || this.disposed) return;
    this.queued = true;
    queueMicrotask(() => { this.queued = false; if (!this.disposed) this.publish(); });
  }
  dispose() { this.disposed = true; }
}
