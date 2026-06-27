# wasm/sim-core/ — DOX local contract

- Parent: [../../AGENTS.md](../../AGENTS.md)

## Purpose
The Rust crate that compiles to the WASM simulation core consumed by the JS sim worker
(`src/sim/`). Sources live in `src/lib.rs`; crate config in `Cargo.toml`; dependencies pinned in
`Cargo.lock`. The compiled artifact is copied to `src/sim/wasm/sim_core.wasm` by the build.

## Ownership
Orchestrator Grove prototype maintainers.

## Local Contracts
- `target/` is Cargo build output. **Do not edit, commit, or document anything inside `target/`.**
  It is not a durable boundary and must not contain an AGENTS.md.
- Edit Rust sources in `src/lib.rs`; dependency changes go through `Cargo.toml`/`Cargo.lock`.
- The WASM ABI consumed by `src/sim/sim-worker.ts` is a contract: changing the exported surface
  requires updating the worker client in lockstep (see [../../src/sim/AGENTS.md](../../src/sim/AGENTS.md)).
- Build target is `wasm32-unknown-unknown`; keep that target installed.

## Work Guidance
- Use `npm run build:wasm` (cargo build --release --target wasm32-unknown-unknown + copy to
  `src/sim/wasm/`) to produce a shippable artifact.
- Keep the exported ABI minimal and stable; expand deliberately.

## Verification
- `npm run build:wasm` must succeed.
- `npm run test:sim-worker` → `python3 tests/sim-worker-smoke.py` exercises the worker that loads
  this WASM.

## Child DOX Index
- None. (`src/` here is the Rust source tree of the crate, not a separately documented domain;
  `target/` is build output.)
