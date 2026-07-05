# src/renderers/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Pluggable renderer backends for the game. `index.js` selects between `canvas2d-renderer.js`
(the default plain-canvas path) and `pixi-renderer.js` (the optional WebGL/PixiJS path backed by
`vendor/pixi`).

## Ownership
Orchestrator Grove prototype maintainers.

## Local Contracts
- The default renderer must keep working with no build step (canvas2d path).
- The Pixi renderer depends on `vendor/pixi/pixi.mjs`; do not edit the vendored file (see
  [../../vendor/AGENTS.md](../../vendor/AGENTS.md)). If a Pixi upgrade is needed, update the vendored
  asset deliberately and document it.
- Selecting the renderer must stay behind `index.js` so callers do not hard-import a backend.

## Work Guidance
- Prefer a single selection entry in `index.js`; both backends expose the same surface.
- Do not introduce bundler-only code into the canvas2d renderer.
- Pixi overlay sprites (fog, night/lighting) are parented inside `worldViewport` so the Pixi
  transform pipeline moves/scales them with the camera. Their local position must be set every
  frame from the current world-clipped view bounds (`fogView.left/top`), not only when a texture
  redraw signature changes — otherwise the sprite drifts relative to the world during pan/zoom.
  The signature gates only the expensive canvas redraw, not the cheap position update.
- **Entity occlusion transparency**: Trees and rocks (stone deposits) become semi-transparent
  (alpha .68 for items, .82 for other actors) when a player, bot, monster, item, structure, or
  projectile overlaps them. The occlusion-check helpers (`getTreeOpacity`, `getRockOpacity`) live
  in `shared/renderer-utils.js`. The canvas2d path computes a shared `occluders` object in
  `canvas-renderer.js` before pushing trees/rocks to depth sort. The Pixi path computes
  `pixiOccluders(renderState)` per-update in `pixi-renderer.js` and sets `container.alpha`.
  Semi-transparent trees and rocks still use the sprite-cache blit path via `ctx.globalAlpha`
  (see `drawRock`/`drawTree` in `world-layer.js`); the full vector draw is only a cache-miss
  fallback. Tree sprites are pre-rendered as **4 sway frames** per growth stage
  (`sprite-cache.js` `buildCache`); `drawTree` cycles them with a time-based `frameIndex` and
  per-tree `t.id` offset so trees don't sway in sync.
- **Monster caching**: monsters are pre-rendered as **4 wobble frames** per type (default,
  night_monster) in `sprite-cache.js`. `drawMonster` (`entities-layer.js`) blits the cached
  frame via `drawImage`, cycling frames with a time-based index and per-monster `m.id` offset.
  Vector drawing is only a cache-miss fallback or hover path.
- **Structure caching**: each building type (sawbench, workbench, factory, etc.) is pre-rendered
  to a single static `ImageBitmap` in `sprite-cache.js`. `drawStructure` (`world-layer.js`) blits
  the cached sprite via `drawImage` when not hovered; hovered structures use the vector path
  (`drawBuildingAsset`) to show highlight outlines. Tiny Swords atlas path for defense towers
  remains unchanged.
- **Bot walk-cycle**: bots have **4 walk-cycle frames** per color (5 colors = 20 frames) in
  addition to the static idle frame. `drawBot` (`entities-layer.js`) uses walk-cycle frames when
  the bot is moving (`b.target || b.vx || b.vy`) and the static frame when idle. Walk animation
  runs at 140ms per step (~7fps), desynced by `b.id * 0.7`. Dog bots keep their existing static
  path.
- **Item caching**: every loose ground item type (logs, stones, tools, seeds, story objects, and
  building-kit items) is pre-rendered to a single static `ImageBitmap` in `sprite-cache.js`.
  `drawItem` (`world-layer.js`) blits the cached sprite via `drawImage` when available; the vector
  path (`drawItemAsset`) is only a cache-miss fallback (before init completes). Shadow and hover
  overlay are still drawn live (cheap). Keys: `item_<type>` / `item_<type>_meta` (32×32 canvas,
  cx=cy=16). Building-kit types route through `drawItemAsset` → `drawBuildingKitItem` internally.
- **Power-of-2 sprite grid**: All sprite cache canvases use power-of-2 dimensions
  following a Moonlighter-style pixel-art grid:
  - Items/Tools/Seeds: 32×32
  - Bots/Player/Dog/Monsters/Trees/Rocks: 64×64
  - Structures: 256×256 (bumped from the nominal 128 to 256 because camper_van
    has w=132 > 128; all other structures fit in 128)
  This ensures WebGL texture efficiency (no padding waste), uniform UV mapping
  for atlas packing, and integer-scaling compatibility for the native-resolution
  render pipeline (planned: 640×360 backing store, integer-scaled to viewport).
  Phase 1 (sprite cache + `image-rendering: pixelated` in `styles.css`) is done;
  Phase 2 (native backing-store resolution + camera zoom recalibration) is future work.

## Verification
- Render behavior is covered by smoke tests under `tests/` (e.g. render-viewport-culling,
  depth-sorting, fog-night-cycle smoke tests).
- `npm run test:pixi-fog-drift` → `node tests/pixi-fog-drift-unit.mjs` — unit test for the Pixi
  fog overlay positioning math (signature gating + per-frame sprite repositioning).

## Child DOX Index
- None.
