# src/sim/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Simulation worker layer that offloads world simulation from the main thread. Sources:
`sim-worker.ts` (TypeScript source), `sim-worker.js` (esbuild-bundled output), and
`sim-worker-client.js` (main-thread client). The built `wasm/sim_core.wasm` artifact is served
from `src/sim/wasm/`.

## Ownership
Orchestrator Grove prototype maintainers.

## Local Contracts
- `src/sim/sim-worker.js` and `src/sim/wasm/sim_core.wasm` are **build outputs**, not hand-edited
  sources. Regenerate via:
  - `npm run build:sim-worker` → esbuild bundles `sim-worker.ts` to `sim-worker.js`.
  - `npm run build:wasm` → cargo builds `wasm/sim-core` and copies the `.wasm` here.
- Edit `sim-worker.ts`, not the bundled `sim-worker.js`. Edit Rust sources under `wasm/sim-core/`
  (see [../../wasm/sim-core/AGENTS.md](../../wasm/sim-core/AGENTS.md)), not the `.wasm`.
- `sim-worker-client.js` is the main-thread contract; keep its message protocol in sync with
  `sim-worker.ts`.

## Work Guidance
- Changes to the worker protocol must update both `sim-worker.ts` and `sim-worker-client.js`.
- After changing sources, rebuild artifacts before claiming the worker is updated.

## Verification
- `npm run test:sim-worker` → `python3 tests/sim-worker-smoke.py`.
- `npm run build:sim-worker` and `npm run build:wasm` must succeed for the worker to be current.

## Child DOX Index
- None. (`src/sim/wasm/` holds only a build artifact and is not a documented boundary.)
