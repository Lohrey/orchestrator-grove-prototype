# docs/ — DOX local contract

- Parent: [../AGENTS.md](../AGENTS.md)

## Purpose
Long-form project documentation: guides, prompting notes, and reference material that does not
belong inline in code or README. Currently holds AI/LLM prompting references such as
`tabbyapi-caching-friendly-prompting.md`.

## Ownership
Orchestrator Grove prototype maintainers. Documentation here is advisory reference material, not
runtime code.

## Local Contracts
- Keep docs as Markdown; do not place runnable code or build configs here.
- Docs describe stable behavior, not changelog entries.
- When a doc documents a contract that also lives in an AGENTS.md, keep the two in sync or link
  the doc from the relevant AGENTS.md rather than duplicating the rule.

## Work Guidance
- Prefer cross-links to README.md and the nearest AGENTS.md over duplicating content.
- Delete stale notes; do not annotate history.

## Verification
- Manual review only. No automated check runs against this folder.

## Child DOX Index
- None.
