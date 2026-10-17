# Undercover

Entry routes `/undercover/rooms/create` and `/undercover/rooms/join`; room `/undercover/play/:code`. Real people only, up to eight. A room starts with at least `max(3, 2 × undercoverCount + whiteCount + 1)` people so the initial civilian group outnumbers undercover players. Default one undercover, zero White; configure 1–2 undercover and 0–1 White. Selecting one White requires at least four people.

## Settings and play

- Independent typing-turn and voting dropdowns: 1, 2 or 3 minutes, both default one minute. Host can update them before starting; every change resets readiness. Server owns deadlines.
- Deal words from 30 curated nearby-word pairs, with either word randomly selected as the main word. Assign roles privately. Clients receive only their own word (or null), a personal confirmed ballot and last-chance eligibility. **No role/faction is sent in snapshots or private messages**, and the UI never labels a player's role. Results show names, words and winners without role badges.
- WORD: each player can reveal/hide their own word and acknowledge readiness. All ready or 60 seconds starts the first clue cycle.
- DESCRIBE: each active person gets one 1–120-character clue in seat order. Starting seat rotates each cycle. A clue equal to the secret word is rejected; players must avoid indirect spoilers themselves. A turn timeout records a missed clue and moves on.
- VOTING: everyone still active chooses another active player and a suspected type (Undercover / Mr. White). The type records suspicion; it does not change vote weighting or validate the target's actual role. Confirmed ballots lock and restore after reconnect. Candidate totals stay hidden until voting resolves. All active voters confirmed or deadline triggers resolution.
- Highest vote leaves. A tie creates one runoff limited to tied candidates; another tie or no votes starts another clue cycle without eliminating anyone. Players who already left can watch, but cannot hint/vote.
- A voted White gets a private GUESS popup with answer input, confirmation and surrender, for 60 seconds. Only that person can submit; others see a waiting popup. Correct main-word guess wins immediately for that White. Wrong guess, surrender or timeout removes them and checks the remaining game. Another participant disconnecting cannot cut off this last chance.
- The main-word group wins once all alternate-word and no-word players are out. Undercover players win once their remaining number is at least the remaining main-word number. If only no-word players remain, they win. Team wins include teammates voted out earlier. A White's correct guess takes precedence while their last-chance window is open.
- Reconnect is allowed for 60 seconds without restarting deadlines or changing confirmed ballots. On expiry, a player leaves the active round, the host transfers, invalid target ballots are cleared, and the game progresses or ends as appropriate. Rooms/scores remain in memory, as with the existing games.

## Components and data boundaries

Shared `RoomEntryForm`, `RoomEntryTabs`, `CurrentRoomNotice`, `GameSwitch`, `SpyfallSelect`, `RoomIdentity`, `GameDialog`, `BrandLogo`, clipboard handling, `GameSession` and `useDeadlineNow` are reused. `UndercoverSettings`, `UnderRoster`, `UnderWord`, `UnderHistory` and the two phase dialogs keep the page controller small. One responsive DOM preserves form drafts across viewport changes. Typing and ballots use round/turn tokens and bounded per-player action replay sets.

`UndercoverRoom` reuses the existing `CardRoom` transport (rate limits, batched public snapshots, reconnect/dispose). `UndercoverGame` handles private roles/words, queues and votes with Map/Set. Public player DTOs omit role, word, expiry and replay data. Only owner-addressed `undercover` messages contain words; correct answers become public only in final results. No polling or per-second server broadcasts; only an event deadline timer, cleared at transitions/disposal. Clue history is capped at 80 entries and each player's seen-action set at 2,048 per round.

## Verification

`tests/undercover.test.ts` covers secret boundaries, 3–8-player deals, validation, timers, votes, runoff, White outcomes, reconnection and cleanup. `undercover-network.test.ts` uses real 4/8-client sockets. `npm run test:undercover` checks 11 entry/game/popup viewports, no active-page scroll, private-word display, both dropdowns, real four-browser clues/votes, White-only answer input, reload, correct win and replay. Common brand/copy/production checks include the seventh game.

## Artwork

Menu and entry share `apps/client/public/images/menu/undercover-trio-v1.jpg`, 1000×666 (~166 KiB), through the shared image manifest. The approved low-polygon trio has a white-haired character behind the central civilian and a dark fedora character on the right. Both visible faces use peach skin, with no mouth/shadow on the left character. Built-in imagegen produced the illustration; macOS sips resized/transcoded it. Menu loading is lazy; entry prioritizes the same cached asset. Text and actions remain HTML, including “อธิบายคำให้เนียน หาคนที่ได้คำต่างจากคุณ”.

Black, gold and white theme variables in `club-theme.css` drive the menu, create/join form, lobby, private word, clue history, results and dialogs. `undercover.css` consumes those variables, including the dropdown portal's `theme-undercover` class. Light secret cards use a dedicated dark text color for readable reveal/hide controls. Existing layouts, deadlines, privacy boundaries and game logic remain shared and unchanged.

The final image edit prompts are recorded in `artifacts/previews/preview-undercover-menu-production-prompts-v5.md`.
