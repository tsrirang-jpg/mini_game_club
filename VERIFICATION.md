# Verification — 17 October 2026

ตรวจบน macOS ด้วย Microsoft Edge headless หลัง refactor component, การโหลดหน้าเกม, sync และวงจรจัดการ timer/connection โดยคง UI, กติกา บอท และข้อมูลส่วนตัว รายละเอียด benchmark และข้อจำกัดอยู่ใน [docs/performance.md](docs/performance.md)

| Check | Result |
| --- | --- |
| Strict TypeScript, client/server production build | PASS |
| Shared components, lazy pages/SDK, unchanged CSS output and all four existing game browser flows | PASS |
| Read-only sync in all four games returns one requester snapshot/private message and no peer broadcast | PASS |
| Shared rate limiter, room-code registry and coalesced/disposed snapshot publication | PASS |
| Deduplicated connections, canceled restore/reconnect races and late connection cleanup | PASS |
| Idle/hidden/expired clock cleanup, clipboard async cancellation and ten navigation cycles releasing timers/listeners | PASS |
| Reproducible baseline/optimized production benchmark, three samples, raw JSON and interactive HTML/SVG/PNG report | PASS — menu JS −51.7%; idle callbacks and sync peer broadcasts eliminated in the measured scenarios |
| Poker/Spyfall/Old Maid desktop create/join: 8 sizes 1000×651–2560×1440, aligned game switch/artwork, inputs/dropdowns/navigation and no horizontal overflow | PASS |
| Three redesigned entry forms: real create/join, settings retained across mobile/desktop resize, consented exit | PASS |
| Baseline comparison: Pok Deng create/join and compact entry geometry/colors match production at 5 phone/tablet/desktop sizes | PASS |
| No game switch in room screens: all 4 games in lobby/play/results at 7 mobile/desktop sizes; create/join switches remain available | PASS |
| Dropdown theme follows all 4 games, including selected/focused choices and native-modal portals; keyboard selection preserved | PASS |
| Mobile game switch: all 4 create/join pages at 5 phone sizes, visible 44px button above the form, touch navigation, no horizontal overflow; desktop switch unchanged | PASS |
| Four desktop designs: 8 sizes from 1000×651 to 2560×1440, active/lobby/results, readable ranks/suits, no panel overlap or page scroll | PASS |
| Poker six pots, High/Normal preferences, 12-card showdown, desktop width cap 1680 and existing compact windows | PASS |
| Spyfall all 8 players visible, separate role/chat/vote areas, answer draft survives desktop/mobile resize with a single form | PASS |
| Vitest rules, state machines and real WebSocket integration | PASS — 235 tests, 16 files |
| Old Maid private drawn cards, exact discarded pairs including initial deal, replay protection, deep copies and next-round reset | PASS |
| Real WebSocket private-history isolation and restoration after reconnect | PASS |
| Three real browsers: drawn-card/pair details, new-card badges, history popup, refresh and complete round | PASS |
| Old Maid feedback at seven viewports, 3/8 players, matched/unmatched draws and up to 13 cards; no page scroll or panel overlap | PASS |
| Shared dropdowns: Pok/Poker/Old Maid creation, touch/keyboard, five viewports, dealer/catch targets and card size inside native modal | PASS |
| Old Maid 0–7 bots, default 2 in creation form, host-only add/remove, total capacity 8 and human host transfer | PASS |
| Old Maid one human with 2/7 bots: full rounds, private hands, automatic readiness, fair random draws and timer cleanup | PASS |
| Poker Normal/High size preference, 8 desktop viewports, Raise/showdown and refresh persistence | PASS |
| Old Maid 3–8 players, random removed card of any rank, auto pairs, last-card loser, turn tokens/idempotency, timeout and expired seats | PASS |
| Old Maid real 3/8-client WebSocket rounds, private hands and refresh/reconnect | PASS |
| Old Maid real 3-browser round, selection/confirmation, random-card reveal, next round and rules/exit | PASS |
| Same Old Maid browser flow against compiled production build | PASS |
| Four distinct menu/create themes; Old Maid 3/8-player fixtures with 5/13 cards; Spyfall question/results at 6 viewports | PASS |
| Pok 2–6 players, all phases, caught/Pok-revealed hands, 13 viewports, separate ranks/suits and no page scroll | PASS |
| Pok real multiplayer/catch/reconnect/dealer draw and final comparison | PASS |
| Poker normal/raise/results, 13 viewports, no overlap or page scrolling, dialogs and exit | PASS |
| Poker six real players, unequal all-ins, five pots/refund, exact awards at 15 viewports | PASS |
| Spyfall real 3-client questioning/voting, locked ballots/reconnect, private answer/surrender, winners and cleanup | PASS |
| Spyfall selected 7/2/3-minute timers, static 3–8-player range, settings sync/reload and readiness reset | PASS |
| Spyfall voting/answer popups, 3/8 players, 11 desktop/mobile/keyboard viewports, expiry and focus | PASS |
| Compiled production health, SPA deep links including Old Maid, immutable assets and 404s | PASS |
| Compiled production create/join and deliberate exit, all four games | PASS |

