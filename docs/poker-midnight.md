# Poker — Midnight Arena

The poker play page uses the approved navy/cyan/purple concept, with a six-seat ring on desktop, SVG portraits/chips, ivory cards, a cyan local-player frame, and a mint winner badge. Entry pages and other games retain their own layouts.

## Files

- `apps/client/src/PokerPlayPage.tsx`: room/session wiring, legal action conditions, raise input, pot summaries, management/rules/results dialogs. All actions still use `pokerSession` and server-authoritative snapshots.
- `apps/client/src/components/poker/PokerSeat.tsx`: seat identity, chip balance, dealer/blind badges, connection/action status, private/revealed cards, results, winner treatment.
- `apps/client/src/components/poker/PokerArtwork.tsx`: local SVG portraits, decorative chip stacks, and navigation/action icons. No external avatar service or image downloads.
- `apps/client/src/poker-midnight.css`: ordered CSS entry point; `components/poker/midnight-{theme,table,actions,responsive}.css` separate the visual tokens/header, table/cards, betting/dialogs, and responsive/reduced-motion variants.
- `apps/client/src/poker.css`: entry-page and hand-ranking examples only.
- `apps/client/src/poker-pots.css`: pot-details dialog content only.

The seven superseded poker layout/size stylesheets and poker layout overrides in shared club styles have been removed to keep one owner for the table layout.

## Responsive behavior

- Desktop, width >= 1000px and height >= 651px: five opponents around the table, centered board and local seat at the bottom. Content width caps at 1680px.
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
