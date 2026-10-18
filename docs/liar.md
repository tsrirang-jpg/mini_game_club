# Liar’s Card · ไพ่ตอแหล

Create `/liar/rooms/create`, join `/liar/rooms/join`, play `/liar/play/:code`.
2–6 seats including bots; default no bots, 30 seconds per turn (15/30/60 selectable).

## Rules

- Deal all 52 cards, no Joker. The A♣ holder must open that card face up.
- Play exactly one face-down card claiming the required rank: 2 through K, then A, cyclically. A bluff is allowed.
- Skip advances the seat and **retains the rank**. A play resets consecutive skips and advances the rank once settled, including a caught bluff.
- A five-second RESPONSE window follows each hidden play. Emergency opens a confirmation; the first valid confirmation reveals the latest card immediately. There is no vote and no need to wait for other players.
- A wrong card returns **only that card** to its owner. A correct card stays discarded; the challenger has no penalty. A 2.5-second reveal then resumes play.
- An empty hand becomes a winner only after the latest card settles. Winners are skipped in subsequent turn order. Continue until only one player has cards.
- Consecutive skips by all players still holding cards end the round. Score A=1, 2–9 face value, 10/J/Q/K=10; the largest hand total loses. Equal largest totals share the loss.
- Timeout skips; the mandatory opening A♣ is played automatically on timeout. Disconnected seats retain their cards and can reconnect for 60 seconds without a fresh deadline. Expired seats skip automatically. Results reveal remaining hands for transparent scoring.

## Structure and resource use

- `packages/shared/src/liar.ts`: public DTOs, action types, constants and pure score/card helpers.
- `apps/server/src/liar-game.ts`: authoritative state machine LOBBY → PLAYING → RESPONSE → REVEAL → PLAYING/RESULTS. Opening/skipping bypass RESPONSE as appropriate. A separate pending card is withheld from snapshots; hand messages are owner-only.
- `runtime/card-room.ts`: shared with Old Maid; handles matchmaking, capacity, host transport, message rate limits, microtask snapshot coalescing, reconnect and disposal. Rule engines remain independent.
- Existing GameSession handles socket lifecycle, lazy SDK and stale connection generations. Liar pages are lazy loaded; no polling requests. Clocks use the shared visibility-aware deadline hook. Timers are event-based, tracked and cleared on transition/dispose.
- Existing RoomEntryForm, RoomEntryTabs, CurrentRoomNotice, SpyfallSelect, Card, BrandLogo, CopyRoomCodeButton, GameDialog and useDeadlineNow are reused. RoomIdentity composes the brand, code and copy button for both Spyfall and Liar, using the same responsive club-room-id layout. RoomEntryForm accepts both bot selection and extra settings, avoiding a second form implementation. GameDialog optionally disables dismissal during an authoritative reveal.
- Actions validate round, turn/claim token, ownership, phase, deadline and unique action ID. Other hands and discarded unchallenged cards are never public before results. History is capped at 40 entries and action replay sets at 2,048 per player/round.
- Desktop/tablet/portrait/landscape use one DOM tree. Own cards scroll within their strip, results within their panel; the active board fits without page scrolling down to 320×480 and 568×320.

## Verification

`npm test` includes Liar rules and real 2/3/6-client WebSocket tests. `npm run test:liar` checks create/join, five phases and Emergency at 11 viewport sizes, plus a real three-browser opening/skip/scoring/replay/exit flow. `npm run test:copy-room-code` and `test:brand` include Liar alongside the existing games.

## Artwork

`apps/client/public/images/entry/liar-hero-v2.png` is a 1000×666 transparent cutout of a brass lantern, two purple card backs and an ivory A♣. It is registered in the existing image manifest and cached by its versioned filename. Built-in imagegen extracted the artwork from the approved UI; macOS sips optimized its dimensions while preserving alpha. No mockup screen is shipped as the playable UI.

Create/join use a borderless hero and a separate filled purple form panel, with gold actions and readable filled inputs. Desktop and landscape place the illustration beside the form; portrait tablet/mobile stack it above the form. Compact landscape uses a two-column field grid. All sizes reuse one `RoomEntryForm`, so resizing preserves entered data and settings. Navigation, bot count and 15/30/60-second turn settings keep the existing behavior. Game-board styles and rule logic are unchanged.

At widths of at least 1000px and heights of at least 651px, entry uses the same `desktop-entry-welcome` grid as Spyfall. The existing content wrapper becomes `display:contents`, sharing shell width, navigation position, hero/form columns and compact desktop spacing without remounting the form. Its purple palette and borderless artwork remain game-specific; smaller screens retain their entry layouts.

The reference boards and prompts are in `artifacts/previews/preview-liar-borderless-entry-prompts-v1.md`; the production extraction prompt is in `artifacts/previews/preview-liar-entry-artwork-prompt-v2.md`.
