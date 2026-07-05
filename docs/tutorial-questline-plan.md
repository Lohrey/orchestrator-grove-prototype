# Orchestrator Grove — Tutorial Questline Plan

> **Goal:** Introduce buildings, items, and mechanics one at a time so the player is never overwhelmed. Complexity curves upward. Each quest unlocks the next concept and rewards the knowledge/ability to use it.

---

## Design Principles

1. **One new concept per quest** — never introduce two unfamiliar systems simultaneously
2. **Show, don't tell** — dialogue bubbles guide; the player performs the action themselves
3. **Reward = capability** — completing a quest unlocks the building/item/knowledge needed for the next
4. **Teach-by-doing first, automation second** — the player always does a task manually before being asked to automate a bot
5. **Bots are the payoff** — the fun of the game is automation; the tutorial earns that fun by making the player appreciate *why* automation matters (manual work is slow and tedious)
6. **Pacing target** — 6 quests, ~3-5 minutes each, ~20-30 min total for Act I

---

## Game Elements Available

### Resources (natural)
Trees → logs, hemp → hemp fiber, stone deposits → stone, dig spots → holes

### Buildings / Structures
| Building | Function | Requires |
|---|---|---|
| **Sawbench** | logs → planks, planks → poles | Built from logs |
| **Workbench** | craft tools (axe, pickaxe, shovel) | Built from planks + poles |
| **Smithery** | craft weapons (sword, shield) | Built from planks + stone |
| **Bowmaker** | craft bow | Built from planks + poles |
| **Arrowmaker** | craft arrows | Built from planks + poles |
| **Assembler/Factory** | assemble new bots from parts | Pre-placed (drops from van) |

### Items & Tools
- **Raw**: log, hemp, stone, stick, tree_seed
- **Processed**: plank, pole
- **Tools**: crude_axe, crude_pickaxe, shovel (gate gathering speed)
- **Weapons**: sword, wooden_sword, shield, bow, arrow_pack
- **Building kit**: deployable building package

### Knowledge Packs (bot capability gates)
`starter_automation` → `woodworking` → `mining_tools` → `farming` → `logistics` → `combat`

### Starting State (Campaign)
- Player + 2 idle bots + 1 dog
- Camper van (decoration)
- Assembler (drops from van after arrival)
- **Nothing else** — no buildings, no tools, no items

---

## Act I — Survival & Shelter (Quests 1-6)

### Quest 1: "First Steps"
**New concept:** Player movement + world interaction + resource gathering (manual)

| Step | Dialogue (speech bubble) | Player Action | Completion |
|---|---|---|---|
| 1.1 | *"finally arrived... what a nice place. Let us make ourselves comfortable and unpack the van."* | (auto-trigger on arrival) | Dialogue dismissed |
| 1.2 | *"See those trees? Let's grab some wood. Walk to a tree and chop it — right-click it."* | Walk to tree, right-click to chop | Player has ≥1 log in inventory |
| 1.3 | *"Nice! That's a log. Grab a few more — we'll need wood for everything."* | Chop 2 more trees | Player has ≥3 logs |

**Unlocks:** Trees are now familiar. Player knows movement + right-click interaction.

---

### Quest 2: "A Place to Work"
**New concept:** Building placement + the Sawbench (first processing building)

| Step | Dialogue | Player Action | Completion |
|---|---|---|---|
| 2.1 | *"We need a work surface. Let's build a sawbench — it turns logs into planks."* | Open build menu, place sawbench | Sawbench exists in world |
| 2.2 | *"Now haul a log to it. Pick up a log (right-click), carry it to the sawbench, and deposit it."* | Pick up log → walk to sawbench → deposit | Sawbench has ≥1 log input |
| 2.3 | *"The sawbench is processing! Grab the planks when it's done."* | Wait for processing, fetch planks | Player has ≥1 plank |

**Teaches:** Build menu, building placement, input → processing → output pipeline (the core loop of the entire game).

---

### Quest 3: "Tools Make It Easier"
**New concept:** Workbench + tool crafting + tool-gated gathering speed

