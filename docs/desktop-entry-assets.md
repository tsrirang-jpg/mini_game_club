# Desktop entry illustrations — 17 October 2026

Generated with the built-in `image_gen` tool from the approved Poker, Spyfall and Old Maid desktop mockups. Pok Deng was excluded. The final transparent WebP assets are:

- `apps/client/public/images/entry/poker-hero-v1.webp` (1535×658)
- `apps/client/public/images/entry/spyfall-hero-v1.webp` (1527×680)
- `apps/client/public/images/entry/oldmaid-hero-v1.webp` (1459×681)

These decorative images load only in the desktop entry composition, not on phone layouts or game boards. Browser canvas exports retain transparency, remove empty alpha margins and encode WebP. Source PNGs remain in the image-generation library.

## Shared generation prompt

Use case: compositing. Asset type: production website hero illustration, transparent PNG, landscape 1536x1024. The supplied image is a visual reference of the approved website. Create ONLY the standalone game objects seen below the left-hand headline, recreating their style and material quality. Remove all website UI, words, logos, backdrop and form. Do not render a website screenshot. Transparent alpha background, genuinely clear pixels around the entire object cluster; no solid rectangle, no ground plane, no vignette. Subtle soft contact shadows only directly beneath the objects, all edges unclipped. Premium softly realistic 3D game illustration matching the reference, crisp ivory surfaces and rich game colors. Center the cluster, with 5% clear margin on left/right and 12% clear margin top/bottom. Wide balanced composition, width-to-height approximately 1.8:1. Do not introduce captions, UI, watermarks or props other than those requested.

## Poker prompt addition

Poker illustration: five fanned ivory playing cards A♠ K♠ Q♠ J♠ 10♠ on the left, royal flush clearly readable. Rank and suit appear in separate positions with no collision, correct black spades. Three stacks and a few laid-down premium blue-and-ivory poker chips on the right, one upright chip engraved with a spade symbol. Blue rim lighting and gentle navy shadows. Preserve the arrangement and visual appeal of the card fan and chips in the lower left of the reference.

## Spyfall prompt addition

Spyfall illustration: textured midnight-blue fedora hat to the left, stylish black sunglasses in front, folded blue city map extends behind toward the right, a metal magnifying glass rests diagonally on the map, a small blue identification card with a simple silhouette of a spy in a fedora in the foreground. No words or numbers on the map or card. Elegant light blue edge lighting, cinematic mystery but friendly casual game aesthetic. Match the lower-left illustration from the supplied approved design.

## Old Maid prompt addition

Old Maid illustration: premium tilted ivory cards in a staggered fan, a matched pair 7♥ and 7♠ toward the left, one K♣ face card raised slightly in front center, two patterned purple and lavender card backs fanned behind toward the right. Clear nonoverlapping card rank and suit labels. Tasteful classic king court illustration. Lavender edge highlights, soft dimensional depth, no gold outer frame or gold ground. Match the lower-left card cluster from the supplied approved design.

## Who am I production illustration — 17 October 2026

- `apps/client/public/images/entry/whoami-hero-v1.webp` (1680×936, alpha, approximately 142 kB).
- Generated with the built-in `image_gen` tool using the approved Who am I mockup as a style reference; encoded to WebP at quality .88 with dimensions/alpha preserved. Referenced through `src/assets/images.ts`, used on the game menu and Who am I entry/lobby only.
- Source PNG stays in the image-generation library. No existing game's artwork was replaced.

Final generation prompt:

> Use case: compositing. Create ONLY the standalone fanned identity-card illustration from the supplied Who am I website reference, as a production website hero asset. Reference is style/composition only; remove ALL website, typography, background and forms. Transparent background with real alpha. Five softly dimensional ivory identity/name cards in a gently fanned horizontal cluster, rounded corners, warm amber edges and restrained contact shadows. The front central card is largest: a dark brown anonymous head-and-shoulders silhouette and a large crisp amber question mark. Two cards each side behind it display friendly stylized avatar portraits, e.g. woman, man, pilot and chef. Premium cheerful family party-game look, soft realistic 3D paper/material shading matching the reference. No words, no card ranks, no suits, no watermark, no casino chips, no solid backdrop or floor. Center composition with margin on every side and no clipped corners. Wide standalone object cluster, roughly 1.8:1 aspect, high detail, suitable on a dark espresso-brown UI. Preserve transparent negative space outside the objects.
