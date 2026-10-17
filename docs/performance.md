# Resource refactor and measurements — 17 October 2026

The report compares actual compiled builds of this repository, rather than estimated savings. Open [the interactive report](../reports/performance/index.html), [the overview PNG](../reports/performance/comparison.png), or [the standalone SVG](../reports/performance/comparison.svg). Raw samples are in [before.json](../reports/performance/before.json) and [after.json](../reports/performance/after.json).

## Measured results

| Scenario | Before | After |
| --- | ---: | ---: |
| Menu cold JavaScript | 494.100 kB | 238.842 kB (−51.7%) |
| Pok create cold JavaScript | 494.100 kB | 252.116 kB (−49.0%) |
| Poker create cold JavaScript | 494.100 kB | 261.438 kB (−47.1%) |
| Spyfall create cold JavaScript | 494.100 kB | 255.545 kB (−48.3%) |
| Old Maid create cold JavaScript | 499.470 kB | 252.418 kB (−49.5%) |
| Lobby callbacks / 3 seconds, four games | 12–15 | 0 |
| Peer snapshots / 5 sync requests, each game | 5 | 0 |
| Warm hero image network requests / reload, each image | 1 (304, 300 transfer bytes) | 0 (cache hit) |
| Pending clipboard callbacks after exit | 1 | 0 |
| Menu retained JS heap after forced GC | 2.415 MiB | 2.063 MiB (−14.6%) |

The menu now makes 2 JavaScript requests instead of 1, and create pages make 6–9 instead of 1–2. These are smaller cacheable chunks; the reported byte reduction does not mean every request count fell. Idle script execution in this sample changed from approximately 6–12 ms to 0 ms per 3 seconds; browser task time remains nonzero. This indicates removed idle polling, not zero total CPU use or a speedup for all game actions.

## Shared structure

- `apps/client/public/images/entry/`: existing production WebP illustrations. `src/assets/images.ts` is the typed URL/dimension manifest. Bump the `-v1` filename when changing an image; versioned images receive a one-year immutable cache header. Unversioned images keep revalidation.
- `apps/client/src/components/entry/`: common create/join form, tabs, room notice, facts and game-specific rule content. Bot options are constructed once; game settings/defaults remain explicit props. Native validation and keyboard/touch dropdown behavior remain intact.
- `apps/client/src/components/ui/`: memoized cards and a shared copy-code button that cancels its timeout on unmount and ignores late clipboard resolutions.
- `apps/client/src/hooks/useDeadlineNow.ts`: one lifecycle for the four countdowns. It schedules work only while a visible page has a live deadline, reads wall time on return, and releases its listener/timeout on unmount. The server remains authoritative about expiry.
- `apps/client/src/games.ts`: typed game metadata shared by routing and the game menu. All create/play pages load on demand; the network SDK loads when connecting/restoring. Only the selected game subscribes to React updates.
- `apps/server/src/runtime/room-resources.ts`: shared `Set` of claimed room codes, per-client `Map` rate limiter, and a publication helper that combines synchronous changes into one snapshot per microtask. Disposal releases the code/rate entries and suppresses queued publication.

Data structures follow their purpose: `Set` for code uniqueness, `Map` for keyed client counters, typed records for fixed game metadata, and arrays for ordered hands/history. Existing bounded game histories and action replay guards remain in place. Private cards and Spyfall secrets still go only to their owners; they never become part of a public snapshot.

A read-only `sync` no longer calls `reconnect`, changes public state or broadcasts to peers. It returns the requester's current snapshot and private hand/role. Actual reconnects still update connection state. Session generation guards also close late connections, suppress stale reconnect callbacks/retries after exit and deduplicate simultaneous connect/restore attempts.

CSS ordering and game rules were preserved. This work does not regenerate artwork or change payouts, clocks, voting rules or turn rules.

## Measurement protocol

The baseline is commit `92b8a23947aa98093b1a734c85af5387cb62b459`. Each JSON records the exact measured source commit, time, browser/Node version, viewport and all samples. Both servers use production client/server builds on the same machine with the same installed dependencies; the baseline build was copied aside before refactoring. No build or test suite ran concurrently with either benchmark.

Three samples per case, median reported:

1. **Cold JavaScript:** new Edge browser context, 1366×768, open menu or create form, wait for fonts/settled DOM; sum decoded `.js` resource body bytes. This is uncompressed JS loaded before room creation, not total site download or network latency. Lazy chunks can increase request count while reducing bytes. CSS remains the same build output.
2. **Idle work:** create an actual lobby and wait for initial messages, then instrument timeout/interval callbacks and CDP `ScriptDuration`/`TaskDuration` for three seconds. Active deadlines still tick; no-input lobbies do not need a rendering clock.
3. **Sync traffic:** two SDK clients per game, send five read-only sync requests 100 ms apart. Count snapshots delivered to the requester and to the other client. This is an intentionally isolated scenario, not all gameplay traffic.
4. **Image caching:** load each desktop hero, reload in the same context, inspect `transferSize`. A conditional HTTP 304 still counts as a network request; a memory/disk-cache hit with zero transfer does not.
5. **Cleanup:** mock successful clipboard access, copy a room code and immediately leave; count outstanding 1,800 ms clipboard timeouts 50 ms after exit. This measures temporary retained callbacks, not unbounded heap growth.
6. **Heap:** force GC on each settled entry page, record JS heap used. This indicates the retained heap in that scenario only. It does not prove an absence of leaks and excludes DOM/GPU/process memory. Small CPU/heap differences can vary between runs.

To reproduce, build both revisions separately, serve the compiled baseline on port 2568 and the optimized build on 2569, then run from the repository root (requires installed Edge and Playwright):

```sh
BENCH_PHASE=before BENCH_URL=http://127.0.0.1:2568 npm run benchmark:performance
BENCH_PHASE=after BENCH_URL=http://127.0.0.1:2569 npm run benchmark:performance
npm run report:performance
```

These commands overwrite the corresponding sample files. Keep the two server builds isolated and use the same environment/sample count. To serve a copied build, the server supports `CLIENT_DIST` and `PORT`; production needs `NODE_ENV=production`. The report generator uses local HTML/SVG and Edge to export a PNG, with no external chart library, CDN, tracking or API calls.

This is not a production load test or a measurement of FPS, cellular load time, server capacity or all possible heap retention. It supports the specific improvements shown in the graphs. We report the JavaScript request-count tradeoff and raw samples as well as reductions.

## Validation

- Strict TypeScript and client/server production builds pass.
- Vitest: **235 tests / 16 files**, including real WebSocket sync privacy/no-peer-broadcast, rate limits, queued-publication disposal and canceled session races.
- `test:client-resources`: idle/active/hidden/expired clocks, clipboard timeout cleanup, late clipboard resolutions and repeated navigation with no retained timer/listener.
- Browser suites `test:club-ui`, `test:pok-catch`, `test:spyfall`, `test:oldmaid`, `test:poker-layout`: all four games, real multiplayer/reconnect, complete rounds and phone/desktop layouts.
