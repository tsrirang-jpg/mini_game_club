# Pok Deng Dealer Arena

The Pok play page uses the approved green/gold Dealer Arena composition. Desktop places a featured opponent (the dealer when it is another player) at the top, up to four opponents around the sides, and the local player at the bottom center. If the local player is the dealer, the local seat receives the gold dealer treatment; a normal opponent occupies the top station. A player is never rendered twice.

## Structure

- `apps/client/src/PlayPage.tsx`: existing session actions, room controls, timer, betting, dealer selection and catch dialogs.
- `apps/client/src/components/pok/PokSeat.tsx`: private/public card selection, player balance, dealer/own markers, hand evaluation and catch results.
- `PokTurnStage.tsx`: phase-derived arena medallion and three-step progress.
- `PokArenaArtwork.tsx`: inline icons and decorative lanterns.
- `apps/client/src/pok-dealer-arena.css`: ordered theme, seat, action, responsive and seat-layout modules. Selectors are scoped to the Pok play page.

The original brand artwork, room/session API and game rules remain in use. Draw, stand, catch, betting, ready/start/prepare, bot management, dealer selection, clipboard and reconnection are still connected to the original handlers.

Portrait uses a compact grid; short landscape preserves the arena arrangement while reducing decorative portraits and progress artwork. All actionable controls and result text remain available. Cards reserve space before dealing and size to the available player frame. Reduced-motion preferences are respected.

## Archived portrait concept

`apps/client/public/images/pok/arena-avatars.png` is a 3-column by 2-row sprite atlas generated with the built-in imagegen tool for this implementation. It is retained as a design artifact; the Clean Panel implementation renders no player portraits. The approved generated UI reference was used only for art direction. Full prompt and source reference: `artifacts/pokdeng-ui-concepts/dealer-arena-green-v1/avatar-prompt.json`.

## Validation

- Production build and typecheck pass; 350 unit/network tests pass.
- `npm run test:pok-layout`: 20 viewports, 2-6 players, every phase, three cards, long names, catch/recomparison, public Pok reveal, private hands, rules/settings and exit. Bounds, card ranks/suits and player overlap are checked.
- `npm run test:browser`: actual host/friend/bot gameplay, draw/stand, refresh, return/resume, bot add/remove and conserved points.
- `npm run test:pok-catch`, also with `DESKTOP_UI=1`: actual multi-client catch actions, refreshed private cards, timer reset and dealer draw/recomparison.
- `ONLY_GAME=pok npm run test:desktop-ui`: 8 desktop viewports up to 2560x1440.
- `ONLY_GAME=pok npm run test:copy-room-code`: 11 viewports, complete clipboard values, success/reset feedback and rejected clipboard behavior.
- `npm run test:poker-clean-row`: Poker regression check.

Actual rendered previews are in `artifacts/previews/pok-dealer-arena-{desktop,laptop,short-desktop,tablet,mobile,landscape}.png`. These are browser captures of the implementation, not imagegen mockups.

## Plain green background and seat layout

The play page uses the original plain green reference palette: a radial shell gradient from #174d37 to #071f18, with a rounded rectangular table surface from the shared Pok felt/background tokens and a thin green border. The same CSS background applies at every breakpoint. The generated Classic Emerald image remains a design artifact; the game no longer loads it. Decorative lanterns and the oval gold rail are omitted to match the selected background.

arena-seat-layout.css owns the Clean Panel composition at every breakpoint. Names and balances occupy the left column, cards the right, with a divider and full-width status/result footer. Both numeric and special hand values share that footer; settlement keeps the hand name, multiplier and outcome separate. Hand labels do not split inside a word. Container queries stack balance units inside narrow opponent stations so cards cannot cover them. Frames reserve card space before dealing and retain their dimensions across phases.

The layout test explicitly covers three-yellow-card hands during play and settlement at all 20 viewports, including 1920x1080, 1920x1200 and 2560x1440. It checks one-line Thai labels, no overlaps or overflow, card legibility and the selected background. Updated browser captures are named pok-clean-panel-* under artifacts/previews/.

## Clean Panel without player portraits

Approved reference: artifacts/pokdeng-player-frames/clean-no-avatar-v1/pokdeng-clean-panel-no-avatar.png. This is implemented as HTML/CSS, not as a screenshot background.

PokSeat retains the original private/public card selection, status, results, chip values and catch handlers. PokChip is a decorative inline SVG chip stack using role-dependent colors. Opponents have a muted green outline, the dealer a gold outline/chip stack, and the local player a mint outline. No avatar column or empty portrait placeholder remains.

arena-seats.css contains station positioning and shared card primitives. arena-seat-layout.css owns all panel content, sizing, typography, chip/role accents and responsive frame adaptations; obsolete avatar and score-column styles were removed. arena-responsive.css handles the surrounding game layout and controls.

The browser layout regression checks no portraits, a gold dealer outline, balance text never covered by cards, intact Thai special names, all card faces visible and no page overflow. Existing actual multiplayer smoke tests and desktop room tests still pass.

## Fixed-height dealer action dock

The dealer-action reference is artifacts/pokdeng-ui-concepts/compact-dealer-v1/compact-dealer-mobile.png. arena-dealer-dock.css owns the compact timer-left, actions-right composition. The top row selects a three-card player and catches with two cards; the bottom row draws or stands. The role summary and extra caption are absent from this dock. No game/session handler or timing rule changes.

All phases use the same --dock-height at each breakpoint; the former has-catch height overrides were removed. Container-relative font/icon sizing keeps both rows within short landscape windows. Dropdown selection uses the original accessible portal menu.

The layout suite checks equal dock, table and player-frame sizes between round-end and dealer-action snapshots at all 20 viewports, including 420x750. It also checks row ordering and that controls fill the right column. Actual browser screenshots are artifacts/previews/pok-compact-dealer-WIDTHxHEIGHT.png.

## Final-hand catch settlement

Catch results during DEALER_ACTION are provisional. A final catch always restarts the dealer decision timer; catching all five opponents does not reveal or settle the round. Draw, stand or the deadline ends the dealer turn.

When the dealer draws, makeLedger recalculates every caught result from the final three cards for every score and special-hand rank, including the final winning multiplier. catchRecompared is set and dealerCards/dealerValue describe that final hand. Standing or timing out uses the final two cards. Settlement remains a single conserved ledger, never a separate payment at catch time.

tests/pok-final-catch.test.ts covers all scores 0-9, final multipliers/specials, six players with five catches, draw/stand/timeout, reconnect and duplicate actions. The network suite also exercises six real WebSocket clients: all catch results remain provisional after the fifth catch, and the dealer can reconnect, draw to seven, and broadcast the corrected payout to all clients. The layout suite verifies draw/stand remain visible after five catches at all 20 viewports.

## Ten-player tables

Pok Deng supports 2–10 players. Room creation offers 0–9 bots, with the creator counting as the remaining seat; the option label shows the total player count. Both seat allocation and transport capacity include bots, and removing a bot reopens a human slot. Bots have nine distinct names.

Tables with 7–10 players use arena-large-table.css: a five-column opponent grid on wide screens and three columns on portrait phones, with the local player below the roster. Frame geometry remains stable between dealing and results. The ready counter fits 10/10 inside its column.

Validation: pok-capacity.test.ts deals all 30 unique cards, catches every opponent and settles once for each table size 2–10. network.test.ts covers ten human clients, a creator plus nine bots, full-room rejection and replacing a bot with a human. pok-layout-browser.mjs covers 7–10 players across 20 viewports in lobby, dealing, player/dealer actions and results.
