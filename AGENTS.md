# Orchestrator Grove Prototype — DOX framework

- DOX is the binding AGENTS.md hierarchy installed here.
- Agent must follow DOX instructions across any edit.
- This root doc is the project-wide contract; child `AGENTS.md` files add local contracts per folder.

> Stack: plain HTML/CSS/Canvas JS game (`game.js`, `index.html`), ES modules under `src/`,
> Vite + Svelte architecture overlay under `src/ui/`, a Rust WASM sim core under `wasm/sim-core/`,
> a Node `server.mjs` host, and Python/Node smoke tests under `tests/`. Published to
> API Hub public prototypes/orchestrator-grove.

## Core Contract
- AGENTS.md files are binding work contracts for their subtrees.
- Work products, source materials, instructions, records, assets, and durable docs must stay
  understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it.
- The closer a doc is to the work, the more specific and practical it must be; no child doc may
  weaken DOX.

## Read Before Editing
1. Read the root AGENTS.md.
2. Identify every file or folder you expect to touch.
3. Walk from the repository root to each target path.
4. Read every AGENTS.md found along each route.
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there.
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules.
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX.

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing
Every meaningful change requires a DOX pass before the task is done.
Update the closest owning AGENTS.md when a change affects:
- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure/ownership/workflow/child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately.

## Hierarchy
- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, top-level Child DOX Index.
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index.
- Each parent explains what its direct children cover and what stays owned by the parent.
- The closer a doc is to the work, the more specific and practical it must be.

## Child Doc Shape
- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards.
- Work Guidance must reflect current standards; if none yet, leave empty.
- Verification must reflect an existing check; if none yet, leave empty and update when one exists.

## Style
- Keep docs concise, current, operational.
- Document stable contracts, not diary entries.
- Broad rules in parent docs, concrete details in child docs.
- Prefer direct bullets with explicit names.
- Delete stale notes instead of explaining history.

## Closeout
1. Re-check changed paths against the DOX chain.
2. Update nearest owning docs and any affected parents or children.
3. Refresh every affected Child DOX Index.
4. Remove stale or contradictory text.
5. Run existing verification when relevant.
6. Report any docs intentionally left unchanged and why.

## Local Contracts

These contracts are binding for the whole repository. Child docs may add more specific rules but
cannot weaken any of them.

### Action Step Mechanism Chain

The action-step system must stay synchronized across the full mechanism chain. An action step is any operation that a player can perform, a bot can execute, the teach-by-doing recorder can record, or the local LLM DSL can generate.

The backend working code is the ultimate source of truth for what is actually possible. The registry in `src/action-steps.js` is the project-level index of that truth and must describe every supported action-step representation.

When adding, changing, or deleting a step, update the whole chain in the same change:

- Backend execution code in `src/world.js`.
- DSL validation and normalization in `Game.validateDslProgram`.
- The canonical registry in `src/action-steps.js`.
- Program templates in `src/data.js` when a built-in workflow uses the step.
- Assistant knowledge-pack exposure and prompt signatures derived from the registry.
- Teach-by-doing recording and replay behavior when the player can perform or teach the step.
- UI card/editor fields and the Settings step-chain table representation.
- Tests that prove the chain is intact.

Do not add a new action by only updating one representation. Do not remove or rename a step without removing or renaming all linked representations. If a step is intentionally not available in one layer yet, record that as explicit registry metadata and add or update a test so the gap is visible rather than accidental.

### Repo-wide rules
- Do not edit vendored libraries under `vendor/` (e.g. `vendor/pixi/pixi.mjs`); treat them as read-only.
- Do not edit build output: `node_modules/`, `wasm/sim-core/target/`, `tests/__pycache__/`, or the built `src/sim/wasm/sim_core.wasm` and bundled `src/sim/sim-worker.js`. Regenerate via the documented build commands instead.
- Smoke tests under `tests/` are the primary verification surface; prefer adding/running a smoke test over unverified edits.
- Keep the game runnable with no build step for the core canvas path (`python3 -m http.server 8000` then open `http://localhost:8000`).

## User Preferences
- Communicate changes against this prototype concisely; reference concrete file paths.
- When touching action steps, surface the full chain impact (see Local Contracts) before editing.
- Prefer edits that keep the plain-HTML entry point (`index.html` + `game.js` + `src/`) working without a bundler; bundler-dependent features live under `src/ui/` and `wasm/`.

## Child DOX Index
- [docs/AGENTS.md](docs/AGENTS.md) — project documentation (guides, prompts)
- [src/AGENTS.md](src/AGENTS.md) — game runtime ES modules
  - [src/renderers/AGENTS.md](src/renderers/AGENTS.md) — pluggable renderers (canvas2d, pixi)
  - [src/sim/AGENTS.md](src/sim/AGENTS.md) — simulation worker layer
  - [src/ui/AGENTS.md](src/ui/AGENTS.md) — Svelte architecture overlay
- [tests/AGENTS.md](tests/AGENTS.md) — smoke and integrity tests
- [ui-overlays/AGENTS.md](ui-overlays/AGENTS.md) — standalone UI overlay assets
- [vendor/AGENTS.md](vendor/AGENTS.md) — vendored third-party libraries (pixi)
- [wasm/sim-core/AGENTS.md](wasm/sim-core/AGENTS.md) — Rust WASM simulation core