| Step | Dialogue | Player Action | Completion |
|---|---|---|---|
| 3.1 | *"Chopping by hand is slow. Let's make an axe. First, we need a workbench."* | Build a workbench (costs planks + poles) | Workbench exists |
| 3.2 | *"Now craft a crude axe — deposit planks and a stick into the workbench."* | Craft crude_axe at workbench | Player has crude_axe |
| 3.3 | *"Equip it and try chopping a tree — much faster!"* | Equip axe, chop tree | Tree chopped with axe equipped |
| 3.4 | *"A pickaxe would help with stone too. Let's make one."* | Craft crude_pickaxe | Player has crude_pickaxe |

**Teaches:** Crafting tier (workbench), equip system, tools gate efficiency. Player now feels the *pain* of manual work — perfect setup for automation.

---

### Quest 4: "Meet Your First Helper"
**New concept:** Bot interaction + simple manual bot commands

| Step | Dialogue | Player Action | Completion |
|---|---|---|---|
| 4.1 | *"Those two bots by the van? They can help. Click on a bot."* | Click a bot to open its menu | Bot menu opened |
| 4.2 | *"Let's give it a simple task: follow you. Assign the 'follow' command."* | Assign follow command | Bot is following player |
| 4.3 | *"Now try something useful — tell it to chop wood from the nearby trees."* | Assign chop_tree task to bot | Bot has chopped ≥1 log |
| 4.4 | *"See? Bots do the work for you. The wood goes into their inventory — pick it up from them."* | Take logs from bot | Player received items from bot |

**Teaches:** Bots exist, can be commanded, do work autonomously, and hold items. But assigning single tasks manually is tedious...

---

### Quest 5: "Teach a Bot to Fish"
**New concept:** Teach-by-doing recorder + DSL loops (the signature mechanic)

| Step | Dialogue | Player Action | Completion |
|---|---|---|---|
| 5.1 | *"Assigning tasks one by one is tedious, right? We can teach bots a loop. Open the Teach panel."* | Open teach-by-doing panel | Teach panel open |
| 5.2 | *"Let's record: pick up a log, move to the sawbench, deposit it. Do those steps now — the recorder watches."* | Player performs: pick_up log → move_to sawbench → deposit | Recorder captured 3 steps |
| 5.3 | *"Assign that loop to a bot. It'll repeat the whole chain forever."* | Assign recorded loop to bot | Bot running the loop |
| 5.4 | *"Now you've got automatic plank production! Watch the planks pile up."* | Wait/observe | Bot has produced ≥2 planks via loop |

**Teaches:** The core game loop — record actions → assign to bot → automation. This is the "aha" moment. The player now understands the entire game in miniature.

---

### Quest 6: "Grow the Camp"
**New concept:** Knowledge packs + bot specialization + manager delegation

| Step | Dialogue | Player Action | Completion |
|---|---|---|---|
| 6.1 | *"Your bot only knows basic tasks. Let's teach it more — promote it with the Woodworking knowledge pack."* | Promote bot with `woodworking` pack | Bot has woodworking pack |
| 6.2 | *"Now it can process planks and poles at the sawbench too. Set up a second bot to haul."* | Assign new loop to second bot | Second bot running haul loop |
| 6.3 | *"Too many bots to manage? Make one a Manager. Promote a bot and delegate tasks to it."* | Promote bot to manager, delegate | Manager bot delegating to worker |
| 6.4 | *"Now the camp runs itself. You've built your first automated supply chain!"* | (auto-complete when manager delegates) | Quest complete |

**Teaches:** Specialization (knowledge packs), multi-bot orchestration, manager hierarchy. The player has graduated from manual play to automation design.

---

## Act II — Expansion (Quests 7-10, post-tutorial)

| Quest | New Concept | Build |
|---|---|---|
| **7: "Stone & Metal"** | Mining (pickaxe), smithery, weapons | Stone gathering → smithery → craft sword/shield |
| **8: "Nature's Bounty"** | Farming pack: dig holes, plant seeds, hemp | Trees + hemp farming, renewable resources |
| **9: "Build Your Army"** | Combat pack: equip weapons, patrol, guard | Night monsters appear → player must build defenses |
| **10: "Assemble More Bots"** | Assembler: build new bots from parts | Plank + pole + log + seed recipe → new bot → scale up |

Each Act II quest follows the same pattern: **new resource → new building → new tool → new automation loop → new bot role**.

---

## Quest Data Model (for implementation)

