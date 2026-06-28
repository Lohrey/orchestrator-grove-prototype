# tests/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Verification surface for the prototype. Mostly Python browser smoke tests (driven against the
running game), plus Node `.mjs` integrity/unit checks. These tests are how changes are proven.

Notable binding checks: `action-step-chain-integrity.mjs` (proves the Action Step Mechanism Chain
is intact), `orchestrator-actions-unit.mjs`, `building-kits-unit.mjs`, `zoom-culling-focused.mjs`,
`pixi-fog-drift-unit.mjs`.

## Ownership
Orchestrator Grove prototype maintainers.

## Local Contracts
- When adding/changing/deleting an action step, add or update a test that proves the chain is
  intact (root [../AGENTS.md](../AGENTS.md) Local Contracts). `action-step-chain-integrity.mjs` is
  the canonical chain-integrity check.
- `__pycache__/` is build output; do not edit or commit it. Do not create AGENTS.md inside it.
- Smoke tests assume the game is served (e.g. `python3 -m http.server 8000`); document the serve
  step if a new test needs it.

## Work Guidance
- Name new tests with the existing `-smoke.py` / `-public-smoke.py` / `-unit.mjs` conventions.
- Prefer extending an existing smoke test over duplicating harness setup.

## Verification
- `npm run test:steps` → `node tests/action-step-chain-integrity.mjs`.
- `npm run test:sim-worker`, `npm run test:architecture`, `npm run test:camera`,
  `npm run test:zoom-culling`, `npm run test:pixi-fog-drift` (see `package.json`).
- Run individual smoke tests directly: `python3 tests/<name>-smoke.py`.

## Child DOX Index
- None.
