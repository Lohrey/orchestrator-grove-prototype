# ui-overlays/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Generated, standalone Svelte UI overlay assets shipped separately from the in-game canvas UI: the `orchestrator-grove-prototype.css` stylesheet and `ui-overlays.js` script.

## Ownership
Orchestrator Grove prototype maintainers.

## Local Contracts
- Runtime assets are generated from `src/ui/` by `npm run build:ui`; do not hand-edit generated CSS or JS.
- `vite.config.js` must keep `emptyOutDir: false` so a UI build preserves this binding `AGENTS.md` contract.
- Keep overlay CSS scoped to overlay selectors; do not let it leak global rules into the game canvas stylesheets (`styles.css`, `styles-interactions.css` at repo root).

## Work Guidance
- Edit sources under `src/ui/`, then rebuild with `npm run build:ui`.

## Verification
- `npm run build:ui` must preserve this file.
- `python3 tests/architecture-overlay-smoke.py` verifies the built overlay against the served game.

## Child DOX Index
- None.
