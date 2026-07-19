# Orchestrator Grove — Quest Plan v2 (Next 20 Quests)

> **Status:** Implemented — Q10–Q29 are live in the campaign.
> **Implementation:** Commit pending — see `src/campaign/campaign-quest.js` (quest engine), `src/campaign-scenes.js` (dialogues), `src/main.js` (QUEST_INFO + quest log UI).
> **Follows:** Quests 1–9 (tag `grove_quests_0705`), which end with the camp "self-sustaining": logs stored, a chopping bot running, and seeds planted in a new grove.
> **Scope:** 20 new quests (Q10–Q29) organized into 4 chapters, introducing every major game system not covered by the tutorial.

---

## Where the Player Is After Quest 9

| Asset | State |
|---|---|
| **Resources** | ~10 logs in storage, 5 planted tree seeds, natural trees/hemp/stone on map |
| **Structures** | 1× item_palette (storage), camper van |
| **Bots** | 1 bot assigned to chop wood (taught by doing) |
| **Tools** | crude_axe (on ground or stored), crude_shovel (on ground) |
| **Knowledge** | Player understands: movement, right-click interact, chop, dig, plant, teach-by-doing, storage deposit |
| **Not yet introduced** | Sawbench, workbench, smithery, bowmaker, arrowmaker, defense tower, factory, mining, crafting, equipment, combat, knowledge packs, managers, hemp harvesting, bow/ammunition |

---

## Design Principles (carried forward from v1)

1. **One new concept per quest** — never two unfamiliar systems at once
2. **Manual first, automate second** — the player does the task by hand before teaching a bot
3. **Reward = capability** — completing a quest unlocks the building/item/pack needed for the next
4. **Van as progression gate** — continues to drop building kits/tools at key milestones (or transitions to a new delivery mechanism for Chapter IV+)
5. **Each chapter has a narrative arc** — not just a checklist, but a story beat with a beginning, tension, and resolution
6. **Pacing** — 3–5 min per quest, ~60–80 min for all 20

---

## Chapter Map

| Chapter | Theme | Quests | Core Systems Introduced |
|---|---|---|---|
| **II — Industry** | Processing & crafting | Q10–Q15 | Sawbench, planks/poles, workbench, tool crafting, mining, pickaxe |
| **III — Automation at Scale** | Multi-bot orchestration | Q16–Q19 | Knowledge packs, manager delegation, bot factory, bot assembly |
| **IV — Arms & Defense** | Combat readiness | Q20–Q25 | Smithery, sword/shield, defense tower, bowmaker, arrowmaker, equipment, first night attack |
| **V — The Garrison** | Sustained defense & expansion | Q26–Q29 | Patrol routes, guard zones, monster waves, hemp/bow combat, multi-front automation |

---

## Chapter II — Industry (Q10–Q15)

> **Narrative:** The camp has wood, but raw logs aren't enough. The player learns the **input → process → output** pipeline that is the heart of the entire game. Each building is introduced in isolation before being automated.

---

### Quest 10: "Plank Time"
**New concept:** Sawbench — the first processing building (logs → planks)

| Field | Detail |
|---|---|
| **Objective** | Unpack the sawbench kit from the van, place it, and process 1 log into planks |
| **Trigger** | Quest 9 complete (`quest9_complete` dialogue dismissed) |
| **Steps** | 1) Right-click van to unpack sawbench kit → 2) Pick up kit, place sawbench → 3) Deposit a log → 4) Collect the output plank |
| **Completion** | `planksProduced >= 1` (player has held or stored ≥1 plank) |
| **Reward** | Van now contains a workbench kit for Quest 12 |
| **Dialogue** | *"Raw logs are bulky. A sawbench turns them into planks — the real building blocks. Unpack it from the van and set it up."* |
| **Progression fit** | Introduces the core processing loop (input → wait → output). Every subsequent building reuses this pattern. |

---

### Quest 11: "From Planks to Poles"
**New concept:** Secondary processing (planks → poles at the sawbench)

