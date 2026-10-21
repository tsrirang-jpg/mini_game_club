# Shared room entry

All seven multiplayer games share the Road Fighter-style composition: game heading, illustration on the left, form on the right, then game facts and a short guide. Each game retains its own theme. Road Fighter remains a single-player game with its own start screen.

## Components and configuration

- `components/entry/RoomEntryPage.tsx` owns the composition, mode tabs, current-room notice, facts, short guide and full-rules dialog.
- `RoomEntryHeader.tsx` provides the official brand, back-to-games action and help. Returning to `/games` does not leave an active room.
- `RoomEntryForm.tsx` owns name/code/bot state, validation and submission. It also exports `RoomEntryTabs` and `CurrentRoomNotice`.
- `room-entry-config.ts` contains per-game captions, facts, guide steps and bot defaults. Names, capacities and create routes come from `games.ts`.
- `room-entry.css` is scoped under `.room-entry-shell`. Existing game theme variables supply panel/background/edge colors; entry accent/button variables supply gold, cyan, amber or lavender controls.
- The seven existing `*CreatePage.tsx` files remain thin typed adapters for game settings, session callbacks and rules.
- Full rules use a native modal dialog and the existing rules components. Escape closes it. Back/help buttons keep accessible labels when their text is hidden on phones.

The shell retains existing connection-error/reconnect notices. Gameplay and session subscriptions remain separate.

## Existing functionality retained

| Game | Create/join base | Play base | Bots on create | Settings retained |
| --- | --- | --- | --- | --- |
| ป๊อกเด้ง | `/rooms` | `/play` | 0–9, default 0 | 2–10 players; 1,000 starting points |
| Poker | `/poker/rooms` | `/poker/play` | 0–5, default 1 | 2–6 players; blinds 10/20; 1,000 starting chips |
| Spyfall | `/spyfall/rooms` | `/spyfall/play` | None | Question 5/7/10 minutes; vote and spy answer 1/2/3 minutes |
| อีแก่กินน้ำ | `/oldmaid/rooms` | `/oldmaid/play` | 0–7, default 2 | 3–8 players |
| Who am I | `/whoami/rooms` | `/whoami/play` | None | Category; turn 1/2/3 minutes; question rounds 4/6/8/10; games 3/5/7/10 |
| ไพ่ตอแหล | `/liar/rooms` | `/liar/play` | 0–5, default 0 | Turn 15/30/60 seconds, default 30; 5-second challenge |
| Undercover | `/undercover/rooms` | `/undercover/play` | None | Turn/vote 1/2/3 minutes; Undercover 1–2; Mr. White 0–1 |

Append `/create` or `/join` to an entry base, and `/{code}` to a play base. Create passes settings into the existing session; joining uses the authoritative room settings.

Names remain limited to 20 characters and saved in `localStorage['pok.name']`. Room codes have a 10-character limit, uppercase on input and `?code=` prefill. Empty names/codes and non-idle sessions disable submission. Enter submits. The session layer still trims input, checks game identity and handles Colyseus connection/restore/reconnect.

An active-room notice offers return and leave actions. Return preserves the session; leave calls the correct singleton. Connection failures retain the dismissible error and allow another attempt.

## Responsive layout

| CSS viewport width | Composition |
| --- | --- |
| 1000px and wider | Two columns: illustration/form, then facts/guide. Shell capped at 1600px. |
| 601–999px | One column: illustration, form, facts, guide. Artwork aspect ratio 2.2. |
| 600px and narrower | One column with smaller spacing, icon-only back/help and artwork aspect ratio 1.7. |

Forms size to their contents. Short screens and expanded settings may scroll vertically; there is no fixed form-height or viewport-height lock. Controls must stay inside panels and reachable after scrolling without horizontal page overflow. Shared dropdowns retain portal positioning, keyboard support and game colors. Resizing does not remount the form.

## Asset reuse and cleanup

`MenuGameArtwork` reuses locally served WebP images from `apps/client/public/images/menu/pixel-scene-v1/`, already used by the game-selection cards. Each entry page loads one eager illustration, not duplicated hero images or rasterized mockup screens. Artwork uses cover sizing to fill its frame without empty side bars or stretching. Desktop frames use a 4:3 preferred ratio; tablet/phone use the banner ratios below. The image focal point favors the upper quarter, keeping card ranks and faces visible while edges crop responsively. Old Maid and Liar artwork remains free of casino chips.

The official logo is `images/brand/wong-sian-yinyang-04-v1.png`. Local Arcade/ArcadeThai font declarations are shared in `arcade-fonts.css`.

The old `DesktopEntryHero`, `club-entry-desktop.css`, obsolete entry-only rules and five unused runtime images were removed. The deleted images totaled 2,599,838 bytes. `images/entry/whoami-hero-v1.webp` remains for the Who am I play lobby; the Undercover role sprite and Spyfall SVG also remain gameplay dependencies.

See [the current asset inventory](desktop-entry-assets.md) and [game-selection artwork details](game-selection.md).

## Validation

With `npm run dev` running, execute `npm run test:room-entry`.

`tests/room-entry-browser.mjs` defaults to `http://127.0.0.1:5188` and checks 14 create/join paths at 24 viewports, including 320×480, the 999/1000px boundary, 1024×768, short landscape and 2560×1440. Checks cover panel/control containment, header overlap, actual button hit-testing, artwork, keyboard dropdowns, rules, mode navigation, query codes and saved names.

It creates and joins real rooms for all seven games and checks settings transmission, resume/leave and failed-join recovery. Session inspection imports the Vite module, so run against a development server. `GAME_URL` selects another development server, `ROOM_ENTRY_GAMES=pok,poker` limits game keys, and `BROWSER_CHANNEL` overrides the installed Edge channel. Screenshots go under `artifacts/previews/`.

Run `npm test` for unit/server coverage and `npm run build` for production output. Existing game-specific gameplay browser suites remain available.

Poker, Liar and Undercover use the shared theme-matched v2 artwork: navy felt, violet felt and charcoal/gold city respectively. These replace their original images in the shared artwork map, keeping one cached file per game. See [asset inventory and prompts](desktop-entry-assets.md#theme-matched-background-edits).
