# src/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Game runtime ES modules loaded by `index.html` (via `src/main.js`). This is the core simulation,
world model, assistant chat, rendering entry points, and the action-step registry that the
repo-wide Action Step Mechanism Chain depends on.

Key files (not exhaustive): `main.js`, `world.js`, `action-steps.js`, `data.js`, `assistant.js`,
`chat.js`, `audio.js`, `browser-runtime.js`, `canvas-renderer.js`, `campaign-scenes.js`,
`campaign-intro-cinematic.js`, `depth-sort.js`, `fog-of-war.js`, `render-state.js`,
`savegames.js`, `multiplayer.js`, `utils.js`, `visual-assets.js`.
Systems live under `src/systems/` as mixins installed via `install*System(Game, deps)` at the
bottom of `world.js`. Notable system mixins: `player-system.js`, `monster-system.js`,
`combat/combat-system.js`, `health-system.js` (player damage/death/respawn/regen),
`interaction-system.js`, `spawn-system.js`, `structure-system.js`, `bot-system.js`.

## Ownership
Orchestrator Grove prototype maintainers. The backend working code in `world.js` is the ultimate
source of truth for what action steps are actually possible.

## Local Contracts
- The **Action Step Mechanism Chain** (see root [../AGENTS.md](../AGENTS.md)) is fully binding
  here. `src/action-steps.js` is the canonical registry; `src/world.js` is the backend execution
  truth; `Game.validateDslProgram` is DSL validation; `src/data.js` holds program templates.
- Adding/changing/deleting an action step requires updating the whole chain in the same change
  (world.js execution, validateDslProgram, action-steps.js registry, data.js templates, assistant
  knowledge packs, teach-by-doing behavior, UI representations, and a test).
- Do not weaken the action-step chain. If a step is intentionally unavailable in one layer, record
  it as explicit registry metadata and add/update a test so the gap is visible.

## Work Guidance
- ES modules; the entry point is `src/main.js`, imported by `index.html`/`game.js`.
- Keep the plain-HTML run path working without a bundler for these modules.
- Bundler/TypeScript/Svelte-only surfaces live under `src/ui/` and the worker under `src/sim/`.
- Campaign intro is rendered by the **canvas cinematic** module
  (`campaign-intro-cinematic.js`) **only when using the Pixi renderer**.
  `showCampaignIntro()` in `main.js` checks `rendererMode === 'pixi'` before
  starting the cinematic. For Canvas2D / OffscreenCanvas renderers, the HTML
  overlay (`#campaignIntroOverlay` in `index.html`, driven by
  `renderCampaignIntroScene()`) is used instead because the cinematic's
  main-thread `getContext('2d')` conflicts with renderer canvas ownership.
  The cinematic's `onComplete`/`onSkip` callbacks chain to
  `finishCampaignIntro()` → `closeCampaignIntro()` → `beginCampaignArrival()` →
  `updateCampaignArrivalState()` → `setPaused(false)` (unpause). The
  `renderCampaignIntroScene()` text-card path is the Canvas2D fallback.

## Verification
- `npm run test:steps` → `node tests/action-step-chain-integrity.mjs` (binding for the chain).
- `python3 tests/player-health-mechanic-smoke.py` — verifies player damage, death, respawn, and passive regen.
- Various Python smoke tests under `tests/` exercise runtime behavior.

## Child DOX Index
- [renderers/AGENTS.md](renderers/AGENTS.md) — pluggable renderers (canvas2d, pixi)
- [sim/AGENTS.md](sim/AGENTS.md) — simulation worker layer
- [ui/AGENTS.md](ui/AGENTS.md) — Svelte architecture overlay