| Field | Detail |
|---|---|
| **Objective** | Process planks into poles at the sawbench |
| **Trigger** | Quest 10 complete |
| **Steps** | 1) Deposit a plank into the sawbench → 2) Collect the output pole |
| **Completion** | `polesProduced >= 1` |
| **Reward** | Knowledge: poles are a crafting ingredient for workbench tools |
| **Dialogue** | *"Planks can go further — feed them back into the sawbench to split into poles. Thinner, lighter, perfect for tool handles."* |
| **Progression fit** | Teaches that a single building can have multiple recipes. Sets up the ingredient chain: log → plank → pole. |

---

### Quest 12: "A Proper Workbench"
**New concept:** Workbench — the tool crafting building

| Field | Detail |
|---|---|
| **Objective** | Unpack the workbench kit from the van, place it |
| **Trigger** | Quest 11 complete |
| **Steps** | 1) Right-click van to unpack workbench kit → 2) Pick up kit → 3) Place workbench near the sawbench |
| **Completion** | `structureExists('workbench')` |
| **Reward** | Workbench is now available for crafting |
| **Dialogue** | *"The van has a workbench kit. With planks, poles, and sticks, we can craft proper tools — not just that crude axe."* |
| **Progression fit** | Introduces the crafting tier. The workbench is where all hand tools are made. |

---

### Quest 13: "Craft a Pickaxe"
**New concept:** Tool crafting (sticks + stone → crude_pickaxe at the workbench)

| Field | Detail |
|---|---|
| **Objective** | Gather materials and craft a crude_pickaxe at the workbench |
| **Trigger** | Quest 12 complete |
| **Steps** | 1) Deposit sticks into workbench → 2) Deposit stone into workbench → 3) Craft pickaxe → 4) Pick up the crafted pickaxe |
| **Completion** | `playerHasItem('crude_pickaxe')` or `itemCrafted('crude_pickaxe')` |
| **Reward** | Pickaxe enables fast stone mining (3s vs 30s by hand) |
| **Dialogue** | *"A pickaxe! Now mining stone won't take all day. Deposit sticks and stone into the workbench to craft one."* |
| **Progression fit** | First crafted tool. Teaches the crafting recipe pattern (multiple inputs → one output). The pickaxe gates mining speed. |

---

### Quest 14: "Strike the Earth"
**New concept:** Stone mining (manual, with pickaxe)

| Field | Detail |
|---|---|
| **Objective** | Equip the pickaxe and mine stone from a stone deposit |
| **Trigger** | Quest 13 complete |
| **Steps** | 1) Equip crude_pickaxe → 2) Right-click a stone deposit → 3) Mine until stone drops |
| **Completion** | `stoneMined >= 1` (player has held ≥1 stone) |
| **Reward** | Stone unlocks smithery recipes (sword, shield) |
| **Dialogue** | *"Those rock deposits have been sitting there since we arrived. Equip the pickaxe and right-click one — let's see what's inside."* |
| **Progression fit** | Introduces the last manual gathering skill. Player now knows all three raw resources: wood, stone, and (from Q9) seeds. |

---

### Quest 15: "Automate the Mill"
**New concept:** Teaching a bot a multi-step production loop (sawbench automation)

| Field | Detail |
|---|---|
| **Objective** | Teach a bot to pick up logs, deposit into the sawbench, and repeat |
| **Trigger** | Quest 14 complete |
| **Steps** | 1) Open teach-by-doing panel on a second bot → 2) Record: pick_up log → move_to sawbench → deposit → loop → 3) Assign loop to bot |
| **Completion** | `botRunningSawbenchLoop` (a bot has a taught_loop containing `deliver_to_sawbench`) |
| **Reward** | Planks now produce automatically — the first automated supply chain |
| **Dialogue** | *"You're hauling logs by hand again. Teach a bot to do it — pick up a log, carry it to the sawbench, deposit. Record that loop and assign it."* |
| **Progression fit** | Reinforces teach-by-doing with a more complex chain (3 steps). The payoff: passive plank production. This is the template for all future automation. |

---

## Chapter III — Automation at Scale (Q16–Q19)

> **Narrative:** The camp works, but it's small. The player learns to scale: knowledge packs unlock new bot capabilities, managers coordinate multiple workers, and the bot factory produces new bots from raw materials. The game shifts from "I do everything" to "I design systems."

---

### Quest 16: "Knowledge Is Power"
**New concept:** Knowledge packs — promoting a bot with the Woodworking pack

