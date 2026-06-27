# vendor/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Vendored third-party libraries committed to the repo so the game runs without a CDN or package
fetch at runtime. Currently: `vendor/pixi/pixi.mjs` (PixiJS), consumed by
`src/renderers/pixi-renderer.js`.

## Ownership
Vendored, read-only. Owned by the upstream project (PixiJS); this repo only pins a copy.

## Local Contracts
- **Do not edit vendored files.** Treat `vendor/**` as read-only. Bug fixes belong upstream.
- Upgrades are deliberate, one-shot operations: replace the vendored file, bump the documented
  version if tracked, and verify the consumer (`src/renderers/`) still works.
- Do not add first-party source code under `vendor/`; this folder is for third-party assets only.

## Work Guidance
- When changing how Pixi is consumed, edit the consumer under `src/renderers/`, not the vendored
  file. See [../src/renderers/AGENTS.md](../src/renderers/AGENTS.md).

## Verification
- The Pixi renderer is exercised by render-related smoke tests under `tests/`.
- A version mismatch between consumer expectations and the vendored file surfaces as render smoke
  failures.

## Child DOX Index
- None. (`vendor/pixi/` holds a single vendored file and is not a separate documented domain.)
