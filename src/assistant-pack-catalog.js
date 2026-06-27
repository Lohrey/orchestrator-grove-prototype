import { actionStepOpsForPack } from './action-steps.js?v=t_building_kits_0618';

export const ASSISTANT_KNOWLEDGE_PACKS = {
  starter_automation: {
    id: 'starter_automation',
    name: 'Starter Automation',
    concepts: ['Bots repeat short JSON step loops.', 'Trust user-provided bot names/ids in requests; the game resolves them after JSON validation.', 'Use rename_bot to give the executing bot, or an explicitly targeted bot, a safe display name.', 'Use promote_to_manager to turn a bot into a manager with manager knowledge packs, and delegate_to_manager to send a short instruction to an existing manager bot.', 'Players can save teach-by-doing recordings as named templates and assign them later with assign_template.', 'Building kits are carried items such as sawbench_kit: pick_up a kit, deploy_building_kit to place it, or disassemble_building_to_kit to pack an existing building back into its matching kit.', 'End repeating work with {"op":"loop"}.', 'The player can act like a one-slot storage building for automation: use deposit_to_player to bring an item to the player, and take_from_player to take one carried item from the player.'],
    vocabulary: ['bot', 'loop', 'repeat', 'keep doing', 'idle', 'stop', 'player', 'me', 'bring', 'give', 'take from player', 'building kit', 'kit', 'deploy', 'disassemble', 'pack up', 'rename', 'name', 'call', 'manager', 'promote', 'delegate'],
    optionalContext: ['availableBotNames', 'availableTemplateNames', 'availableItemTypes', 'currentPlayerInventory'],
    unlockedOps: actionStepOpsForPack('starter_automation'),
    examples: [
      { intent: 'bot 1 pick up logs forever', dsl: { steps: [{ op: 'pick_up', type: 'log' }, { op: 'loop' }] } },
      { intent: 'bot 1 bring log to me', dsl: { steps: [{ op: 'pick_up', type: 'log' }, { op: 'deposit_to_player', type: 'log' }, { op: 'loop' }] } },
      { intent: 'bot 1 take stone from me', dsl: { steps: [{ op: 'take_from_player', type: 'stone' }, { op: 'loop' }] } },
      { intent: 'bot 1 rename to Lumberjack', dsl: { steps: [{ op: 'rename_bot', name: 'Lumberjack' }, { op: 'loop' }] } },
      { intent: 'promote bot 1 to manager', dsl: { steps: [{ op: 'promote_to_manager', knowledgePacks: ['starter_automation'] }, { op: 'loop' }] } },
      { intent: 'delegate to manager Guard: make bot 2 chop trees', dsl: { steps: [{ op: 'delegate_to_manager', recipient: 'Guard', message: 'make bot 2 chop trees' }, { op: 'loop' }] } },
      { intent: 'bot 1 deploy a sawbench kit here', dsl: { steps: [{ op: 'pick_up', type: 'sawbench_kit' }, { op: 'deploy_building_kit', type: 'sawbench_kit' }, { op: 'loop' }] } },
      { intent: 'bot 1 disassemble workbench 1 into a kit', dsl: { steps: [{ op: 'disassemble_building_to_kit', target: 'workbench 1' }, { op: 'drop_item' }, { op: 'loop' }] } },
      { intent: 'bot 1 assign Bot 2 the Feed sawbench template', dsl: { steps: [{ op: 'assign_template', bot: 2, templateName: 'Feed sawbench' }, { op: 'loop' }] } }
    ]
  },
  woodworking: {
    id: 'woodworking',
    name: 'Woodworking',
    concepts: ['Logs feed sawbenches.', 'A sawbench turns logs into planks and planks into poles.'],
    vocabulary: ['log', 'wood', 'sawbench', 'saw bench', 'plank', 'board', 'pole'],
    optionalContext: ['availableBuildingNames'],
    unlockedOps: actionStepOpsForPack('woodworking'),
    examples: [
      { intent: 'bot 1 keep sawbench full of logs', dsl: { steps: [{ op: 'pick_up', type: 'log' }, { op: 'deposit_to_structure', type: 'log', target: 'sawbench 1' }, { op: 'loop' }] } }
    ]
  },
  logistics: {
    id: 'logistics',
    name: 'Logistics',
    concepts: ['Item palettes are storage sources.', 'Use the building name from the request as source/target; the game resolves it after JSON validation.'],
    vocabulary: ['haul', 'feed', 'fill', 'storage', 'palette', 'from', 'to'],
    optionalContext: ['availableBuildingNames', 'availableItemTypes'],
    unlockedOps: actionStepOpsForPack('logistics'),
    examples: [
      { intent: 'take logs from storage to sawbench', dsl: { steps: [{ op: 'pick_up_from_storage', type: 'log', source: 'item palette 1' }, { op: 'deposit_to_structure', type: 'log', target: 'sawbench 1' }, { op: 'loop' }] } }
    ]
  },
  farming: {
    id: 'farming',
    name: 'Farming',
    concepts: ['Tree seeds can be planted in open dug holes.', 'Searching trees finds sticks and tree seeds.'],
    vocabulary: ['plant', 'seed', 'tree seed', 'dug hole', 'search tree'],
    optionalContext: ['availableItemTypes'],
    unlockedOps: actionStepOpsForPack('farming'),
    examples: [
      { intent: 'bot 1 plant tree seeds', dsl: { steps: [{ op: 'pick_up', type: 'tree_seed' }, { op: 'plant_seed' }, { op: 'loop' }] } }
    ]
  },
  mining_tools: {
    id: 'mining_tools',
    name: 'Mining + Tools',
    concepts: ['Stone deposits produce stone when mined.', 'Hemp can be searched or chopped for seeds/fiber.'],
    vocabulary: ['mine', 'stone', 'rock', 'pickaxe', 'hemp', 'search hemp'],
    optionalContext: ['availableItemTypes'],
    unlockedOps: actionStepOpsForPack('mining_tools'),
    examples: [
      { intent: 'bot 1 mine stone', dsl: { steps: [{ op: 'mine_stone' }, { op: 'loop' }] } }
    ]
  },
  combat: {
    id: 'combat',
    name: 'Follow + Combat',
    concepts: ['Bot names/refs can be used as variables for multi-bot follow or attack requests.', 'Use rename_bot for squad-friendly combat labels like Guard or Patrol.', 'Use follow to keep a bot near me/player or another bot.', 'Use guard_area to hold a zone/current post: bots attack hostiles in/near the guard area, then return to the guard center.', 'Use patrol_route with JSON points to cycle checkpoints and interrupt the route to attack nearby threats.', 'Use equip_item only for weaponry (sword, shield, bow); tools/resources are not valid equipment actions.', 'Use craft_smithery for wooden_sword/wooden_shield, craft_bowmaker for bow, and craft_arrowmaker for arrow packs that already exist in the game.', 'Use arrowmaker to fletch arrow packs from sticks and stone, then load them with equip_item by picking up the finished arrow pack.', 'Use attack for hostile targets, monster types, or combat zones. zone:"nearby" creates a moving search radius around each assigned bot; set radius to override, e.g. 500.'],
    vocabulary: ['rename', 'name', 'call', 'follow', 'escort', 'guard', 'patrol', 'checkpoint', 'route', 'equip', 'weapon', 'sword', 'shield', 'bow', 'arrow', 'arrow pack', 'arrowmaker', 'smithery', 'bowmaker', 'attack', 'fight', 'kill', 'hunt', 'monster', 'enemy', 'nearby', 'radius'],
    optionalContext: ['availableBotNames', 'availableMonsterTypes'],
    unlockedOps: actionStepOpsForPack('combat'),
    examples: [
      { intent: 'Bot 1 and Bot 2 follow me', dsl: { steps: [{ op: 'follow', target: 'me' }, { op: 'loop' }] } },
      { intent: 'Rename bot 2 to Guard', dsl: { steps: [{ op: 'rename_bot', name: 'Guard' }, { op: 'loop' }] } },
      { intent: 'Bot 1 guard nearby radius 240', dsl: { steps: [{ op: 'guard_area', zone: 'nearby', radius: 240 }, { op: 'loop' }] } },
      { intent: 'Bot 2 patrol between two checkpoints', dsl: { steps: [{ op: 'patrol_route', points: [{ x: 320, y: 320 }, { x: 480, y: 320 }], radius: 180 }, { op: 'loop' }] } },
      { intent: 'Bot 3 equip sword', dsl: { steps: [{ op: 'equip_item', type: 'sword' }, { op: 'loop' }] } },
      { intent: 'Bot 1 craft shield at smithery 1', dsl: { steps: [{ op: 'craft_smithery', recipe: 'shield', target: 'smithery 1' }, { op: 'loop' }] } },
      { intent: 'Bot 1 attack nearby monsters within 500', dsl: { steps: [{ op: 'attack', type: 'monster', zone: 'nearby', radius: 500 }, { op: 'loop' }] } },
      { intent: 'Bot 1 fletch arrow packs at arrowmaker 1', dsl: { steps: [{ op: 'craft_arrowmaker', recipe: 'arrow_pack', target: 'arrowmaker 1' }, { op: 'loop' }] } }
    ]
  },
  dog_fetch: {
    id: 'dog_fetch',
    name: 'Dog Fetch',
    custom: true,
    concepts: ['The assigned bot is always the dog.', 'Use pick_up for the chosen nearby item, then use follow to bring it back to the player.', 'Praise teaches the dog which item type to prefer next time; after 10 praises, that item is chosen every time it is available.'],
    vocabulary: ['dog', 'fetch', 'praise', 'good dog', 'pick up', 'follow', 'stick', 'log', 'plank', 'stone', 'random nearby item'],
    optionalContext: ['availableItemTypes'],
    unlockedOps: actionStepOpsForPack('starter_automation').filter(op => ['pick_up', 'follow'].includes(op)),
    examples: [
      { intent: 'Dog fetch a stick', dsl: { steps: [{ op: 'pick_up', type: 'stick' }, { op: 'follow', target: 'me' }, { op: 'loop' }] } }
    ]
  }
};

export const DEFAULT_ASSISTANT_LOADOUT = ['starter_automation', 'woodworking', 'logistics', 'farming', 'mining_tools', 'combat'];