| Field | Detail |
|---|---|
| **Objective** | Promote a bot with the `woodworking` knowledge pack |
| **Trigger** | Quest 15 complete |
| **Steps** | 1) Open bot menu → 2) Select knowledge packs → 3) Add `woodworking` → 4) Confirm |
| **Completion** | `botHasPack('woodworking')` |
| **Reward** | Bot can now process planks/poles and perform sawbench operations autonomously |
| **Dialogue** | *"Your bots only know basic tasks. Knowledge packs teach them new skills. Give one the Woodworking pack — it'll learn to run the sawbench on its own."* |
| **Progression fit** | Introduces the specialization system. Knowledge packs are the "tech tree" for bots — each pack unlocks a category of action steps. |

---

### Quest 17: "The Full Chain"
**New concept:** Multi-bot production chain (chop → sawbench → storage, fully automated)

| Field | Detail |
|---|---|
| **Objective** | Have one bot chopping wood and another running planks at the sawbench, simultaneously |
| **Trigger** | Quest 16 complete |
| **Steps** | 1) Verify chop bot is running → 2) Assign a woodworking bot to process sawbench → 3) (Optional) Assign a third bot to haul planks to storage |
| **Completion** | `activeBotsWithPrograms >= 2` AND `sawbenchHasProcessedRecently` (at least 2 planks produced by bots in the last 60s) |
| **Reward** | Automated plank supply chain operational |
| **Dialogue** | *"Two bots, two jobs: one chops, one mills. Watch the planks pile up without lifting a finger. This is what the camp is supposed to feel like."* |
| **Progression fit** | The "aha" moment of multi-bot orchestration. The player sees the compound value of automation — each bot multiplies the others. |

---

### Quest 18: "Delegate"
**New concept:** Manager bots — promote a bot to manager and delegate tasks

| Field | Detail |
|---|---|
| **Objective** | Promote a bot to Manager and delegate a task to it |
| **Trigger** | Quest 17 complete |
| **Steps** | 1) Open bot menu on a bot → 2) Promote to Manager → 3) Delegate a task (e.g., "tell worker 2 to haul logs") |
| **Completion** | `managerDelegationActive` (a manager bot has at least one delegated task) |
| **Reward** | Manager bot coordinates workers automatically — the player no longer needs to assign each bot individually |
| **Dialogue** | *"Too many bots to manage one by one? Make one a Manager. It'll delegate tasks to the others for you. Try it — promote a bot and tell it to assign work."* |
| **Progression fit** | The final layer of the automation hierarchy: player → manager → workers. Completes the "automation design" skill set. |

---

### Quest 19: "Build Your Own Bot"
**New concept:** Bot Factory / Assembler — assemble a new bot from raw materials

| Field | Detail |
|---|---|
| **Objective** | Unpack the factory kit from the van, place it, supply it with materials, and assemble a new bot |
| **Trigger** | Quest 18 complete |
| **Steps** | 1) Right-click van to unpack factory kit → 2) Place factory → 3) Deposit materials (1 log + 3 planks + 1 pole + 1 tree_seed) → 4) Wait for assembly → 5) New bot spawns |
| **Completion** | `totalBots >= 2` (player-built bot exists) |
| **Reward** | +1 bot for the workforce; the factory is now a permanent structure for scaling up |
| **Dialogue** | *"The van has one more thing — a bot factory. Feed it logs, planks, poles, and a seed, and it will assemble a brand new worker. Build your team."* |
| **Progression fit** | Introduces the self-replicating loop: bots gather materials → factory builds more bots → more bots gather more materials. This is the endgame scaling mechanic. |

---

## Chapter IV — Arms & Defense (Q20–Q25)

> **Narrative:** Night is coming. Strange sounds from the dark. The player must learn to craft weapons, build defenses, and fight. This chapter transforms the peaceful automation sandbox into a survival-strategy hybrid.

---

### Quest 20: "Forge of Shadows"
**New concept:** Smithery — the weapon crafting building

