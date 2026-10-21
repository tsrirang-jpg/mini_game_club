# Room-entry assets and current architecture

All seven multiplayer create/join pages now share `RoomEntryPage`, `RoomEntryHeader`, `RoomEntryForm`, `room-entry-config.ts` and one responsive stylesheet. See [shared room entry](room-entry.md) for routes, settings, breakpoints and validation.

## Runtime illustrations

`MenuGameArtwork` renders `apps/client/public/images/menu/pixel-scene-v1/`, reusing the existing game-selection pixel art for Pok Deng, Poker, Spyfall, Old Maid, Who am I, Liar and Undercover. Each entry page loads one eager image. Titles, forms and instructions remain HTML.

The official gold/cream brand image remains `apps/client/public/images/brand/wong-sian-yinyang-04-v1.png`. All widths share the artwork and retain each game's theme; no desktop-only hero is needed.

## Removed entry-only assets

These files no longer have runtime consumers and were removed with `DesktopEntryHero.tsx` and `club-entry-desktop.css`:

- `images/entry/poker-hero-v1.webp`
- `images/entry/spyfall-hero-v1.webp`
- `images/entry/oldmaid-hero-v1.webp`
- `images/entry/liar-hero-v2.png`
- `images/menu/undercover-trio-v2.png`

This removes 2,599,838 bytes of duplicate image data. Generated room-entry mockups/prompts remain under `artifacts/room-entry-ui-concepts/road-layout-v1/` as design references; they are not shipped as UI backgrounds.

## Gameplay assets retained

- `images/entry/whoami-hero-v1.webp` stays registered in `src/assets/images.ts`. `WhoAmIArtwork` uses it in the Who am I play lobby; create/join uses the shared pixel art.
- `images/undercover/role-reveal-v1.png` remains the shared role sprite.
- `SpyArtwork` remains in `GameArtwork.tsx` for Spyfall gameplay; unused entry-art branches were removed.
- Native playing cards and their graphics remain unchanged.

See [game-selection.md](game-selection.md) for catalogue artwork provenance. Check all consumers before replacing versioned assets; do not duplicate the same illustration for create and join.

## Theme-matched background edits

Poker uses `poker-navy-v2.webp`, Liar uses `liar-purple-gold-v3.webp`, and Undercover uses `undercover-charcoal-v2.webp`. Their backgrounds match the page themes; card faces, chip colors and character identities retain the original subjects. Menu and create/join share these versioned assets. Original superseded files are removed. The edited images are 1254×1254, encoded as WebP without resizing. Prompts and provenance: [generation.json](../artifacts/room-entry-ui-concepts/theme-backgrounds-v2/generation.json).

Liar card backs now use deep purple with warm gold patterns, retaining the violet felt and ivory A of clubs. The v3 image replaces v2 in the shared asset map. Built-in imagegen prompt and provenance: [generation.json](../artifacts/room-entry-ui-concepts/liar-purple-gold-v3/generation.json).
