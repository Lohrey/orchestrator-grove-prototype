# src/core/ — TypeScript core contracts

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Typed, runtime-validated boundaries for data that crosses between the LLM assistant, DSL, and knowledge-pack layers. TypeScript sources are bundled to `index.js` so the plain static HTML game can import them without a runtime build step.

## Ownership
Orchestrator Grove prototype maintainers.

## Local Contracts
- Zod validation here is structural and runs before game-specific normalization/authorization.
- `Game.validateDslProgram` remains authoritative for world-dependent rules such as existing bots, structures, zones, inventory flow, and unlocked operations.
- Keep schemas forward-compatible with valid action-specific step arguments while rejecting nested steps and malformed envelopes.
- `index.js` is generated and minified by `npm run build:core`; do not hand-edit it.

## Work Guidance
- Add or change contracts in `.ts` files, then run `npm run build:core`.
- Keep browser imports pointed at `src/core/index.js`, never directly at TypeScript or `node_modules`.

## Verification
- `npm run typecheck:core`
- `npm run build:core`
- `npm run test:core`

## Child DOX Index
- None.