| Field | Detail |
|---|---|
| **Objective** | Unpack the smithery kit from the van and place it |
| **Trigger** | Quest 19 complete |
| **Steps** | 1) Right-click van to unpack smithery kit → 2) Pick up kit → 3) Place smithery near the workbench |
| **Completion** | `structureExists('smithery')` |
| **Reward** | Smithery available for weapon crafting |
| **Dialogue** | *"Something is out there. I've heard it at night. We need to be ready. The van has a smithery — set it up."* |
| **Progression fit** | Tone shift. The smithery introduces the military category of buildings. Stones (from Q14) are the key ingredient. |

---

### Quest 21: "Arm Yourself"
**New concept:** Weapon crafting + equipment system (wooden_sword + wooden_shield)

| Field | Detail |
|---|---|
| **Objective** | Craft a wooden_sword and a wooden_shield at the smithery, then equip both |
| **Trigger** | Quest 20 complete |
| **Steps** | 1) Deposit planks + stone into smithery → 2) Craft wooden_sword → 3) Craft wooden_shield → 4) Equip both |
| **Completion** | `playerEquipped('wooden_sword')` AND `playerEquipped('wooden_shield')` |
| **Reward** | Player can now melee-attack monsters (auto-attack triggers on proximity) |
| **Dialogue** | *"Planks and stone into the smithery. A sword to strike, a shield to block. Equip both — you'll attack automatically when enemies get close."* |
| **Progression fit** | Introduces the equipment system. Combat auto-attacks when enemies are in range (player attack speed: 1 hit/sec). |

---

### Quest 22: "The Long Night"
**New concept:** Night monsters — survive the first night attack

| Field | Detail |
|---|---|
| **Objective** | Survive a night cycle while monsters are active (don't die) |
| **Trigger** | Quest 21 complete |
| **Steps** | 1) Wait for nightfall (or night is already approaching) → 2) Monsters spawn from the dark → 3) Fight them off (auto-attack) or avoid them until dawn |
| **Completion** | `survivedNight` (dayNight cycle returns to day with player HP > 0) |
| **Reward** | Player understands the threat; the next quests build permanent defenses |
| **Dialogue** | *"They come at night. Stay near the fire, keep your sword ready. Just survive until dawn."* (multi-page: page 2 after surviving: *"Dawn. They're gone. But they'll be back. We need walls. We need towers."*) |
| **Progression fit** | First combat encounter. Teaches the threat without overwhelming — the player just needs to survive, not win decisively. Sets up the urgency for defense infrastructure. |

---

### Quest 23: "Watchtower"
**New concept:** Defense Tower — automated ranged defense building

| Field | Detail |
|---|---|
| **Objective** | Build a defense tower near the camp perimeter |
| **Trigger** | Quest 22 complete |
| **Steps** | 1) Open build menu → 2) Place defense tower → 3) (Optional) Place a second tower |
| **Completion** | `structureExists('defensetower')` |
| **Reward** | Tower auto-fires arrows at hostile targets in range (260px, 1 damage/sec) |
| **Dialogue** | *"A defense tower fires arrows on its own — no bot needed. Place one where the monsters came from last night."* |
| **Progression fit** | Introduces passive defense. The tower is the first building that acts autonomously without bot input — a new category of "always-on" structure. |

---

### Quest 24: "Combat Pack"
**New concept:** Combat knowledge pack + bot combat modes (aggressive/passive toggle)

| Field | Detail |
|---|---|
| **Objective** | Promote a bot with the `combat` knowledge pack and toggle it to aggressive |
| **Trigger** | Quest 23 complete |
| **Steps** | 1) Open bot menu → 2) Add `combat` pack → 3) Toggle combat mode to "aggressive" → 4) Equip the bot with a sword |
| **Completion** | `botHasPack('combat')` AND `bot.combatMode === 'aggressive'` |
| **Reward** | Combat bot auto-engages enemies within 500px, even while working — loop pauses, fight resumes, work continues |
| **Dialogue** | *"Bots can fight too. Give one the Combat pack and a sword. Toggle it to aggressive — it'll break from work to fight, then pick up where it left off."* |
| **Progression fit** | Introduces the combat overlay system: bots pause their production loop to fight, then resume. This is the key to having a self-defending camp. |

---

### Quest 25: "Bows and Arrows"
**New concept:** Ranged combat — bowmaker, arrowmaker, bow, arrow_pack, ammunition

