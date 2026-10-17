# วงเซียน · Mini Game Club

The approved 04 mark is a soft yin-yang emblem with a gold upper lobe containing
a spade and an ivory lower lobe containing a controller D-pad and one button.
The Thai name sits to its right; the English descriptor sits below the name.

- `apps/client/public/images/brand/wong-sian-yinyang-04-v1.png` is the approved
  artwork extracted with built-in imagegen, then resized to a transparent 192×192
  PNG (32,455 bytes) for the shared headers and browser favicon. The same bitmap
  is used at every breakpoint, avoiding an approximate SVG redraw. Its dark
  emerald internal symbols retain their contrast on every game theme.
- `assets/images.ts` declares the versioned logo path and dimensions alongside
  the four entry illustrations. Versioned image URLs receive the existing
  immutable cache headers in production. The obsolete 03C SVG is removed.
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
- An import-graph audit reaches all client TypeScript/CSS files from `main.tsx`
  (excluding the compiler's ambient `vite-env.d.ts`). Strict unused-local and
  unused-parameter checks pass. All four entry illustrations have live manifest
  references; they remain available. Superseded brand previews are removed from
  `artifacts/previews/`, while regression screenshots remain test artifacts.

## Artwork extraction prompt

Precise asset extraction / background removal. The supplied image is a board of FIVE numbered logos. Extract ONLY the emblem from row 04 (the fourth row, immediately above row 05), not the Thai text and not the number. Preserve that selected logo's original design exactly: soft flowing yin-yang made of a warm gold upper-left lobe and ivory lower-right lobe; dark emerald S-shaped negative channel; a dark emerald spade centered in the gold upper lobe; a dark emerald controller D-pad/plus and ONE circular button in the ivory lower lobe. This is the approved logo, so do not redesign, do not change proportions or symbols, do not change the orientation, do not add a dot elsewhere. Preserve the large spade, the rounded plus, the single round button to its right, the exact broad S-curve, and the slightly offset organic lobes and rounded silhouette shown in row 04. Remove all surrounding background, the number 04, ALL lettering including วงเซียน, and every other row. Output just this one emblem, centered on a square genuinely transparent canvas with narrow 5% transparent padding around the circular silhouette. The internal S-shaped channel and the spade, D-pad and dot should stay deep emerald #071F18 as in the reference (not become holes) for consistent readability on the site's different game-theme backgrounds. Keep outer background transparent. Clean smooth anti-aliased edges, production-ready PNG asset at high resolution. Do not add typography, borders, shadows, glow, framing, reference labels or ornament. No new layout or alternate mark.

Checks: `npm run build`, `npm run test:brand`, `npm run test:copy-room-code`,
`npm run test:club-ui`, `npm run test:desktop-ui`, `npm run test:pok-layout`,
`npm run test:poker-layout` and `npm run test:whoami`. Browser suites require
the dev server; brand/copy suites also support `GAME_URL` for compiled/live builds.
