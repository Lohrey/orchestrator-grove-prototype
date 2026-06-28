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

## Verification
- Render behavior is covered by smoke tests under `tests/` (e.g. render-viewport-culling,
  depth-sorting, fog-night-cycle smoke tests).
- `npm run test:pixi-fog-drift` → `node tests/pixi-fog-drift-unit.mjs` — unit test for the Pixi
  fog overlay positioning math (signature gating + per-frame sprite repositioning).

## Child DOX Index
- None.