| Field | Detail |
|---|---|
| **Objective** | Build a bowmaker and arrowmaker, craft a bow and arrow_pack, equip both |
| **Trigger** | Quest 24 complete |
| **Steps** | 1) Build bowmaker → 2) Build arrowmaker → 3) Deposit planks + poles into bowmaker → craft bow → 4) Deposit sticks + stone into arrowmaker → craft arrow_pack → 5) Equip bow → 6) Equip arrow_pack (sets ammunition to 10) |
| **Completion** | `playerEquipped('bow')` AND `player.ammunition > 0` |
| **Reward** | Player can now ranged-attack monsters; ammunition system understood |
| **Dialogue** | *"Swords are close-range. For distance, we need bows. Build a bowmaker and an arrowmaker. Craft a bow and arrow pack — equip the pack to load 10 arrows."* |
| **Progression fit** | Completes the weapons tech tree (melee: sword/shield, ranged: bow/arrows). Introduces ammunition as a consumable resource. |

---

## Chapter V — The Garrison (Q26–Q29)

> **Narrative:** The camp is armed, but the attacks are escalating. The player must coordinate multi-front defense: patrol routes, guard zones, and a bot army that can hold the perimeter while production continues inside. The finale is a sustained monster wave that tests everything learned.

---

### Quest 26: "Patrol Routes"
**New concept:** Patrol loop — teach a bot to walk a patrol route and engage threats

| Field | Detail |
|---|---|
| **Objective** | Teach a combat bot a patrol route with attack steps |
| **Trigger** | Quest 25 complete |
| **Steps** | 1) Open teach-by-doing on a combat bot → 2) Record patrol route (move to point A, move to point B, attack type:monster zone:nearby) → 3) Assign loop |
| **Completion** | `botHasPatrolLoop` (a bot has a taught_loop containing `patrol_route` or `attack` with `loop`) |
| **Reward** | Mobile defense — patrol bot sweeps the perimeter and engages threats |
| **Dialogue** | *"Towers are static. A patrol bot moves. Teach one to walk a route around the camp and attack anything hostile it finds. Record the waypoints and an attack step."* |
| **Progression fit** | Combines movement + combat in a single loop. The patrol pattern is the most sophisticated taught-loop yet — 4+ steps including conditional engagement. |

---

### Quest 27: "Guard the Gate"
**New concept:** Guard area — station a bot to defend a fixed zone

| Field | Detail |
|---|---|
| **Objective** | Assign a combat bot to `guard_area` at a chokepoint |
| **Trigger** | Quest 26 complete |
| **Steps** | 1) Select a combat bot → 2) Assign `guard_area` command with a center point and radius → 3) Bot holds position and intercepts threats within radius |
| **Completion** | `botOnGuardDuty` (a bot has `guard_area` assigned) |
| **Reward** | Static defense bot — holds a position and intercepts anything in its zone |
| **Dialogue** | *"A patrol sweeps. A guard holds. Assign a bot to guard a chokepoint — it'll stay put and intercept anything that enters its zone."* |
| **Progression fit** | Introduces the second combat command (`guard_area` vs `patrol_route`). Player now has three defense layers: towers (passive), guards (stationary active), patrols (mobile active). |

---

### Quest 28: "Scale the Ranks"
**New concept:** Mass bot production + full automation under fire

| Field | Detail |
|---|---|
| **Objective** | Use the factory to assemble 3+ new bots, assign them to production and combat roles |
| **Trigger** | Quest 27 complete |
| **Steps** | 1) Supply factory with materials → 2) Assemble 3 new bots → 3) Assign: 1 to production (chop/mill), 1 to patrol, 1 to guard → 4) Manager coordinates |
| **Completion** | `totalBots >= 5` AND `combatBots >= 2` (at least 2 bots with combat pack + aggressive mode) |
| **Reward** | A self-defending, self-sustaining camp with a military wing |
| **Dialogue** | *"The factory is the key. Build more bots. Some work, some fight. A manager can coordinate them all. Scale up — the camp needs to run itself while you command the defense."* |
| **Progression fit** | The culmination of the automation + combat systems. The player builds a mini-economy (production bots) and a mini-military (combat bots) and coordinates both via managers. |

