# Implementation Plan - Arrowmaker Building and Ammunition Mechanics (Refined)
Add an "Arrowmaker" building to fletch arrow packs from stick and stone resources. Equip arrow packs to replenish ammunition (max 10 arrows). Restrict player and bot shooting when out of ammunition.
## User Review Required
> [!IMPORTANT]
> The ammunition count for player and bots will start at 0. Equipping an arrow pack immediately consumes it and sets the actor's ammunition to 10.
> 
> A visual indicator (e.g., `10🎯` in light green/red) will be rendered next to the player and bot sprites when a bow is active.
## Proposed Changes
### 1. Action Steps Registry
#### [MODIFY] [action-steps.js](file:///g:/Coding/Projects/orchestrator-grove-prototype/src/action-steps.js)
- Add `craft_arrowmaker` step to `ACTION_STEP_ORDER` and `RAW_ACTION_STEP_REGISTRY`.
- Add `craft_arrowmaker` to `combat` pack in `KNOWLEDGE_PACK_OP_ORDER`.
### 2. DSL Data & Assistant Knowledge

#### [MODIFY] [data.js](file:///g:/Coding/Projects/orchestrator-grove-prototype/src/data.js)
- Add `arrowmaker` to `BUILDING_TYPES` as a military category free prototype.
- Add `arrowmaker` concepts, vocabulary (`arrowmaker`, `arrow pack`), and fletching example to `combat` pack.
### 3. World Engine & Backend Logic
#### [MODIFY] [world.js](file:///g:/Coding/Projects/orchestrator-grove-prototype/src/world.js)
- Add `arrow_pack` to `ITEM_TYPES`, `ITEM_LABELS`, and `EQUIPMENT_WEAPONS`.
- Define fletching recipe: `1 stick + 1 stone → 1 arrow_pack` (takes 3.0 seconds to fletch).
- Add fletching processing: `PRODUCTION_DEFAULTS`, `structureRecipeText`, `productionInputNeeds`, `productionInputCount`, `structureReadyJob`, `consumeStructureInputs`, `finishStructureProcessing` (drops 1 `arrow_pack`).
- Initialize `ammunition: 0` for both player and bots.
- In `equipActor`, if type is `arrow_pack`, consume the pack and increase `actor.ammunition` by 10 (capped at 10). Return `true` to immediately consume/destroy the fletcher package.
- In `actorAlreadyHasPickupType`, return `true` for `arrow_pack` if `actor.ammunition >= 10`.
- In `firePlayerBow` and `fireActorBow`, require `ammunition > 0`, decrement it on fire, and emit warning floats/bot messages if out of ammo.
- Implement `executeCraftArrowmakerStep` for bots and wire it into the DSL runner / `programTaughtLoop`.
- Support `depositHeldItemToStructure` for `arrowmaker` to accept stick and stone deposits, printing output to float, and triggering processing.
- Add `arrowmaker` to `nearestStructure` player target structures list (line 4239).
### 4. Visual Assets & Art
#### [MODIFY] [visual-assets.js](file:///g:/Coding/Projects/orchestrator-grove-prototype/src/visual-assets.js)
- Add fletching quiver drawing (`drawArrowPack(c)`) for `arrow_pack` items.
- Add fletching workshop drawing (`drawArrowmaker(c, asset, w, h, hover)`) with targets and crossed arrow graphics.
- Register assets in the draw list.
### 5. UI Overlay & Renderer
#### [MODIFY] [canvas-renderer.js](file:///g:/Coding/Projects/orchestrator-grove-prototype/src/canvas-renderer.js)
- Show workshop target storage contents (`S... St... P...`) on `arrowmaker` hover.
- Draw active ammunition indicators (`10🎯`) next to player and bot sprites when a bow is equipped.
### 6. Fog of War
#### [MODIFY] [fog-of-war.js](file:///g:/Coding/Projects/orchestrator-grove-prototype/src/fog-of-war.js)
- Add `arrowmaker` to `LIGHT_EMITTING_STRUCTURE_TYPES` so it reveals fog of war.
### 7. HTML markup
#### [MODIFY] [index.html](file:///g:/Coding/Projects/orchestrator-grove-prototype/index.html)
- Add an `arrowmaker` build button to the Build drawer under the military category.
### 8. Playbook documentation
#### [NEW] [playbook_createProductionBuilding.md](file:///g:/Coding/Projects/orchestrator-grove-prototype/AI_Playbooks/playbook_createProductionBuilding.md)
- Save what was learned and needs to be regarded when creating a new building.
### 9. Python Smoke Tests
#### [MODIFY] [tests/build-menu-icons-smoke.py](file:///g:/Coding/Projects/orchestrator-grove-prototype/tests/build-menu-icons-smoke.py)
- Include `arrowmaker` button description in tests.
#### [MODIFY] [tests/fog-night-cycle-smoke.py](file:///g:/Coding/Projects/orchestrator-grove-prototype/tests/fog-night-cycle-smoke.py)
- Include `arrowmaker` in the list of light-emitting structures.
## Verification Plan
### Automated Tests
Run integration tests to verify no breaks in action chains, UI buttons, or fog lighting:
```powershell
node tests/action-step-chain-integrity.mjs
python tests/build-menu-icons-smoke.py
python tests/fog-night-cycle-smoke.py
```
### Manual Verification
- Deploy `arrowmaker` from build drawer.
- Deposit 1 stick and 1 stone to watch fletching processing and quiver drop.
- Pick up quiver to gain 10 arrows.
- Equip bow, shoot arrows at a target until ammo hits 0. Ensure shooting fails and reloading float appears.
- Ensure bots can use `equip_item("arrow_pack")` to load arrows.
- Ensure bots can use `deposit_to_structure` to supply materials to the arrowmaker.