รอบตรวจนี้ใช้กริดใหม่: มือของเราอยู่ด้านล่างบนมือถือแนวตั้ง และอยู่ข้างพื้นที่เล่นบนแนวนอน/จอแนวตั้งที่เตี้ยมาก ผลของตารางเก่าด้านล่างเป็นประวัติของเวอร์ชันก่อนหน้าเท่านั้น โดยกติกาป๊อกเด้งล่าสุดอ้างอิง README และชุดทดสอบปัจจุบัน

# Archived verification — 14 October 2026

ตรวจบน Windows ด้วย Node.js 24.21.0 และ Microsoft Edge headless

| Check | Result |
| --- | --- |
| TypeScript strict typecheck | PASS |
| Poker viewport layout: 6 players, 11 portrait/landscape/tablet/desktop sizes in lobby/raise/results | PASS |
| Poker controls fully inside viewport; no page/hidden overflow or seat/board overlap after chip selection | PASS |
| Poker rules/management/results dialogs, Escape/close and exit restores site header | PASS |
| Vitest all-games/state-machine/WebSocket suites | PASS — 68 tests, 8 files |
| Pok Deng rollback: original Pok-before-score comparison, pair/two-suited ×2, three-suited ×3, ties and payouts | PASS |
| Pok Deng: three-times collateral, original bot policy and no trips/face/straight priority | PASS |
| Pok Deng: home button and private score/multiplier display; original rule text matches server | PASS |
| Poker table: original blue-green felt/border, own hand at bottom, total POT immediately above five board cards | PASS |
| Desktop 1366×768: hole cards at least 60px, board cards at least 76px, enlarged unobscured ranks | PASS |
| High card size defaults on desktop; Normal/High selection persists across refresh | PASS |
| Scaled Windows: DPR 2, CSS viewport 952×442, centered POT/board and own hand at bottom | PASS |
| High cards during Raise and 12-card showdown, 8 desktop viewports including 800×400 and 1903×885 | PASS |
| Show cards: winner-only, post-round, exact own cards, no payout change, reconnect and next-round reset | PASS |
| Two real WebSocket clients observe voluntarily revealed cards; losing hand remains private | PASS |
| 1420-chip example: main 640/side 780 paid to different eligible hands | PASS |
| Live pots hide winners/refunds until settlement; final total survives departed players | PASS |
| Six real browser players create unequal stacks; main + 4 side pots + refund, exact per-player shares | PASS |
| Pot UI, no clipped amounts/overlaps/scroll in 13 sizes, including 1903px/2560px desktop; 1280px width cap | PASS |
| Vite production client build | PASS |
| Compiled Node.js server build | PASS |
| Compiled production server create/join with two clients in all three games | PASS |
| Production /health, SPA deep links, hashed asset caching, unknown files return 404 | PASS |
| All three browser suites against the same-origin production server | PASS |
| render.yaml against the official Render JSON Schema | PASS |
| Public HTTPS/WSS health, SPA routing, all-three-game create/join and normal consented exit | PASS |
| All three browser suites on https://wong-pai.onrender.com | PASS |
| npm audit | 0 vulnerabilities reported at verification time |
| Two independent browser sessions | PASS |
| Create/join with room code | PASS |
| Complete round and return to lobby | PASS |
| Own hand visible/opponent face-down before reveal | PASS |
| Refresh reconnect restores original private hand | PASS |
| Round point conservation | PASS |
| Desktop 1366px/mobile 360px horizontal overflow | None detected |
| Unhandled browser exceptions during smoke flow | None detected |
| Separate create/join/play URLs; creation form absent on game page | PASS |
| Back navigation and resume active game | PASS |
| Solo game with two bots, automatic actions and settlement | PASS |
| Bot dealer, add/remove bots, ready next round | PASS |
| Refresh keeps bot room and roster | PASS |
| Direct game URL without session offers prefilled join page | PASS |
| Game selector with Pok Deng and Texas Hold’em No-Limit | PASS |
| Poker create/join and refresh reconnect on separate game route | PASS |
| Poker Pre-flop/Flop/Turn/River and showdown | PASS |
| Poker bots alongside human players, next hand and button rotation | PASS |
| Poker side pots, short all-ins, cumulative reopening and unmatched refunds | PASS |
| Poker ties, kickers, ace-low straight, all hand categories and odd chips | PASS |
| Poker desktop/mobile layout and deal/board reveal animation | PASS |
| Poker 30-second action deadline: no timeout at 29,999ms, timeout at 30,000ms | PASS |
| Poker rules: ten ordered hands, 50 example cards, Thai/English names | PASS |
| Raise chip presets: 10/20/50/100/200/All-in, invalid minimum disabled | PASS |
| Raise 20 above table price, opponent Call and correct chip conservation | PASS |
| Spyfall private role distribution and hidden location outside public snapshots | PASS |
| Spyfall 5/10-minute questions, early unanimous readiness and 3-minute voting | PASS |
| Spyfall correct accusation → correct guess lets spy win; wrong guess lets citizens win | PASS |
| Spyfall guess timeout, wrong accusation and no-majority outcomes | PASS |
| Spyfall chat limits, plain-text rendering and chat pause while spy guesses | PASS |
| Spyfall 3 independent browser sessions with reconnect and mobile layout | PASS |
| Spyfall 3 real WebSocket clients, private ballots and restored role/vote | PASS |
| Initial client countdown display capped to server phase duration | PASS |