---

### Quest 29: "Hold the Line"
**New concept:** Sustained defense — survive a multi-wave monster assault

| Field | Detail |
|---|---|
| **Objective** | Survive a sustained night assault (multiple spawn waves) with all critical structures intact |
| **Trigger** | Quest 28 complete |
| **Steps** | 1) Night falls → 2) Multiple monster waves spawn (increased `nightSpawns.spawnedThisNight`) → 3) Defense systems engage (towers, guards, patrols) → 4) Player assists as needed → 5) Survive until dawn with ≥1 production structure surviving |
| **Completion** | `survivedWaveNight` AND `structuresIntact` (no production building destroyed) |
| **Reward** | **Campaign finale** — the camp is now a self-sustaining, self-defending garrison. End-game sandbox unlocked. |
| **Dialogue** | *(multi-page finale)* Page 1: *"This is the big one. They're coming in waves. Hold the line."* Page 2 (on survival): *"Dawn. And the camp stands. Towers intact, bots still working, not a single structure lost."* Page 3: *"You've built something real here. A home that feeds itself, defends itself, grows itself. The grove is yours now."* |
| **Progression fit** | The capstone quest. Tests every system the player has learned: production chains (must keep running to supply arrows/repairs), automation (bots must work under fire), combat (player + bots + towers must coordinate), and strategy (where to place towers, which bots to assign where). Completing it proves mastery of the full game. |

---

## Complexity Curve

```
Complexity
    │
    │                                                          ╱── Q29: Wave defense (finale)
    │                                                    ╱───── Q28: Mass production + mil
    │                                              ╱───── Q27: Guard zones
    │                                        ╱───── Q26: Patrol routes
    │                                  ╱───── Q25: Bows + ammo
    │                            ╱───── Q24: Combat pack + bot combat
    │                      ╱───── Q23: Defense tower
    │                ╱───── Q22: First night survival
    │          ╱───── Q21: Sword + shield equip
    │    ╱───── Q20: Smithery
    │───── Q19: Bot factory
    │───── Q18: Manager delegation
    │───── Q17: Multi-bot chain
    │───── Q16: Knowledge packs
    │───── Q15: Automate sawbench
    │───── Q14: Mine stone
    │───── Q13: Craft pickaxe
    │───── Q12: Workbench
    │───── Q11: Planks → poles
    │───── Q10: Sawbench (first processing)
    └─────────────────────────────────────── Time →
     Chapter II          Chapter III        Chapter IV        Chapter V
     Industry            Automation Scale   Arms & Defense    The Garrison
```

---

## Van Unpack Schedule (Extended)

The van continues as the primary progression gate. New entries:

| Unpack # | Triggered by | Drops | Quest |
|---|---|---|---|
| 5 | Q10 start | `item_palette_kit` (sawbench) | Q10 |
| 6 | Q12 start | `item_palette_kit` (workbench) | Q12 |
| 7 | Q19 start | `item_palette_kit` (factory) | Q19 |
| 8 | Q20 start | `item_palette_kit` (smithery) | Q20 |

