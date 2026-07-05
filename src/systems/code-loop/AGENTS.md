# src/systems/code-loop/ — DOX local contract

- Parent: [../../AGENTS.md](../../AGENTS.md), [../AGENTS.md](../AGENTS.md)

## Purpose
Isolated "Code Loop" execution layer: lets players or AI write JavaScript-like
bot scripts that run inside a WebWorker sandbox with a whitelisted `bot` API.
Every `bot.*` call posts an intention to the main thread, which validates it
through the existing `Game.validateDslProgram` chain and executes it through
the taught-loop machinery. The main thread stays authoritative; bot code never
touches the world directly.

Files:
- `code-loop-worker-source.js` — source text for the WebWorker (spawned via
  Blob URL so the plain-HTML path keeps working without a bundler). Exposes
  the whitelisted `bot` API (`pickUp`, `deposit`, `moveTo`, `wait`,
  `findNearest`, `say`) and posts intentions/errors back to the main thread.
- `code-loop-system.js` — `installCodeLoopSystem(Game)` mixin. Spawns workers,
  resolves structures, validates intentions via `validateDslProgram`, drives
  per-frame step execution via `advanceCodeLoopSessions(dt)`, restores bot
  state on completion/error/stop.

## Ownership
Orchestrator Grove prototype maintainers. The action-step chain in
[../../AGENTS.md](../../AGENTS.md) is binding: intentions map to existing
taught-loop step ops (`pick_up`, `deposit_to_structure`, `move_to_structure`,
`wait`, plus the read-only `findNearest` query). No new action step is added.

## Local Contracts
- The Code Loop MUST NOT bypass `Game.validateDslProgram`. Every mutating
  intention is synthesized into a one-step taught-loop program and validated
  before execution.
- The Code Loop MUST NOT run bot code on the main thread. The WebWorker
  isolate is mandatory; `worker.terminate()` is the Stop path.
- The DSL Safe Mode tab and `validateDslProgram` logic MUST remain unchanged.
- Bot code MUST only see the whitelisted `bot` API. No direct access to
  `world`, `game`, `canvas`, DOM, or globals that matter.
- Errors in bot code MUST be caught per-intention and reported to the UI; they
  MUST NOT crash the game. The bot is paused, not destroyed.

## Work Guidance
- Install hook: `installCodeLoopSystem(Game)` is called at the bottom of
  `world.js` after `installTaughtLoopSystem`.
- Per-frame driver: `Game.advanceCodeLoopSessions(dt)` is called from the
  main update loop after `updateBot()` for each bot.
- Intention → step mapping is in `fulfillCodeLoopIntention()`. To add a new
  `bot.*` method: extend the whitelist worker API, add a case here that
  synthesizes a validated step, and document it in the UI reference.
- Structure resolution (`resolveCodeLoopStructure`) accepts names like
  `"sawbench"`, `"sawbench 2"`, or exact building names.

## Verification
- `node --check src/systems/code-loop/code-loop-system.js`
- `node --check src/systems/code-loop/code-loop-worker-source.js`
- Functional worker test: load `CODE_LOOP_WORKER_SOURCE` into a `node:vm`
  sandbox, post a `run` message, assert intentions are posted for each
  `bot.*` call and a `done` event fires on clean `return`.
- Error isolation test: bot code that throws must produce an `error` message
  to the main thread without crashing the sandbox.
- `npm run test:steps` and `python3 tests/sim-worker-smoke.py` must still pass
  (Code Loop does not touch the action-step registry).
