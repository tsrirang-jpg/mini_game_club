# Who am I — ฉันคือใคร?

Routes: `/whoami/rooms/create`, `/whoami/rooms/join?code=…`, `/whoami/play/<ROOM_CODE>`.

## Rules

- 3–8 real players. The host starts after everyone else is ready. No bots.
- Category: mixed / animals / jobs / objects. The server-only pool has 72 words with Thai/English aliases; each category has 24. Every player gets a distinct word within a game. Words are not reused across games until the selected pool has too few unused words for the next deal.
- Every player sees their friends' identities and never their own. Normal public snapshots contain no assigned words until a game ends. Each player's private `identities` message explicitly excludes their own identity and all aliases/full word pools.
- Default settings: 1 minute per turn, 4 question cycles, 3 games. Time choices 1/2/3 minutes; question cycles 4/6/8/10; games 3/5/7/10. All creation and lobby settings are validated by the server. Changing lobby settings clears readiness.
- A question cycle gives each unsolved participant one turn in seat order. A player chooses **one question OR one guess** on their turn. Once they ask, they must wait until their own next turn to guess, even if the answer becomes clear immediately. Wrong guesses consume the turn.
- Other connected participants, including those already solved, can confirm yes/no/unknown once per question. Votes stay private until aggregated. The answer needs a strict majority of peers who have answered or are still connected and expected to answer; no clear majority means unknown. Missing votes cannot turn a minority into a yes/no majority.
- A submitted question does not reset the clock. The asking player can read the result and end the turn, or the server advances at the original deadline. Leaving early resolves incomplete votes with the same majority rule.
- A correct guess gives **1 point**, once per game; that player stops asking/guessing but can keep answering friends. The game ends when everyone solves or all question cycles are exhausted. All identities are revealed, including the viewer's own.
- The host starts the next game with fresh words. Scores accumulate until the selected game count is reached. Highest-score players share the win. With zero correct guesses the result says nobody solved, rather than inventing a winner.
- Between games, the host can return to the lobby. Starting a new set resets scores. New players can join only in the lobby or after the whole set ends, not during/between games in an ongoing set.

## Lifecycle, structures and resource handling

`LOBBY → PLAYING → GAME_END → PLAYING … → RESULTS → LOBBY`.

`roundId` increases for every word deal; `turnNumber` increases for every actual turn. Gameplay actions must match both. Each validated action ID is replay-protected with a bounded Set (2048 per player per deal). Public questions/history are copied and bounded to 80; maximum normal questions per game is 8×10. Players, identities and votes use keyed Maps; used words and room codes use Sets.

One server timeout owns the active turn; no interval or poll is added. Client clocks use `useDeadlineNow`, pausing in hidden tabs and releasing resources on unmount. The shared room rate limiter/publication helper and `GameSession` reconnection/cleanup handle this game too. Read-only sync sends one private identity payload and one snapshot only to its requester.

Refresh/reconnect within 60 seconds restores the same word visibility, confirmed answer and remaining deadline. Current offline players keep their original deadline; expired turns advance and offline future turns are skipped. Host moves to another connected player. At a turn boundary, fewer than two connected participants ends the current game safely. Starting the next game needs three connected players; otherwise the host can return to the lobby. Server disposal cancels the timer and releases room data.

## UI and reuse

- Warm espresso/amber/ivory palette, responsive create/join forms with the four selectors in a 2×2 grid, illustrated identity cards, a separate personal mystery area, roster and question history, accessible guess/rules/history/players dialogs, reveal/score views.
- `WhoAmICreatePage`, `WhoAmIPlayPage` and their scoped CSS load on demand. Existing `RoomEntryForm`, `RoomEntryTabs`, `EntryFacts`, `SpyfallSelect`, `CopyRoomCodeButton`, `GameSession`, `useDeadlineNow` and room runtime helpers are reused.
- `components/ui/GameDialog` provides native dialog focus/Escape/cleanup for overlays. The same component instance and form state remain across viewport changes.
- Existing four games keep their rules/layout. Game switching remains on create/join only. Browser screenshots go to `artifacts/previews/`.
- Artwork and its generation prompt are documented in [desktop-entry-assets.md](desktop-entry-assets.md).

## Checks

`npm test`, `npm run typecheck`, `npm run build`, `npm run test:whoami` (with dev server running). `GAME_URL` runs the real multiplayer flow against a compiled or deployed server and skips dev-only fixtures. Browser checks cover 11 viewports, 8-player fixtures, guess dialogs, private words, answer confirmation/reconnect, next-turn guessing, three complete games, score ties and deliberate exits. Server tests also cover timeouts, stale/replayed actions, capacity, invalid settings, host transfer, deep copies and timer disposal.
