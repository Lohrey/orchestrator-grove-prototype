# Orchestrator Grove Audio Documentation

Task: `t_cb4d09e8`

## Implementation choice

- Sound effects are generated in-browser with Web Audio (`src/audio.js`). No local SFX files are bundled yet.
- Cozy background music uses free listener-supported online radio streams from SomaFM, started manually from Esc → Audio because browsers block autoplay.
- The code keeps this split explicit so later we can replace generated cues with higher-quality downloaded/licensed audio files without hunting through the game logic.

## Audio files vs generated vs online

| Cue / source | Type | File/URL | Used for |
| --- | --- | --- | --- |
| SomaFM Groove Salad | online radio stream | `https://ice1.somafm.com/groovesalad-64-aac` | Cozy chill/downtempo background option |
| SomaFM Drone Zone | online radio stream | `https://ice1.somafm.com/dronezone-64-aac` | Cozy ambient background option |
| SomaFM Mission Control | online radio stream | `https://ice1.somafm.com/missioncontrol-64-aac` | Space ambience option |
| SomaFM Vaporwaves | online radio stream | `https://ice1.somafm.com/vaporwaves-64-aac` | Retro synth/game-room mood |
| SomaFM DEF CON | online radio stream | `https://ice1.somafm.com/defcon-64-aac` | Cyber/gaming energy |
| `ui_click` | generated Web Audio | none | Generic menu/action fallback |
| `ui_hover` | generated Web Audio | none | UI hover feedback |
| `ui_error` | generated Web Audio | none | Invalid deposit / blocked action |
| `menu_arrive` | generated Web Audio | none | Menu panel open transition |
| `menu_confirm` | generated Web Audio | none | Menu confirm/selection |
| `menu_back` | generated Web Audio | none | Menu back/cancel |
| `menu_whoosh` | generated Web Audio | none | Menu slide animation |
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
| `demolish` | generated Web Audio | none | Structure demolished with hammer (heavy thud + debris) |
| `disassemble` | generated Web Audio | none | Structure disassembled into building kit (mechanical winding down) |
| `night_fall` | generated Web Audio | none | Day→night transition (ominous low descending drone) |
| `dawn` | generated Web Audio | none | Night→day transition (bright ascending major chord) |
| `monster_spawn` | generated Web Audio | none | Night monster spawns (threatening low growl burst) |
| `player_hurt` | generated Web Audio | none | Player takes damage (sharp pain yelp) |
| `bot_defeat` | generated Web Audio | none | Bot destroyed/defeated (sad power-down descending tones) |
| `teach_start` | generated Web Audio | none | Teach recording begins (clean two-tone ascending beep) |
| `teach_stop` | generated Web Audio | none | Teach recording stops (pleasant three-note confirm chime) |
| `zone_create` | generated Web Audio | none | Zone drawn/created (warm mid-tone + soft noise sweep) |
| `promote` | generated Web Audio | none | Bot promoted to manager (small trumpet-ish fanfare) |
| `save` | generated Web Audio | none | Game saved (short digital chirp — wired when main.js save available) |
| `dog_bark` | generated Web Audio | none | Dog bot fetches item (playful double yap) |
| `team_create` | generated Web Audio | none | Bot team created (chord stab) |
| `level_up` | generated Web Audio | none | Milestone/achievement (bright ascending arpeggio + shimmer) |
| `warn` | generated Web Audio | none | Warning/alert for low HP or danger (urgent double square pulse) |

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
| Player takes damage | player HP reduced | `player_hurt` |
| Demolish structure | placed structure with hammer | `demolish` |
| Disassemble structure | structure with building kit | `disassemble` |
| Draw zone | map area (rect/radius) | `zone_create` |

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
| `deploy_building_kit` | building kit on ground | `build` |
| `disassemble_building_to_kit` | existing structure | `disassemble` |
| `wait`, `loop`, `if_inventory`, `find_*`, `idle_parking` | control/selection-only ops | no sound by design |

### Bot management actions

| Action | Sound cue |
| --- | --- |
| Create bot team | `team_create` |
| Promote bot to manager | `promote` |
| Bot defeated in combat | `bot_defeat` |
| Dog bot fetches item | `dog_bark` |

### World / ambient events

| Event | Sound cue |
| --- | --- |
| Day→night transition | `night_fall` |
| Night→day transition (dawn) | `dawn` |
| Night monster spawns | `monster_spawn` |
| Teach recording starts | `teach_start` |
| Teach recording stops | `teach_stop` |
| Game save (pending main.js wiring) | `save` recipe available, wiring deferred to main.js refactor |
| Level-up / milestone | `level_up` recipe available, not yet triggered in game loop |
| Low HP / danger warning | `warn` recipe available, not yet triggered in game loop |

## Recipes available but not yet wired

These recipes exist in `src/audio.js` and are ready to be triggered via `emitSound(name, opts)` once the appropriate game-event hooks are added:

- `save` — game save confirm. `main.js` handles autosave; wiring deferred since main.js is being refactored by another worker.
- `level_up` — achievement/milestone fanfare. Needs a milestone-tracking hook (e.g. first bot, first craft, etc.).
- `warn` — low HP / danger alert. Needs a threshold check in the player HP update loop.

## Recipe design notes

Each recipe is a self-contained function `(ctx) => { tone(ctx, {...}); noise(ctx, {...}); }` that synthesizes the sound using the Web Audio API at runtime. The `tone()` helper creates an oscillator with a frequency ramp and gain envelope. The `noise()` helper creates a filtered white-noise burst. Recipes are cooldown-throttled per-key via `play(name, { cooldownKey, minGapMs })`.

All 16 new recipes follow the same compact one-liner style as the original 24, using only `tone()` and `noise()` primitives with different parameters for character.

## Future replacement plan

If we later want higher-quality SFX files, replace generated recipes in `src/audio.js` with licensed local assets under a new `audio/` folder and update this document. Good free-resource candidates found during research: Mixkit free game/interface sound effects and JDSherbert Wooden UI SFX on itch.io. For this pass, generated SFX avoid licensing ambiguity and keep the prototype deployable without asset downloads.
