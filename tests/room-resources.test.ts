import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@colyseus/core';
import { ClientRateLimiter, SnapshotPublisher, claimRoomCode, roomCodes } from '../apps/server/src/runtime/room-resources';
afterEach(() => { vi.useRealTimers(); });
describe('room resources', () => {
  it('batches synchronous changes and cancels a queued publication on dispose', async () => {
    const publish = vi.fn(); const queue = new SnapshotPublisher(publish);
    queue.request(); queue.request(); queue.request(); expect(publish).not.toHaveBeenCalled();
    await Promise.resolve(); expect(publish).toHaveBeenCalledTimes(1);
    queue.request(); queue.dispose(); await Promise.resolve(); queue.request();
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it('limits each player independently, resets the window and releases removed players', () => {
    vi.useFakeTimers(); const limiter = new ClientRateLimiter();
    const make = (sessionId: string) => ({sessionId, send: vi.fn(), leave: vi.fn()}) as unknown as Pick<Client, 'sessionId'|'send'|'leave'>;
    const a = make('a'), b = make('b');
    for(let i=0;i<20;i++)expect(limiter.allow(a)).toBe(true);
    expect(limiter.allow(a)).toBe(false);expect(a.send).toHaveBeenCalledTimes(1);expect(limiter.allow(b)).toBe(true);
    for(let i=21;i<100;i++)limiter.allow(a);expect(a.leave).toHaveBeenCalledWith(4028);
    vi.advanceTimersByTime(1000);expect(limiter.allow(a)).toBe(true);
    limiter.delete('a');expect(limiter.allow(a)).toBe(true);limiter.clear();expect(limiter.allow(b)).toBe(true);
  });
  it('uses one collision registry for every game and allows explicit release', () => {
    const before=roomCodes.size,a=claimRoomCode(),b=claimRoomCode();
    expect(a).toMatch(/^[A-F0-9]{10}$/);expect(a).not.toBe(b);expect(roomCodes.size).toBe(before+2);
    roomCodes.delete(a);roomCodes.delete(b);expect(roomCodes.size).toBe(before);
  });
});
