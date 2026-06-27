# src/ui/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Bundler-dependent UI surfaces built with Vite + Svelte **and** plain-ES-module UI helper modules
extracted from `src/main.js`. Contains: `ArchitectureOverlay.svelte` (Svelte component), the Vite
entry `main.js`, and a set of focused UI helper modules consumed by the plain-HTML runtime via
`src/main.js`.

## Ownership
Orchestrator Grove prototype maintainers.

## Local Contracts
- This subtree is the bundler-only surface for Svelte/Vite; do not import Svelte/Vite artifacts
  from the plain-HTML runtime path under `src/` (root runtime modules must stay bundler-free).
- Build via `npm run build:ui` (Vite). Config is `vite.config.js` at repo root.
- Keep `main.js` as the Vite entry; do not introduce alternative entry points without updating
  `vite.config.js`.
- UI helper modules (`dom-helpers.js`, `chat-ui.js`, `renderer-settings.js`, `performance-ui.js`,
  `provider-ui.js`, `fullscreen-ui.js`, `assistant-ui.js`) are **plain ES modules** imported by
  `src/main.js`. They do not require a bundler; they are consumed by the no-build HTML path.
- Each helper module exports a `create*` factory function that accepts `{ dom, game, ... }` and
  returns the extracted helpers. `src/main.js` calls these factories and wires the results.
- Use cache-busting query params on imports (e.g. `?v=t_ui_refactor_0627`).

## Work Guidance
- Svelte 5 conventions; component composition stays within this folder.
- Changes to Svelte components must rebuild before they are observable in the running app.
- Changes to plain JS helper modules are observable immediately via the no-build HTML path.

## Verification
- `npm run build:ui` must succeed (Vite production build).
- Architecture overlay behavior is covered by `tests/architecture-overlay-smoke.py`.
- All helper modules must pass `node --check`.
- `npm run test:semantic-router` must pass (assistant-ui.js imports semantic-router chain).
- `npm run test:steps` must pass (reads assistant-ui.js for step-chain table assertions).

## Child DOX Index
- None.