```js
export const CAMPAIGN_QUESTS = [
  {
    id: 'q1_first_steps',
    act: 1,
    title: 'First Steps',
    concept: 'Movement & resource gathering',
    steps: [
      {
        id: 'q1_1',
        dialogue: "finally arrived... what a nice place. Let us make ourselves comfortable and unpack the van.",
        trigger: 'arrival_complete',
        completeWhen: 'dialogue_dismissed',
      },
      {
        id: 'q1_2',
        dialogue: "See those trees? Let's grab some wood. Walk to a tree and right-click to chop it.",
        trigger: 'dialogue_dismissed:q1_1',
        completeWhen: { type: 'inventory_count', item: 'log', min: 1 },
      },
      {
        id: 'q1_3',
        dialogue: "Nice! Grab a few more logs — we'll need wood for everything.",
        trigger: 'inventory_count:log:1',
        completeWhen: { type: 'inventory_count', item: 'log', min: 3 },
      },
    ],
    reward: { message: "You've got wood! Now let's build something." },
  },
  // ... Quests 2-6 follow same structure
];
```

### Trigger types
- `arrival_complete` — fires when the van arrival animation finishes
- `dialogue_dismissed:<step_id>` — fires when the previous dialogue is dismissed
- `inventory_count:<item>:<n>` — fires when player inventory reaches threshold
- `structure_built:<type>` — fires when a building is placed
- `item_crafted:<type>` — fires when a crafting recipe completes
- `bot_assigned:<task>` — fires when a bot is given a task
- `loop_recorded` — fires when teach-by-doing captures a loop
- `bot_promoted:<pack>` — fires when a bot gets a knowledge pack

### Completion check types
- `dialogue_dismissed` — step completes when player dismisses the bubble
- `inventory_count` — `{ item, min }` checks player inventory
- `structure_exists` — `{ type }` checks world structures
- `bot_task_active` — `{ task }` checks if any bot has this assignment
- `bot_count` — `{ min }` checks total bot count
- `custom` — `{ fn }` calls a custom predicate function

---

## Implementation Phases

### Phase 1: Quest Engine (foundation)
- `src/systems/quest-system.js` — quest state machine: tracks active quest/step, evaluates completion conditions, triggers dialogues via the dialogue system
- Quest progress persisted in save game (`exportSave`/`importSave`)
- `window.gameQuestDebug` hooks for Playwright testing
- Wire Quest 1 (arrival dialogue already exists from dialogue feature)

### Phase 2: Quest 2-4 (core buildings + tools + bots)
- Add inventory/structure/craft completion conditions
- Add build-menu gating (can't place sawbench until Quest 2 unlocks it)
- Add item rewards (quest completion spawns items/knowledge packs)

### Phase 3: Quest 5-6 (teach-by-doing + delegation)
- Hook into recorder events, bot assignment events, manager promotion events
- This completes the tutorial — player has full toolchain understanding

### Phase 4: Act II quests (expansion content)
- Mining, farming, combat, bot assembly
- Each is a self-contained quest with the same engine

---

## Complexity Curve (Visual)

```
Complexity
    │
    │                                    ╱── Act II: Combat + Army
    │                              ╱───── Act II: Farming
    │                        ╱───── Act II: Smithing
    │                  ╱───── Q6: Manager delegation
    │            ╱───── Q5: Teach-by-doing loop
    │      ╱───── Q4: Bot commands
    │  ╱───── Q3: Tools + workbench
    │─ Q2: Sawbench (build + process)
    │─ Q1: Chop tree (movement + gather)
    └─────────────────────────────────────── Time
```

Each step adds **exactly one** new mechanic. The player is never holding more than one new idea in their head at a time.

---

## Why This Works

1. **The player feels the pain before the cure.** Quest 1-3 makes manual gathering feel slow and tedious. Quest 4-5 reveals that bots + loops eliminate that tedium. The payoff lands because the setup was earned.

2. **Each building is introduced in isolation.** Sawbench alone (Q2). Workbench alone (Q3). The player masters one before seeing the next.

3. **The processing pipeline (input → process → output) is taught once in Q2** and then every subsequent building is just "another version of that." Smithy, bowmaker, arrowmaker — all follow the same mental model.

4. **Automation is the climax, not the starting point.** Many automation games throw bots at the player immediately. Here, the player must first understand the *task* before they can automate it. Teach-by-doing is literally the player teaching a bot what they already learned to do.

5. **Combat waits until the end.** Monsters at night are a stress test, not a tutorial topic. By the time they appear, the player has automated defenses (guard bots, patrol routes) ready to deploy.
