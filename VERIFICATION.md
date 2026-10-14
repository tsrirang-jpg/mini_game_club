# Verification — 14 October 2026

ตรวจบน Windows ด้วย Node.js 24.21.0 และ Microsoft Edge headless

| Check | Result |
| --- | --- |
| TypeScript strict typecheck | PASS |
| Vitest all-games/state-machine/WebSocket suites | PASS — 55 tests, 7 files |
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
