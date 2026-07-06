# src/assistant/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
The in-game AI assistant subsystem: LLM-powered chat, knowledge packs, semantic
routing, and prompt building. Connects the player's natural-language requests to
the game's action-step system via a local or remote LLM provider (Ollama,
OpenAI-compatible).

## Ownership
Orchestrator Grove prototype maintainers. The action-step chain in
[../AGENTS.md](../AGENTS.md) is binding: assistant knowledge packs expose action
steps derived from the canonical registry in `../action-steps.js`.

## Files
- `assistant.js` — main entry; LLM provider config, request parsing, response
  parsing, re-exports from knowledge/prompt modules.
- `assistant-eval.js` — assistant evaluation utilities.
- `assistant-knowledge.js` — knowledge-pack normalization, loadout management.
- `assistant-pack-catalog.js` — the knowledge-pack catalog (action-step ops per pack).
- `assistant-prompt.js` — prompt building for Ollama and OpenAI-compatible providers.
- `assistant-router.js` — semantic router: selects the best knowledge loadout for a
  player query using embedding similarity (runs in a WebWorker).
- `assistant-router.worker.js` — the WebWorker source for the semantic router.
- `semantic-router.js` — semantic profiling, threshold config, loadout selection logic.

## Local Contracts
- Knowledge packs derive their action-step ops from `../action-steps.js`. Changes
  to the action-step registry must propagate here (see Action Step Mechanism Chain).
- The semantic router runs in a WebWorker spawned via Blob URL
  (`assistant-router.worker.js`). Bot code and router code must not run on the
  main thread except for orchestration.
- Imports of `action-steps.js` and `data.js` use `../` (parent `src/` directory).

## Work Guidance
- To add a knowledge pack: update `assistant-pack-catalog.js`, ensure the
  referenced action-step ops exist in `../action-steps.js`.
- The assistant is consumed by `src/ui/assistant-ui.js`, `src/ui/chat-ui.js`,
  `src/ui/provider-ui.js`, and `src/main.js`.

## Verification
- `node --check src/assistant/*.js`
- `npm run test:semantic-router` must pass (assistant-ui.js imports the chain).
- `npm run test:steps` must pass (reads assistant-ui.js for step-chain assertions).

## Child DOX Index
- None.