> **Note:** The bowmaker and arrowmaker (Q25) and defense tower (Q23) can be placed via the **build menu** (they're "free prototype" cost), so they don't need van drops. The van is reserved for "story kit" buildings that represent major narrative milestones.

---

## Completion Conditions — New Trigger Types Needed

The existing quest engine uses simple state flags (`vanUnpackCount`, `treesChopped`, etc.). The new quests need richer completion detection:

| Condition Type | Used By | Implementation |
|---|---|---|
| `structureExists(type)` | Q10, Q12, Q19, Q20, Q23 | Check `this.structures.some(s => s.type === type)` |
| `itemCrafted(type)` | Q13, Q21, Q25 | Hook into `finishStructureProcessing` when output matches |
| `playerHasItem(type)` | Q13, Q14 | Check `this.player.inventory?.type` |
| `playerEquipped(type)` | Q21, Q25 | Check `this.equipmentSummary(this.player)` |
| `stoneMined >= n` | Q14 | New counter, increment in `finishPlayerMineStone` |
| `planksProduced >= n` | Q10 | Track in sawbench processing completion |
| `polesProduced >= n` | Q11 | Track in pole processing completion |
| `botHasPack(packId)` | Q16, Q24 | Check `bot.knowledgePacks.includes(packId)` |
| `botRunningSawbenchLoop` | Q15 | Check bot's `taughtLoop` for `deliver_to_sawbench` op |
| `activeBotsWithPrograms >= n` | Q17 | Count `this.bots.filter(b => b.program && b.program !== 'idle')` |
| `managerDelegationActive` | Q18 | Check if any bot has `managerKnowledgePacks.length > 0` and a delegated task |
| `totalBots >= n` | Q19, Q28 | `this.bots.length` |
| `bot.combatMode === 'aggressive'` | Q24 | Check bot combat mode field |
| `botHasPatrolLoop` | Q26 | Check taught_loop for `patrol_route` or `attack` op |
| `botOnGuardDuty` | Q27 | Check for `guard_area` assignment |
| `survivedNight` | Q22 | Hook into dayNight cycle transition (night → day) with player alive |
| `survivedWaveNight` | Q29 | Same + increased spawn count + structure integrity check |

---

## Implementation Notes

1. **State object extension:** `this.campaignQuest` needs new counter fields: `planksProduced`, `polesProduced`, `stoneMined`, `swordsCrafted`, `shieldsCrafted`, `bowsCrafted`, `arrowPacksCrafted`, `botsAssembled`, `nightsSurvived`.

2. **Quest cap:** The current hard cap is `q.currentQuest > 9` → `q.active = false`. This must be extended to `> 29`.

3. **Night spawn scaling:** Quest 29 needs a "wave night" mode — increase `nightSpawns` spawn rate/count for that specific night. Add a `waveNightPending` flag set when Q29 starts.

4. **Build menu gating:** Currently all buildings are placeable from the start. For tighter progression, consider gating building placement behind quest completion (e.g., can't place a smithery until Q20). This is optional but improves the "one new concept per quest" principle.

5. **Dialogue count:** ~40–50 new dialogue entries needed (2–3 per quest: start prompt, mid-progress, completion).

6. **Quest log UI:** The `QUEST_INFO` array in `main.js` needs 20 new entries. Consider pagination or chapter grouping in the quest log drawer for display.

---

## Summary Table

| Q# | Title | Chapter | Core Concept | Key Reward |
|---|---|---|---|---|
| 10 | Plank Time | II | Sawbench (logs→planks) | First processing building |
| 11 | From Planks to Poles | II | Secondary processing (planks→poles) | Pole ingredient unlocked |
| 12 | A Proper Workbench | II | Workbench placement | Tool crafting available |
| 13 | Craft a Pickaxe | II | Tool crafting recipe | Pickaxe (fast mining) |
| 14 | Strike the Earth | II | Manual stone mining | Stone resource unlocked |
| 15 | Automate the Mill | II | Bot production loop | Automated plank supply |
| 16 | Knowledge Is Power | III | Knowledge packs (Woodworking) | Bot specialization |
| 17 | The Full Chain | III | Multi-bot production chain | Compound automation |
| 18 | Delegate | III | Manager bot + delegation | Hands-off coordination |
| 19 | Build Your Own Bot | III | Bot Factory assembly | Self-replicating bots |
| 20 | Forge of Shadows | IV | Smithery placement | Weapon crafting available |
| 21 | Arm Yourself | IV | Sword + shield craft + equip | Melee combat ready |
| 22 | The Long Night | IV | First night survival | Threat understood |
| 23 | Watchtower | IV | Defense Tower | Passive ranged defense |
| 24 | Combat Pack | IV | Combat pack + aggressive mode | Combat bot auto-defense |
| 25 | Bows and Arrows | IV | Bowmaker + arrowmaker + ammo | Ranged combat ready |
| 26 | Patrol Routes | V | Patrol loop + attack step | Mobile defense |
| 27 | Guard the Gate | V | Guard area assignment | Stationary defense |
| 28 | Scale the Ranks | V | Mass bot production + mil | Self-defending camp |
| 29 | Hold the Line | V | Sustained wave defense | **Campaign finale** |

---

*Document version: v2-draft · Created: 2026-07-06 · Precedes implementation of Q10–Q29*