Tests cover score/pok/multipliers/ties, distinct shuffle/dealing, full round,
6 seats, dealer-pok shortcut, wrong role/phase, stale actions, duplicate draw,
deadline auto-stand, private snapshot boundaries, reconnection, expired-player
settlement, collateral, host transfer and malformed actions.

Screenshots include the Poker/Pok Deng previews and `preview-spyfall-create.png`, `preview-spyfall-question.png`, `preview-spyfall-mobile.png`, `preview-spyfall-vote-result.png`, `preview-spyfall-result.png`.

## Repeat checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd audit
```

With `npm.cmd run dev` running in another terminal:

```powershell
npm.cmd run test:browser
npm.cmd run test:poker
npm.cmd run test:poker-layout
npm.cmd run test:poker-pots
npm.cmd run test:poker-show
npm.cmd run test:poker-high
npm.cmd run test:spyfall
```

Browser smoke uses installed Microsoft Edge through Playwright. To use another
installed browser channel set `BROWSER_CHANNEL` appropriately. No browser binary
download is required for Edge on this machine.

Compiled-server smoke: build first, then set `$env:NODE_ENV='production'`
and `$env:PORT='2568'` and run `npm.cmd start`; in another terminal run
`node tests/production-smoke.mjs`. Set `$env:GAME_URL='http://127.0.0.1:2568'`
to run the browser suites against that production server.

Published to https://github.com/tsrirang-jpg/mini_game_club (branch main).
Render service wong-pai is live in My Workspace, Free plan, Singapore,
Node 24, with one web service serving both the client and game server.
Public URL: https://wong-pai.onrender.com/games.
Render service ID: srv-db7i3oqvcj2c73do6460. Auto-deploy from main is enabled.
Real browser tests on the public URL passed for all three games, including
mobile layout, private cards/roles, refresh/reconnect, Poker betting, and
Spyfall chat, voting, and both guess outcomes. The WSS diagnostic additionally
checks normal intentional closing and immediate seat removal. Intentional exits
disable automatic reconnection and send consent before closing the socket.

The MVP has not been load-tested. It stores room
and points in process memory. Restarting or redeploying the server removes both. Tests do not
claim production capacity or cross-browser coverage beyond this Edge run.
