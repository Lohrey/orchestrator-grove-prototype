# src/systems/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Game-logic systems following the **install-mixin pattern**: each system is a plain
function `install*System(Game, deps)` that adds methods and state to the `Game` class
prototype at load time. Systems are **composable mixins, not classes** — they are
called at the bottom of `src/world.js` to compose the game's runtime behavior.

All systems receive the `Game` class and a `deps` object (world data, helpers,
shared utilities). They attach methods directly to `Game.prototype` and read/write
instance state via `this`.

## Ownership
Orchestrator Grove prototype maintainers. The action-step chain in
[../AGENTS.md](../AGENTS.md) is binding for systems that execute action steps.

## Install Signature Convention
- Every system exports an `install*System(Game, deps)` function.
- `Game` — the class to extend (mixin target).
- `deps` — dependency object with shared helpers (data, utils, renderer hooks, etc.).
- Systems attach methods to `Game.prototype` and may add per-instance state in an
  init method called from `world.js`.

## Root-Level System Files
- `bot-system.js` — bot creation, teams, display names, bot menu methods, bot drawer rendering.
- `camera-system.js` — camera viewport, zoom, coordinate transforms, Canvas2D integer scaling,
  and WebGL2 fullscreen presentation sizing.
- `dialogue-system.js` — speech-bubble dialogue system (DOM overlay with typewriter reveal).
- `health-system.js` — player health: damage, death, respawn, passive regen.
- `interaction-system.js` — canvas event binding, tap/context handling, hover detection, context menus.
- `monster-system.js` — monster spawning, damage, night spawns, monster behavior helpers.
- `player-system.js` — player target queue, movement, resource actions, deploy/demolish actions.
- `spawn-system.js` — entity spawning: trees, items, hemp, monsters, stone deposits, holes, seeds.
- `structure-system.js` — structure placement, demolition, building kits, zone management and queries.
- `teach-system.js` — teach-by-doing recorder, DSL step helpers, step text rendering, recorded loop management.
- `dog-system.js` — dog companion: spawn, fetch behavior, dog-popups, interaction.
- `save-system.js` — game save/load serialization and deserialization.
- `menu-system.js` — in-game menus: bot drawer, structure menu, tree/hole menus, zone management UI.
- `multiplayer-system.js` — local AI match, multiplayer sessions, throne damage, wave spawning.
- `dsl-program-system.js` — DSL program validation, normalization, bot program assignment and step resolution.

## Subdirectories
- `combat/` — combat system and config (melee, bow, defense tower, monster attacks).
- `code-loop/` — isolated Code Loop WebWorker sandbox for player/AI bot scripts (has its own AGENTS.md).
- `dsl/` — taught-loop system: validated DSL program execution for recorded bot loops.
- `inventory/` — inventory system: item storage, transfer, and capacity management.
- `production/` — production system: crafting recipes, assembler, smithery, workbench, tool production.

## Local Contracts
- Systems are mixins installed at the bottom of `src/world.js`. Do not convert them
  to classes — the composition root depends on prototype extension.
- Any system that adds or changes an action step MUST update the full Action Step
  Mechanism Chain (see [../AGENTS.md](../AGENTS.md)) in the same change.
- Systems must not hard-import renderer backends; use the deps object or the shared
  render-state for any render-dependent logic.

## Work Guidance
- To add a new system: create `src/systems/<name>-system.js`, export
  `install<Name>System(Game, deps)`, and call it at the bottom of `world.js`.
- Keep systems self-contained: cross-system calls go through `Game.prototype`
  methods, not direct imports of other system internals.
- The combat config (`combat/combat-config.js`) holds tunable combat constants
  (ranges, damage, modes) — prefer editing config over hardcoding values.

## Verification
- `node --check src/systems/<file>.js` for syntax validation.
- `npm run test:steps` → `node tests/action-step-chain-integrity.mjs` (binding for
  systems that touch the action-step chain).
- Smoke tests under `tests/` exercise runtime behavior of each system.

## Child DOX Index
- [code-loop/AGENTS.md](code-loop/AGENTS.md) — isolated Code Loop WebWorker sandbox for player/AI bot scripts
