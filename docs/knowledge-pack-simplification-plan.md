# Knowledge Pack Simplification Plan

Goal: keep the backend action-step chain expressive, but make local-model function calls simple enough for small models such as Qwen2.5-Coder-class models on consumer hardware.

The important rule is that complexity mode must affect all three layers together:

- the kernel protocol sent to the model.
- the knowledge-pack/action contract selected for the prompt.
- the data injected into a custom knowledge pack when a registry action op is selected.

The registry in `src/action-steps.js` must know these mode-specific contracts. The backend remains the source of truth and still validates the compiled DSL through `Game.validateDslProgram`.

## Current Shape

- `src/action-steps.js` is the source of truth for executable DSL operations and registry metadata.
- `src/assistant-pack-catalog.js` owns built-in pack definitions and default loadout.
- `src/assistant-knowledge.js` owns pack normalization, token estimates, and loadout summaries.
- `src/assistant-prompt.js` owns the protocol kernel, compact capability contracts, runtime-symbol pruning, and provider request bodies.
- `src/assistant.js` focuses on heuristic parsing, validation, and local provider orchestration while re-exporting public assistant APIs.

## Complexity Modes

### `simple`

Default target for small local models.

The model returns the simplest valid JSON action calls. It does not write low-level DSL steps, zones, structure ids, or target ids unless the user explicitly named them.

Kernel protocol shape:

```json
{
  "assignments": [
    {
      "assignee": { "strategy": "idle" },
      "action": "pick_up",
      "object": "log",
      "repeat": true
    }
  ]
}
```

Allowed assignment selectors:

- `{ "strategy": "idle" }`
- `{ "strategy": "any_eligible" }`
- `{ "botId": 2 }`
- `{ "ref": "Bot 2" }`

Allowed common slots:

- `action`: required canonical simple action id.
- `object`: required only when the action needs an item/resource/recipe type.
- `building`: required only when the action needs a building type or named building.
- `target`: optional actor, building, hostile, or named target.
- `location`: optional zone/name/radius/rect text only when the user says one.
- `repeat`: optional; backend defaults to `true` for work loops and `false` for one-shot commands.

### `medium`

Current compact DSL assignment surface.

The model returns `dsl_assignments` with selected registry operations, compact args, request-relevant symbols, locked-op hints, and a small number of examples. This is the current behavior.

### `complex`

no need to implement yet.

## Registry Metadata Draft

Each action step should grow explicit complexity metadata. The data below is a working shape, not final syntax:

```js
pick_up: step({
  label: 'Pick up',
  args: ['type', 'zone'],
  simple: {
    action: 'pick_up',
    call: { action: 'pick_up', object: '$type' },
    required: ['object'],
    optional: ['location', 'repeat'],
    defaults: {
      location: 'nearest',
      repeat: true
    },
    compile: {
      op: 'pick_up',
      map: { type: 'object', zone: 'location' }
    }
  },
  medium: {
    args: ['type', 'zone'],
    includeAliases: true,
    includeRule: true
  },
  complex: {
    includeDslSnippet: true,
    includePromptSignature: true,
    includeAliases: true,
    includeExamples: true,
    includeRuntimeSymbols: true
  }
})
```

Registry metadata must define:

- `simple.action`: canonical simple action id exposed to the simple kernel.
- `simple.call`: the smallest valid JSON object for the action.
- `simple.required`: model-required fields only.
- `simple.optional`: fields the model may provide but does not need to.
- `simple.defaults`: backend defaults when optional fields are missing.
- `simple.compile`: how the resolver maps the simple call to real DSL steps.
- `medium` and `complex`: what prompt data is injected for the action at those modes.

Integrity tests should fail if an op is selectable in a pack but has no contract for the active complexity mode, unless the registry explicitly marks it as hidden for that mode.

## Custom Knowledge Pack Injection

When the player creates a custom knowledge pack and selects an op from the registry, injected data depends on complexity.

For `simple`, selecting `pick_up` should inject only:

```json
{
  "action": "pick_up",
  "label": "Pick up",
  "call": { "action": "pick_up", "object": "$type" },
  "required": ["object"],
  "optional": ["location", "repeat"],
  "defaults": { "location": "nearest", "repeat": true },
  "words": ["pick up", "pickup", "collect", "grab", "take item"]
}
```

For `medium`, selecting `pick_up` should inject the current compact action contract:

```json
{
  "op": "pick_up",
  "args": ["type", "zone"],
  "rule": "loose ground items only; not trees or buildings",
  "aliases": ["pick up", "pickup", "collect", "grab", "take item"],
  "argAliases": {
    "type": ["item", "resource", "item type", "kind"],
    "zone": ["area", "region", "location", "nearby area"]
  }
}
```

For `complex`, selecting `pick_up` may inject the full registry-derived action detail:

```json
{
  "op": "pick_up",
  "label": "Pick up",
  "description": "Pick up the nearest loose item of type when hands are empty.",
  "args": ["type", "zone"],
  "dslSnippet": "{\"op\":\"pick_up\",\"type\":\"$type\",\"zone\":\"$zone\"}",
  "promptSignature": "pick_up(type, zone?) - loose ground items only...",
  "partAliases": "...",
  "examples": "..."
}
```

