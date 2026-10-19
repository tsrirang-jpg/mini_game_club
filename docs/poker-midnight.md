# Poker — Midnight Arena

The poker play page uses the approved navy/cyan/purple concept, with the approved Clean Row layout on desktop, SVG portraits/chips, ivory cards, a cyan local-player frame, and a mint winner badge. Entry pages and other games retain their own layouts.

## Files

- `apps/client/src/PokerPlayPage.tsx`: room/session wiring, legal action conditions, raise input, pot summaries, management/rules/results dialogs. All actions still use `pokerSession` and server-authoritative snapshots.
- `apps/client/src/components/poker/PokerSeat.tsx`: seat identity, chip balance, dealer/blind badges, connection/action status, private/revealed cards, results, winner treatment.
- `apps/client/src/components/poker/PokerArtwork.tsx`: local SVG portraits, decorative chip stacks, and navigation/action icons. No external avatar service or image downloads.
- `apps/client/src/poker-midnight.css`: ordered CSS entry point; `components/poker/midnight-{theme,table,actions,responsive}.css` separate the visual tokens/header, table/cards, betting/dialogs, and responsive/reduced-motion variants.
- `apps/client/src/components/poker/clean-row-desktop.css`: the desktop-only reference composition, imported last. Its breakpoint matches `useDesktopLayout`.
- `apps/client/src/components/poker/PokerTurnTimer.tsx`: one timer instance placed in the desktop console or original mobile phase row.
- `apps/client/src/hooks/usePokerRaiseInput.ts`: editable string, normalized leading zeros, and a derived numeric action value.
- `apps/client/src/poker.css`: entry-page and hand-ranking examples only.
- `apps/client/src/poker-pots.css`: pot-details dialog content only.

The seven superseded poker layout/size stylesheets and poker layout overrides in shared club styles have been removed to keep one owner for the table layout.

## Responsive behavior

- Desktop, width >= 1000px and height >= 651px: five opponents in one row, centered community board, local player at the left of a bottom console and betting controls on the right. This composition fills the desktop width. Smaller screens keep their existing layout.
- Tablet/portrait: three opponent columns, centered board, local hand below; one or two opponents get fewer columns.
- Landscape with height <= 650px, or tablets narrower than 1000px with height <= 740px: opponents share the top row; board and local hand sit side by side.
- Portrait below 1000px uses intrinsic content height: fill the screen when it fits and scroll vertically whenever more room is needed. Very short landscape (height <= 380px) also scrolls. Horizontal scrolling and clipped/overlapping table content remain errors.
- Respect safe-area insets, dynamic viewport height, keyboard focus, native dialog focus trapping/Escape, and reduced-motion preferences.
- Reserve action-dock height during active hands to avoid layout jumps between turns. High/Normal card sizing remains persisted in local storage, including scaled desktop windows.

## Data and behavior

The redesign does not change server rules or action payloads. Fold, Check, Call, Raise, All-in, ready/start/prepare, bot management, chip reset, voluntary winner reveal, room-code copying, reconnect, host transfer, and room closure continue through the existing session layer.

Opponent hole cards are never read from the local private hand. Only server-published round results reveal opponent cards. The WINNER badge uses actual non-refund pot winners; the result delta remains the player's actual net change. Clicking total POT or a side-pot entry opens the existing pot details.

## Local verification

Run `npm ci`, then `npm run dev` (client http://localhost:5188, game server port 2567).

- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run test:poker`
- `npm run test:poker-layout`
- `npm run test:poker-pots`
- `npm run test:poker-show`
- For `test:poker-high`, set `GAME_URL=http://127.0.0.1:5188` and `GAME_WS=ws://127.0.0.1:2567`.
- For `test:poker-lifecycle`, use the built production server with `GAME_URL=http://127.0.0.1:2569` (start it with `PORT=2569`, `NODE_ENV=production`).

Browser checks use the installed Microsoft Edge via Playwright. Previews are saved under `artifacts/previews/`.

Verified: production build/typecheck, 332 unit/network tests, real host/friend gameplay, 24-size lobby/raise/results layout matrix, 26-size live/settled pot matrix, voluntary reveal/privacy/reset, High/Normal at scaled desktop resolutions, reduced motion, and production reconnect/host-transfer/closure lifecycle.

## Clean Row desktop and Raise input

The local seat renders once: in the desktop console above the desktop breakpoint, in the original table below it. Phone/tablet placement is preserved for touch-only windows. Mouse-driven short desktop windows intentionally use Clean Row, including 952x442.

Raise editing retains native numeric min/max/step semantics. Clearing the field keeps an empty string; typing or pasting `040`/`00040` shows `40`. `valueAsNumber` and the amount passed to the existing session action are numeric `40`. Empty/out-of-range/non-integer values cannot submit. Presets and All-in still update the field.

Run `npm run test:poker-clean-row` against the dev server to verify clear/type/paste/ArrowUp, numeric 40 accepted by the real server, six-player desktop layouts, mobile hand placement, and a complete hand through River/showdown. Desktop previews: `artifacts/previews/clean-row-desktop-betting.png`, `clean-row-desktop-river.png`, `clean-row-desktop-showdown.png`.

### Short desktop windows

Poker uses `usePokerDesktopLayout`: the existing 1000 x 651 layout threshold, plus mouse-driven windows at least 900 CSS pixels wide regardless of height. This keeps Clean Row visible with Windows display scaling, browser zoom or docked DevTools. Short desktop windows use `midnight-compact.css` to fit the table and complete betting console inside the available viewport without scrolling (verified down to 900x400). Card and control sizes follow available height, while the larger desktop composition remains unchanged. Touch-only phone/tablet layouts and the shared desktop hook used by other games are unchanged. CSS follows the React desktop class, without a second height gate.

### One deal animation per round

`PokerHoleCards` is keyed by round ID and keeps its initial dealing animation after the DEALING-to-PREFLOP transition. Hands mounted after dealing (refresh or a responsive placement change) appear immediately. Both local and opponent hands use the same stagger and finish within the server's 1200ms dealing period. Community-card reveals keep their separate animation; reduced-motion preferences still disable motion.

`npm run test:poker-deal` counts actual browser animation events for twelve hole cards, checks two consecutive rounds, resize without replay, private-card visibility, desktop/short desktop/tablet/mobile/landscape layouts, and reduced motion.

### Centered opponent rows

Desktop and phone landscape rows center the occupied seats, reserving the same panel width as a full five-opponent row. Adding or removing a player leaves equal free space on either side without stretching the remaining panels. The viewport check verifies row centering for every player count, including the 1147x795 reference size. Actual five-player previews are saved as `poker-centered-1147x795-betting.png`, `poker-centered-1147x795-river.png`, `poker-centered-1147x795-showdown.png` and `poker-centered-desktop-river.png` under `artifacts/previews/`.

Desktop fit verification: `test:poker-clean-row` checks twelve desktop sizes without allowing scroll or clipping. Run `test:poker-pots` with `POKER_DESKTOP_TEST=1` to check live/settled side pots in eight desktop sizes, including 900x400, 952x442 and 1366x590. The default pots matrix continues to cover phone/tablet layouts.
