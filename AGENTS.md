# Repository Agent Rules

## Action Step Mechanism Chain

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

[`ASSISTANT_PROTOCOL_KERNEL` (line 645)](G:\\Coding\\Projects\\orchestrator-grove-prototype\\src\\assistant.js#L645)

Do not add a new action by only updating one representation. Do not remove or rename a step without removing or renaming all linked representations. If a step is intentionally not available in one layer yet, record that as explicit registry metadata and add or update a test so the gap is visible rather than accidental.

## Rendering policy

Rendering work should be implemented against the Canvas 2D path first. Any new feature, visual change, overlay, or rendering behavior that depends on a renderer should assume the Canvas 2D setting is the standard execution path unless the task explicitly requires PixiJS or another backend.
