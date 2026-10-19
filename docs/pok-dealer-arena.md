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

- Production build and typecheck pass; 332 unit/network tests pass.
- `npm run test:pok-layout`: 19 viewports, 2-6 players, every phase, three cards, long names, catch/recomparison, public Pok reveal, private hands, rules/settings and exit. Bounds, card ranks/suits and player overlap are checked.
- `npm run test:browser`: actual host/friend/bot gameplay, draw/stand, refresh, return/resume, bot add/remove and conserved points.
- `npm run test:pok-catch`, also with `DESKTOP_UI=1`: actual multi-client catch actions, refreshed private cards, timer reset and dealer draw/recomparison.
- `ONLY_GAME=pok npm run test:desktop-ui`: 8 desktop viewports up to 2560x1440.
- `ONLY_GAME=pok npm run test:copy-room-code`: 11 viewports, complete clipboard values, success/reset feedback and rejected clipboard behavior.
- `npm run test:poker-clean-row`: Poker regression check.

Actual rendered previews are in `artifacts/previews/pok-dealer-arena-{desktop,laptop,short-desktop,tablet,mobile,landscape}.png`. These are browser captures of the implementation, not imagegen mockups.

## Plain green background and seat layout

The play page uses the original plain green reference palette: a radial shell gradient from #174d37 to #071f18, with a rounded rectangular table surface from the shared Pok felt/background tokens and a thin green border. The same CSS background applies at every breakpoint. The generated Classic Emerald image remains a design artifact; the game no longer loads it. Decorative lanterns and the oval gold rail are omitted to match the selected background.

arena-seat-layout.css owns the Clean Panel composition at every breakpoint. Names and balances occupy the left column, cards the right, with a divider and full-width status/result footer. Both numeric and special hand values share that footer; settlement keeps the hand name, multiplier and outcome separate. Hand labels do not split inside a word. Container queries stack balance units inside narrow opponent stations so cards cannot cover them. Frames reserve card space before dealing and retain their dimensions across phases.

The layout test explicitly covers three-yellow-card hands during play and settlement at all 19 viewports, including 1920x1080, 1920x1200 and 2560x1440. It checks one-line Thai labels, no overlaps or overflow, card legibility and the selected background. Updated browser captures are named pok-clean-panel-* under artifacts/previews/.

## Clean Panel without player portraits

Approved reference: artifacts/pokdeng-player-frames/clean-no-avatar-v1/pokdeng-clean-panel-no-avatar.png. This is implemented as HTML/CSS, not as a screenshot background.

PokSeat retains the original private/public card selection, status, results, chip values and catch handlers. PokChip is a decorative inline SVG chip stack using role-dependent colors. Opponents have a muted green outline, the dealer a gold outline/chip stack, and the local player a mint outline. No avatar column or empty portrait placeholder remains.

arena-seats.css contains station positioning and shared card primitives. arena-seat-layout.css owns all panel content, sizing, typography, chip/role accents and responsive frame adaptations; obsolete avatar and score-column styles were removed. arena-responsive.css handles the surrounding game layout and controls.

The browser layout regression checks no portraits, a gold dealer outline, balance text never covered by cards, intact Thai special names, all card faces visible and no page overflow. Existing actual multiplayer smoke tests and desktop room tests still pass.
