# Orchestrator Grove Audio Documentation

Task: `t_cb4d09e8`

## Implementation choice

- Sound effects are generated in-browser with Web Audio (`src/audio.js`). No local SFX files are bundled yet.
- Cozy background music uses free listener-supported online radio streams from SomaFM, started manually from Esc → Audio because browsers block autoplay.
- The code keeps this split explicit so later we can replace generated cues with higher-quality downloaded/licensed audio files without hunting through the game logic.

## Audio files vs generated vs online

| Cue / source | Type | File/URL | Used for |
| --- | --- | --- | --- |
| SomaFM Groove Salad | online radio stream | `https://ice2.somafm.com/groovesalad-128-mp3` | Cozy chill/downtempo background option |
| SomaFM Drone Zone | online radio stream | `https://ice1.somafm.com/dronezone-128-mp3` | Cozy ambient background option |
| `ui_click` | generated Web Audio | none | Generic menu/action fallback |
| `ui_error` | generated Web Audio | none | Invalid deposit / blocked action |
| `move` | generated Web Audio | none | Right-click move orders |
| `build` | generated Web Audio | none | Placing structures |
| `bot_online` | generated Web Audio | none | Bot creation / factory bot output |
| `pickup` | generated Web Audio | none | Picking up loose items |
| `equip` | generated Web Audio | none | Equipping sword/shield/bow or equipment pickup |
| `drop` | generated Web Audio | none | Dropping/spawning loose items |
| `deposit` | generated Web Audio | none | Depositing items into production buildings |
| `storage` | generated Web Audio | none | Item palette storage pickup/deposit |
| `chop` | generated Web Audio | none | Tree/hemp chopping hits |
| `mine` | generated Web Audio | none | Stone mining hits |
| `dig` | generated Web Audio | none | Digging holes |
| `plant` | generated Web Audio | none | Planting tree seeds |
| `search` | generated Web Audio | none | Searching trees/hemp |
| `harvest` | generated Web Audio | none | Hemp harvest |
| `craft_start` | generated Web Audio | none | Starting sawbench/workbench/smithery/bowmaker/factory processing |
| `craft_done` | generated Web Audio | none | Finished production output |
| `arrow` | generated Web Audio | none | Defense tower / ranged arrow shot |
| `hit` | generated Web Audio | none | Monster/throne damage |
| `victory` | generated Web Audio | none | Enemy defeated / throne destroyed |
| `switch` | generated Web Audio | none | Recipe mode and weapon-set switching |

## Action and object coverage checked

### Player interactions

| Action | Object(s) | Sound cue |
| --- | --- | --- |
| Right-click move | map tile | `move` |
| Right-click / E pickup | loose item: log, plank, pole, stick, stone, tree_seed, hemp, hemp_seed, tools | `pickup` |
| Pickup/equip combat gear | wooden_sword, wooden_shield, bow | `equip` |
| Q drop | carried inventory or active equipment | `drop` |
| Right-click / E deposit | sawbench, workbench, factory, smithery, bowmaker | `deposit` |
| Store/take items | item_palette | `storage` |
| E dig | clear dirt while holding crude_shovel | `dig` |
| Plant seed | dug_hole while holding tree_seed | `plant` |
| Chop tree | grown tree while holding crude_axe | `chop` |
| Mine stone | stone deposit while holding crude_pickaxe | `mine` |
| Search tree | grown tree / small tree resource | `search` |
| Search hemp | hemp plant | `search` |
| Chop hemp | hemp plant with crude_axe | `harvest` / `chop` |
| Attack | passive monster, enemy throne | `hit`, `victory` when destroyed |
| Switch weapon set | player equipment sets | `switch` |

### Building / production interactions

| Action | Object(s) | Sound cue |
| --- | --- | --- |
| Place building | sawbench, workbench, factory, smithery, bowmaker, defensetower, item_palette, throne | `build` |
| Switch output recipe | workbench, smithery | `switch` |
| Start processing | sawbench, workbench, factory, smithery, bowmaker | `craft_start` |
| Finish processing / drop output | sawbench, workbench, factory, smithery, bowmaker | `craft_done` plus `drop` for generated items |
| Defense tower fires | defensetower → monster | `arrow` |

### Bot / DSL actions

| DSL op | Object(s) | Sound cue |
| --- | --- | --- |
| `move_to_target`, `move_to_structure` | current target / building | movement is visual-only for bots; no per-step footstep spam |
| `pick_up`, `pick_up_specific` | loose items | `pickup` / `equip` |
| `pick_up_from_storage` | item_palette | `storage` where player-facing; bot storage uses pickup path |
| `deposit_to_structure`, `deliver_to_*` | production buildings, palettes | `deposit` / `storage` |
| `chop_tree` | grown tree | `chop` |
| `search_tree` | tree | `search` |
| `chop_hemp` | hemp plant | `harvest` when completed |
| `search_hemp` | hemp plant | `search` |
| `mine_stone` | stone deposit | `mine` |
| `dig_hole` | clear dirt | `dig` |
| `plant_seed` | dug_hole | `plant` |
| `craft_workbench`, `process_sawbench`, `process_poles`, `assemble_bot` | production buildings | `craft_start` / `craft_done` |
| `drop_item` | ground | `drop` |
| `wait`, `loop`, `if_inventory`, `find_*`, `idle_parking` | control/selection-only ops | no sound by design |

## Future replacement plan

If we later want higher-quality SFX files, replace generated recipes in `src/audio.js` with licensed local assets under a new `audio/` folder and update this document. Good free-resource candidates found during research: Mixkit free game/interface sound effects and JDSherbert Wooden UI SFX on itch.io. For this pass, generated SFX avoid licensing ambiguity and keep the prototype deployable without asset downloads.
