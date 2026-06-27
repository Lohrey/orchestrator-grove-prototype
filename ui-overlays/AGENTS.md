# ui-overlays/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Standalone UI overlay assets shipped separately from the in-game canvas UI: the
`orchestrator-grove-prototype.css` overlay stylesheet and the `ui-overlays.js` overlay script.

## Ownership
Orchestrator Grove prototype maintainers.

## Local Contracts
- These overlays are self-contained (one CSS + one JS); do not couple them to internal `src/`
  module APIs without documenting the dependency here.
- Keep overlay CSS scoped to overlay selectors; do not let it leak global rules into the game
  canvas stylesheets (`styles.css`, `styles-interactions.css` at repo root).

## Work Guidance
- Edit the CSS and JS directly; no build step for this folder.

## Verification
- Manual verification against the served game. No dedicated automated check targets this folder.

## Child DOX Index
- None.