This keeps custom packs useful for small models. Selecting a powerful registry op does not automatically force the model to see every backend option.

## Simple Backend Resolver

Add a resolver between model JSON and `Game.validateDslProgram`:

1. Parse simple assignments.
2. Resolve assignee: explicit bot first, otherwise idle bot, otherwise `any_eligible`.
3. Normalize action/object/building names through existing game normalizers.
4. Fill omitted defaults from registry metadata and command context.
5. Compile to existing DSL steps.
6. Run `Game.validateDslProgram`.
7. Run pack-lock validation.
8. Return the same validated assignment object used by medium/complex paths.

The resolver needs command context:

```js
{
  requestText,
  issuedAt,
  playerPosition: { x: game.player.x, y: game.player.y },
  defaultRadius: 500
}
```

When a default radius zone is needed, the backend creates an ephemeral zone spec:

```json
{
  "kind": "radius",
  "x": 320,
  "y": 240,
  "radius": 500,
  "name": "command area"
}
```

The model does not need to output this zone.

## Minimal Valid Function Calls

These are the proposed simple-mode standards the registry should encode.

| Action | Minimal model JSON | Backend default when omitted | Compiles to |
| --- | --- | --- | --- |
| `pick_up` | `{ "action": "pick_up", "object": "log" }` | `location: nearest`; nearest loose item of that type, scored from assigned bot if known, otherwise player command position. | `{ op:"pick_up", type, zone? }` |
| `pick_up_from_storage` | `{ "action": "pick_up_from_storage", "object": "log", "building": "item_palette" }` | nearest matching storage building if no explicit name; no source id needed from model. | `{ op:"pick_up_from_storage", type, source }` |
| `chop_tree` | `{ "action": "chop_tree" }` | create radius zone 500 around player command position. | `{ op:"chop_tree", zone }` |
| `search_tree` | `{ "action": "search_tree" }` | create radius zone 500 around player command position. | `{ op:"search_tree", zone }` |
| `mine_stone` | `{ "action": "mine_stone" }` | create radius zone 500 around player command position. | `{ op:"mine_stone", zone }` |
| `chop_hemp` | `{ "action": "chop_hemp" }` | create radius zone 500 around player command position. | `{ op:"chop_hemp", zone }` |
| `search_hemp` | `{ "action": "search_hemp" }` | create radius zone 500 around player command position. | `{ op:"search_hemp", zone }` |
| `dig_hole` | `{ "action": "dig_hole" }` | create radius zone 500 around player command position. | `{ op:"dig_hole", zone }` |
| `plant_seed` | `{ "action": "plant_seed" }` or `{ "action": "plant_seed", "object": "tree_seed" }` | create radius zone 500 around player command position; object defaults to `tree_seed`. | pick up seed if needed, then `{ op:"plant_seed", zone }` where supported by existing validation. |
| `deposit_to_structure` | `{ "action": "deposit_to_structure", "object": "log", "building": "sawbench" }` | nearest matching building type if no explicit building name. | `{ op:"deposit_to_structure", type, target }` |
| `drop_item` | `{ "action": "drop_item" }` | current assigned bot/player command area if no location. | `{ op:"drop_item", zone? }` |
| `deposit_to_player` | `{ "action": "deposit_to_player", "object": "log" }` | player is implicit target. | `{ op:"deposit_to_player", type }` |
| `take_from_player` | `{ "action": "take_from_player", "object": "stone" }` | player is implicit source. | `{ op:"take_from_player", type }` |
| `move_to_structure` | `{ "action": "move_to_structure", "building": "sawbench" }` | nearest matching building type if no explicit name. | `{ op:"move_to_structure", target }` |
| `deploy_building_kit` | `{ "action": "deploy_building_kit", "object": "sawbench_kit" }` | create/deploy at player command position unless user says a location. | `{ op:"deploy_building_kit", type, zone? }` |
| `disassemble_building_to_kit` | `{ "action": "disassemble_building_to_kit", "building": "sawbench" }` | nearest matching disassemblable building type if no explicit name. | `{ op:"disassemble_building_to_kit", target }` |
| `craft_workbench` | `{ "action": "craft_workbench", "object": "crude_axe" }` | nearest workbench. | `{ op:"craft_workbench", recipe, target }` |
| `craft_smithery` | `{ "action": "craft_smithery", "object": "sword" }` | nearest smithery; recipe normalized to wooden sword/shield. | `{ op:"craft_smithery", recipe, target }` |
| `craft_bowmaker` | `{ "action": "craft_bowmaker", "object": "bow" }` | nearest bowmaker. | `{ op:"craft_bowmaker", recipe:"bow", target }` |
| `craft_arrowmaker` | `{ "action": "craft_arrowmaker", "object": "arrow_pack" }` | nearest arrowmaker. | `{ op:"craft_arrowmaker", recipe:"arrow_pack", target }` |
| `process_sawbench` | `{ "action": "process_sawbench" }` | nearest sawbench. | `{ op:"process_sawbench", target }` |
| `process_poles` | `{ "action": "process_poles" }` | nearest sawbench. | `{ op:"process_poles", target }` |
| `follow` | `{ "action": "follow", "target": "me" }` | target defaults to `me`; distance defaults to backend follow distance. | `{ op:"follow", target, distance? }` |
| `guard_area` | `{ "action": "guard_area" }` | guard radius zone 500 around player command position; repeat true. | `{ op:"guard_area", zone, radius? }` |
| `patrol_route` | hidden in `simple` initially | Too shape-heavy for small models unless UI supplies points. | Use `medium`/`complex`. |
| `attack` | `{ "action": "attack", "target": "monster" }` | target/type defaults to `monster`; zone defaults to nearby radius 500 around assigned bot unless user says area. | `{ op:"attack", type, zone, radius }` |
| `equip_item` | `{ "action": "equip_item", "object": "sword" }` | nearest valid weapon item. | `{ op:"equip_item", type }` |
| `rename_bot` | `{ "action": "rename_bot", "target": "Bot 2", "name": "Guard" }` | target defaults to assigned bot. | `{ op:"rename_bot", target?, name }` |
| `wait` | `{ "action": "wait", "seconds": 2 }` | seconds defaults to 1. | `{ op:"wait", seconds }` |
| `assign_template` | `{ "action": "assign_template", "target": "Bot 2", "template": "Feed sawbench" }` | target defaults to assigned bot only if safe. | `{ op:"assign_template", bot, templateName }` |
| `promote_to_manager` | `{ "action": "promote_to_manager" }` | target defaults to assigned bot; packs default to current simple loadout. | `{ op:"promote_to_manager", knowledgePacks?, target? }` |
| `delegate_to_manager` | `{ "action": "delegate_to_manager", "target": "Manager", "message": "chop trees" }` | no default message; manager target required if more than one manager exists. | `{ op:"delegate_to_manager", recipient, message }` |

