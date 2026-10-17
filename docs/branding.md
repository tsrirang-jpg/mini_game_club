# วงเซียน · Mini Game Club

The approved 03C mark is a gold circular game emblem with four curved sectors,
a central round opening, spade, controller D-pad, two dots and a question mark.
The Thai name sits to its right; the English descriptor sits below the name.

- `apps/client/public/images/brand/wong-sian-mark-v1.svg` is the transparent,
  scalable source shared by all headers and the browser favicon. Its cutouts
  expose each game's background. Versioned image URLs receive the existing
  immutable cache headers in production.
- `components/ui/BrandLogo.tsx` provides `BrandLogo` and `BrandMark`. The standard
  logo is used by the shared menu/create/join shell and the compact variant by
  every game's room header. There are no separate per-game logo implementations.
- `components/ui/brand-logo.css` owns logo typography and responsive sizes.
  Portrait phones show the code below the compact brand and the copy icon beside
  both rows, preserving the complete name and English descriptor. Short landscape
  headers use smaller marks without hiding the name or descriptor.
- The header home link remains on menu/create/join pages. Room branding is plain
  content, so it does not add a game-switch control during play.
- Card suits, card backs and game illustrations retain their game meanings.

Checks: `npm run build`, `npm run test:brand`, `npm run test:copy-room-code`,
`npm run test:club-ui`, `npm run test:desktop-ui`, `npm run test:pok-layout`,
`npm run test:poker-layout` and `npm run test:whoami`. Browser suites require
the dev server; brand/copy suites also support `GAME_URL` for compiled/live builds.
