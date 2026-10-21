# Road Fighter

Routes: /games (four category tabs), /road-fighter (setup), /road-fighter/play (race). Direct entry and refresh are supported by the production SPA fallback.

The interface follows artifacts/roadfighter-ui-concepts/black-red-responsive-v1: black/red/white chrome, colorful original Famicom-style canvas, speed/fuel needle gauges, no game title in the play header. The approved shared brand asset is retained. The /games catalogue now uses the approved emerald/gold Pixel Scene design; see game-selection.md. Existing games remain available under their categories.

## Code structure

- apps/client/src/roadfighter/engine.ts: framework-independent fixed-step simulation, countdown, driving, traffic, collisions, fuel, scoring and three stages. Injectable randomness makes collision and finish scenarios deterministic in tests.
- pixels.ts and RoadTrack.tsx: original pixel sprites, responsive logical canvas, nearest-neighbor rendering, ResizeObserver and one active animation loop. Setup previews are static. The catalogue uses local pixel-art WebP thumbnails.
- useRoadControls.ts: keyboard, simultaneous captured touch pointers, blur/visibility pause, listener cleanup.
- useRoadAudio.ts: optional local Web Audio synthesis; starts after a user gesture and releases audio resources on exit.
- Gauge.tsx: SVG speedometer and E/F fuel meter with accessible numeric values.
- RoadStartPage.tsx, RoadPlayPage.tsx and roadfighter.css: responsive setup and racing UI. road-play-layout.css contains the play-only grid constraints: desktop begins at 1000px (including 1024×768), the central track keeps its pixel proportions, and HUD/sidebar children have independent bounded grid rows. Short landscape windows explicitly reset the track row so portrait sizing cannot collapse the road.
- storage.ts: validated local preferences and best-score/distance records; unavailable storage does not prevent play. No backend room or login is required for this single-player game.
- GameSelectPage.tsx and game-selection.css: category filter tabs, keyboard navigation and URL-backed category persistence.

## Controls and rules

A/D or left/right arrows steer; W/up accelerates; S/down brakes; Space/P/Escape pause. Touch controls support steering and acceleration at the same time. Switching tabs or losing window focus pauses the race; resuming is explicit.

Three difficulty settings change maximum speed, traffic, fuel consumption and collision penalties. All three 4 km stages must be completed to finish. Fuel cans restore 30% and award 300 points; overtakes award 100; distance and stage completion also award points. Collisions consume fuel and give a brief recovery shield. Driving on the shoulder reduces speed and increases fuel consumption. Empty fuel ends the run. Game-over/finish saves the highest score and greatest distance on this device. Restart resets the run while retaining records and preferences.

## Validation

- npm test -- tests/roadfighter.test.ts: engine and storage tests, including all difficulties, input bounds, collisions, fuel, recovery, pause, stage transitions, finish and malformed storage.
- npm run test:roadfighter: 40 desktop/tablet/portrait/landscape sizes from 320x480 to 2560x1440; real keyboard and CDP multi-touch, menu filters and reload, pause/help/blur, restart, game-over/finish fixtures, record persistence, old-game navigation, no gameplay page scrolling or clipped controls.
- npm run build and the existing test suite remain required.

Pixel font: Press Start 2P, locally stored under public/fonts with its SIL Open Font License. No image-generation output is used as a gameplay background: the canvas is original executable artwork.

The setup grid row has a max-content minimum. Its form children do not shrink, so sound/start controls remain inside the panel on short or zoomed desktop viewports. Browser checks cover the controls inside the form and actual sound-switch hit testing, including 1274×590 (the equivalent CSS viewport of a 1911×885 window at 150% zoom).