Some internal/target-selection ops should be hidden from simple mode because they are implementation details:

- `find_nearest_tree`
- `find_stone_deposit`
- `find_hemp`
- `find_item`
- `find_dig_spot`
- `move_to_target`
- `pick_up_specific`
- `fetch_plank_from_sawbench`
- `fetch_pole_from_sawbench`
- `deliver_to_sawbench`
- `deliver_to_workbench`
- `deliver_to_factory`
- `assemble_bot`
- `idle_parking`
- `if_inventory`
- `find_dug_hole`
- `use_held_item`

Those can still be available in `medium` and `complex`, and the simple resolver may compile to them when needed.

## Kernel Protocol by Mode

`buildAssistantPrompt(..., { complexityMode })` should choose a protocol kernel:

- `SIMPLE_ASSISTANT_KERNEL`: requires `assignments`; each assignment has `assignee`, `action`, and minimal slots.
- `MEDIUM_ASSISTANT_KERNEL`: current `dsl_assignments` protocol.
- `COMPLEX_ASSISTANT_KERNEL`: `dsl_assignments` plus richer repair/explanation allowances for debugging.

The prompt preview should show which kernel was used.

## Knowledge Pack Output by Mode

`formatAssistantLoadout(loadout, packs, { complexityMode })` should emit:

- `simple`: `simpleActions`, tiny facts, tiny words, no DSL snippets unless needed for repair.
- `medium`: current compact `actions`.
- `complex`: full `actionDetails`.

Semantic routing should route packs the same way, but the prompt builder should only serialize the mode-appropriate pack data.

## Implementation Phases

1. Add registry `simple` metadata for the action table above.
2. Add `src/assistant-intents.js` or `src/assistant-simple-resolver.js` with `compileSimpleAssignment(raw, game, commandContext, registry)`.
3. Add simple kernel and prompt assembly path in `src/assistant-prompt.js`.
4. Update `normalizeAssistantKnowledgePack` so custom packs receive mode-specific injected action data.
5. Add Settings UI for `simple`, `medium`, `complex`, with `simple` described as the local-model default.
6. Add integrity tests that every op selected into a simple custom pack has either `simple` metadata or an explicit `simpleHidden` reason.
7. Add resolver tests for:
   - `chop tree` -> idle bot + 500 radius at command player position.
   - `mine stone` -> idle bot + 500 radius at command player position.
   - `pick up log` -> only object required; nearest loose log.
   - `deposit log to sawbench` -> building type only; nearest sawbench.
   - `bring me a log` -> pick up log + deposit to player.
8. Add benchmark rows per mode for token count, valid JSON rate, and semantic correctness.
9. Make `simple` the recommended default once benchmark coverage is stable.

## Guardrails

- Do not bypass `Game.validateDslProgram`.
- Do not make simple mode a second action system; it must compile into registry-backed DSL.
- Do not require the model to output ids, coordinates, or zone JSON in simple mode.
- Keep Canvas 2D rendering as the default path for any UI changes.
- Keep action-step chain tests updated whenever a resolver maps to new or renamed ops.
