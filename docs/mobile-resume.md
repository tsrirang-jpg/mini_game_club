# Mobile app-switch recovery

All seven multiplayer games use GameSession and connection/room-recovery.ts.

- Listen to visibilitychange, pageshow (including BFCache) and online only while a room is bound; remove listeners and timers on exit/server closure.
- Preserve a healthy socket. On foreground, send a protocol ping, then sync the public snapshot and the owner's private data. Mark connected only after the sync snapshot arrives; snapshots queued while hidden cannot satisfy the ping probe.
- If no pong arrives within 1,500 ms, close with Colyseus MAY_TRY_RECONNECT (4010). This is an unexpected transport drop, not a consented leave. After a pong or reconnect handshake, allow a separate 4-second budget for the sync snapshot so slow mobile RTTs do not repeatedly restart a healthy socket.
- Bypass a pending SDK retry on foreground/network restoration. Guard concurrent and already-open sockets so queued backoff callbacks cannot reconnect a second time. Keep SDK delays between 100 and 1,000 ms, with a 4-second connection/handshake watchdog and a bounded 60-second recovery window.
- Pause proactive attempts when hidden/offline. Do not poll for game state or replay buffered actions (maxEnqueuedMessages remains zero). The server remains authoritative for cards, scores and deadlines.

The OS can suspend or discard a background browser; JavaScript cannot force a persistent connection. This change speeds recovery after returning, rather than running gameplay while backgrounded. The existing server reservation remains **60 seconds after disconnection**. Returning after the reservation expires or after a server restart still requires joining again. Game turn timers continue while the player is away.

## Validation

- npm exec vitest run tests/client-session.test.ts: wake events, old snapshot rejection, same identity/private hand, silent sockets, hidden/offline state, retry guards, handshake timeout, explicit exit and listener cleanup.
- npm run test:session-resume: real WebSocket tests for all seven games in a mobile Chromium/Edge context, including healthy and half-open sockets, network loss/recovery, and exit. Pokdeng and Poker also verify active private hands. Requires the development client/server (defaults to localhost:5188); GAME_URL can override the client URL. The tests synthesize visibility and traffic loss; physical iOS/Android OS suspension should still be checked on devices.
- npm run test:poker-lifecycle: automatic reconnect, refresh, intentional leave, host handover, privacy and room close regression.
