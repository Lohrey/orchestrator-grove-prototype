# Create a Production Building

This playbook describes the repeatable process for adding a new production building to Orchestrator Grove.

Use it for anything that:
- consumes inputs over time,
- produces an item or structure,
- can be placed from the build menu,
- can be used by the player and by bots,
- and should be visible in the assistant DSL / knowledge packs.

## 1. Define the gameplay contract

Start with the exact loop:
- What inputs are required?
- What output is produced?
- Is the output dropped as a loose item, stored internally, or both?
- Who can use it: player, bot, recorder, assistant DSL?
- Does it need a manual interact action, a delivery action, or both?

Write the contract down before touching code. For the arrowmaker example:
- Input: `stick + stone`
- Output: `arrow_pack`
- Effect: each pack loads 10 arrows when equipped
- Users: player, bots, recorder, assistant DSL

## 2. Update the action-step chain first

If the building introduces a new action-step, update the full chain in one change:
- `src/world.js`
- `src/action-steps.js`
- `src/data.js`
- assistant parsing and prompt exposure
- teach-by-doing recorder / replay
- UI cards and settings tables
- tests

Do not add a step in only one place.

## 3. Wire backend execution

Implement the actual gameplay logic in `src/world.js`:
- structure defaults and metadata
- production inputs
- job readiness checks
- input consumption
- output creation
- player interaction
- bot task execution
- validation for DSL programs

Make the backend the source of truth. UI should only reflect what the backend actually supports.

## 4. Add registry and assistant metadata

Update the canonical registry and the assistant-facing descriptions:
- action step label
- arguments and aliases
- prompt signature
- knowledge-pack ordering
- example snippets
- built-in templates if used

This keeps generated prompts, help text, and the UI in sync.

## 5. Expose the building in the world

Add the building to the user-facing surfaces:
- build drawer button
- world rendering asset
- hover or menu summary text
- save-state / registry serialization
- fog-of-war light rules if it should illuminate the world
- HUD hints if it affects combat or inventory

If the building has a special output like ammo, show that somewhere visible during play.

## 6. Teach the assistant how to talk about it

Add the natural-language route the assistant should recognize:
- item labels and synonyms
- building name synonyms
- production intent phrases
- target selection behavior

This is what makes the building usable without manual DSL entry.

## 7. Test the chain

At minimum, add tests for:
- registry inclusion
- DSL validation / normalization
- bot execution
- player interaction if relevant
- build menu visibility
- rendering or fog rules if relevant
- public smoke coverage if the feature is user-facing

Prefer one test that proves the feature works end to end and one test that proves the step chain stayed intact.

## 8. Verify manually

Before calling the feature done, confirm these in the app:
- the build button appears
- the building can be placed
- the menu text matches the intended recipe
- inputs can be supplied
- the job runs and produces the expected output
- the output can be used by the player or bot as intended

## 9. Keep the pattern reusable

After the feature lands, update this playbook with any new lessons:
- special serialization fields
- unusual UI requirements
- new validation rules
- edge cases around inventory or ammo

The goal is to make the next building cheaper to ship than the last one.
