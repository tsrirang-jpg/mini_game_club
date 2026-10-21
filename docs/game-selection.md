# Pixel Scene game catalogue

The /games catalogue follows artifacts/game-selection-ui-concepts/two-column-unified-v1/03-pixel-scene.png with the original emerald/gold Wong Sian identity and minimal gold graffiti.

- All eight games share GameSelectCard: category, title, existing description, validated player count and one accessible start action. Each card navigates to the existing setup route.
- Desktop (1200px and wider): two equal columns, artwork left and details right. Tablet (601–1199px): two columns with artwork above details. Phone (600px and below): one column using the same stacked component. The catalogue scrolls vertically.
- GameSelectPage retains the four URL-backed category filters, arrow/Home/End navigation, sound preferences and settings dialog.
- MenuGameArtwork uses locally served WebP files under apps/client/public/images/menu/pixel-scene-v1. The artwork is decorative; the card button retains the game-specific accessible name. Native cards and artwork in the games themselves are unchanged.
- Old Maid and Liar thumbnail art intentionally contains no chips or coins. Their player counts come from game metadata, not labels in the concept image.
- Gold Strokes is a small code-native SVG decoration. Menu colors and layout are scoped to arcade-selection-shell, preserving Road Fighter setup/play colors.

The eight thumbnails were created with the built-in image_gen tool as one consistent 4×2 pixel-art atlas, then sliced and encoded as WebP. The source atlas and complete prompt are recorded in [generation.json](../artifacts/game-selection-ui-concepts/production-pixel-scene-v1/generation.json).

Validation: npm run test:brand checks all eight game links, loaded artwork, official gold brand and all existing create/join headers across eleven viewports. npm run test:roadfighter checks the catalogue at 29 viewports including both sides of the 600px and 1200px breakpoints, filtering and keyboard navigation, plus the actual racing lifecycle. npm run build includes the public artwork in production.

Game titles share the Press Start 2P (Arcade) display family. Thai titles use the locally hosted Syy UDT Regular pixel fallback (ArcadeThai, restricted to the Thai Unicode range), with matching cap-height sizing. Both fonts are distributed under SIL OFL 1.1; the unmodified Thai font, license and pinned source revision are stored under public/fonts.

Poker, Liar and Undercover share updated illustrations with room entry: navy-blue felt, deep-violet felt and a charcoal/gold city background. Built-in imagegen edited the existing scenes, preserving the foreground subjects. The three versioned WebP replacements and prompts are listed in [the asset inventory](desktop-entry-assets.md#theme-matched-background-edits).
