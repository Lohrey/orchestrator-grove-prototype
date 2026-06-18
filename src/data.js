import {
  ACTION_STEP_ORDER,
  ACTION_STEP_REGISTRY,
  actionStepChainRows,
  actionStepOpsForPack,
  actionStepWikiActions
} from './action-steps.js?v=t_building_kits_0618';

export const PROGRAMS = ['chop_wood', 'mine_stone', 'dig_holes', 'pickup_item', 'plant_trees', 'haul_logs', 'make_planks', 'make_poles', 'haul_planks', 'craft_axes', 'build_bots', 'taught_loop', 'idle'];
export const ACTION_STEPS = ACTION_STEP_REGISTRY;
export const ALLOWED_OPS = ACTION_STEP_ORDER;

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
      { intent: 'bot 1 disassemble workbench 1 into a kit', dsl: { steps: [{ op: 'disassemble_building_to_kit', target: 'workbench 1' }, { op: 'drop_item', type: 'workbench_kit' }, { op: 'loop' }] } },
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
    concepts: ['Bot names/refs can be used as variables for multi-bot follow or attack requests.', 'Use rename_bot for squad-friendly combat labels like Guard or Patrol.', 'Use follow to keep a bot near me/player or another bot.', 'Use guard_area to hold a zone/current post: bots attack hostiles in/near the guard area, then return to the guard center.', 'Use patrol_route with JSON points to cycle checkpoints and interrupt the route to attack nearby threats.', 'Use equip_item only for weaponry (sword, shield, bow); tools/resources are not valid equipment actions.', 'Use craft_smithery for wooden_sword/wooden_shield and craft_bowmaker for bow recipes that already exist in the game.', 'Use attack for hostile targets, monster types, or combat zones. zone:"nearby" creates a moving search radius around each assigned bot; set radius to override, e.g. 500.'],
    vocabulary: ['rename', 'name', 'call', 'follow', 'escort', 'guard', 'patrol', 'checkpoint', 'route', 'equip', 'weapon', 'sword', 'shield', 'bow', 'smithery', 'bowmaker', 'attack', 'fight', 'kill', 'hunt', 'monster', 'enemy', 'nearby', 'radius'],
    optionalContext: ['availableBotNames', 'availableMonsterTypes'],
    unlockedOps: actionStepOpsForPack('combat'),
    examples: [
      { intent: 'Bot 1 and Bot 2 follow me', dsl: { steps: [{ op: 'follow', target: 'me' }, { op: 'loop' }] } },
      { intent: 'Rename bot 2 to Guard', dsl: { steps: [{ op: 'rename_bot', name: 'Guard' }, { op: 'loop' }] } },
      { intent: 'Bot 1 guard nearby radius 240', dsl: { steps: [{ op: 'guard_area', zone: 'nearby', radius: 240 }, { op: 'loop' }] } },
      { intent: 'Bot 2 patrol between two checkpoints', dsl: { steps: [{ op: 'patrol_route', points: [{ x: 320, y: 320 }, { x: 480, y: 320 }], radius: 180 }, { op: 'loop' }] } },
      { intent: 'Bot 3 equip sword', dsl: { steps: [{ op: 'equip_item', type: 'sword' }, { op: 'loop' }] } },
      { intent: 'Bot 1 craft shield at smithery 1', dsl: { steps: [{ op: 'craft_smithery', recipe: 'shield', target: 'smithery 1' }, { op: 'loop' }] } },
      { intent: 'Bot 1 attack nearby monsters within 500', dsl: { steps: [{ op: 'attack', type: 'monster', zone: 'nearby', radius: 500 }, { op: 'loop' }] } }
    ]
  }
};

export const DEFAULT_ASSISTANT_LOADOUT = ['starter_automation', 'woodworking', 'logistics', 'farming', 'mining_tools', 'combat'];

export const PROGRAM_TEMPLATES = {
  chop_wood: {
    id: 'chop_wood', name: 'Chop Wood',
    description: 'Find living trees inside an optional zone, move there, chop, repeat.',
    slots: {
      zone: { kind: 'zone', optional: true, description: 'Search area for trees, e.g. zone 1 or radius around sawbench 2.' }
    },
    steps: [
      { op: 'find_nearest_tree', zone: '$zone' },
      { op: 'move_to_target' },
      { op: 'chop_tree' },
      { op: 'loop' }
    ]
  },
  mine_stone: {
    id: 'mine_stone', name: 'Mine Stone',
    description: 'Equip a crude pickaxe, mine stone deposits inside an optional zone, drop loose stone, repeat.',
    slots: {
      zone: { kind: 'zone', optional: true, description: 'Search area for stone deposits, e.g. rect(x:100,y:200,w:80,h:60).' }
    },
    steps: [
      { op: 'find_stone_deposit', zone: '$zone' },
      { op: 'move_to_target' },
      { op: 'mine_stone' },
      { op: 'loop' }
    ]
  },
  dig_holes: {
    id: 'dig_holes', name: 'Dig Holes',
    description: 'Equip a crude shovel, find open dirt inside an optional zone, dig holes, repeat.',
    slots: {
      zone: { kind: 'zone', optional: true, description: 'Area to dig holes in, e.g. zone 1 or small area around sawbench 1.' }
    },
    steps: [
      { op: 'find_dig_spot', zone: '$zone' },
      { op: 'move_to_target' },
      { op: 'dig_hole' },
      { op: 'loop' }
    ]
  },
  pickup_item: {
    id: 'pickup_item', name: 'Pick Up Item',
    description: 'Pick a chosen item type from a selected item palette or from loose ground items inside an optional rectangle/radius zone.',
    slots: {
      itemType: { kind: 'item', optional: false, description: 'Item to pick up, e.g. log, plank, stone, crude_axe, crude_hammer.' },
      sourcePalette: { kind: 'structure', type: 'item_palette', optional: true, description: 'Storage source if picking from a palette.' },
      zone: { kind: 'zone', optional: true, description: 'Ground search area, including inserted rect(x,y,w,h) coordinates.' }
    },
    steps: [
      { op: 'if_inventory', type: '$itemType', goto: 4 },
      { op: 'pick_up_from_storage', type: '$itemType', source: '$sourcePalette' },
      { op: 'find_item', type: '$itemType', zone: '$zone' },
      { op: 'pick_up_specific', type: '$itemType' },
      { op: 'loop' }
    ]
  },
  plant_trees: {
    id: 'plant_trees', name: 'Plant Trees',
    description: 'Carry tree seeds to open dug holes inside an optional zone, plant them, repeat.',
    slots: {
      zone: { kind: 'zone', optional: true, description: 'Area containing open holes and loose tree seeds.' }
    },
    steps: [
      { op: 'if_inventory', type: 'tree_seed', goto: 3 },
      { op: 'find_item', type: 'tree_seed', zone: '$zone' },
      { op: 'pick_up', type: 'tree_seed' },
      { op: 'find_dug_hole', zone: '$zone' },
      { op: 'move_to_target' },
      { op: 'plant_seed' },
      { op: 'loop' }
    ]
  },
  haul_logs: {
    id: 'haul_logs', name: 'Haul Logs',
    description: 'Pick loose logs from an optional zone and deliver to a selected sawbench.',
    slots: {
      targetSawbench: { kind: 'structure', type: 'sawbench', optional: true, description: 'Destination sawbench.' },
      zone: { kind: 'zone', optional: true, description: 'Search area for loose logs.' }
    },
    steps: [
      { op: 'if_inventory', type: 'log', goto: 3 },
      { op: 'find_item', type: 'log', zone: '$zone' },
      { op: 'pick_up', type: 'log' },
      { op: 'deliver_to_sawbench', type: 'log', target: '$targetSawbench' },
      { op: 'loop' }
    ]
  },
  make_planks: {
    id: 'make_planks', name: 'Make Planks',
    description: 'Operate a selected sawbench: 1 log => 2 planks.',
    slots: {
      targetSawbench: { kind: 'structure', type: 'sawbench', optional: true, description: 'Sawbench to operate.' }
    },
    steps: [{ op: 'process_sawbench', target: '$targetSawbench' }, { op: 'loop' }]
  },
  make_poles: {
    id: 'make_poles', name: 'Make Poles',
    description: 'Put planks into a selected sawbench: 1 plank => 2 wood poles for bot recipes.',
    slots: {
      targetSawbench: { kind: 'structure', type: 'sawbench', optional: true, description: 'Sawbench to put planks into.' },
      sourceSawbench: { kind: 'structure', type: 'sawbench', optional: true, description: 'Preferred production area; bots pick loose planks around it, not from inventory.' },
      zone: { kind: 'zone', optional: true, description: 'Search area for loose planks.' }
    },
    steps: [
      { op: 'if_inventory', type: 'plank', goto: 3 },
      { op: 'fetch_plank_from_sawbench', source: '$sourceSawbench', zone: '$zone' },
      { op: 'pick_up', type: 'plank' },
      { op: 'deliver_to_sawbench', type: 'plank', target: '$targetSawbench' },
      { op: 'loop' }
    ]
  },
  haul_planks: {
    id: 'haul_planks', name: 'Haul Planks',
    description: 'Move loose planks from around a selected sawbench or zone to a selected bot factory.',
    slots: {
      sourceSawbench: { kind: 'structure', type: 'sawbench', optional: true, description: 'Preferred production area; bots pick loose planks around it, not from inventory.' },
      targetFactory: { kind: 'structure', type: 'factory', optional: true, description: 'Destination factory.' },
      zone: { kind: 'zone', optional: true, description: 'Search area for loose planks.' }
    },
    steps: [
      { op: 'if_inventory', type: 'plank', goto: 3 },
      { op: 'fetch_plank_from_sawbench', source: '$sourceSawbench', zone: '$zone' },
      { op: 'pick_up', type: 'plank' },
      { op: 'deliver_to_factory', type: 'plank', target: '$targetFactory' },
      { op: 'loop' }
    ]
  },
  craft_axes: {
    id: 'craft_axes', name: 'Craft Crude Axes',
    description: 'Supply a tool bench with 1 stick + 1 stone and craft crude axes for chopping.',
    slots: {
      targetWorkbench: { kind: 'structure', type: 'workbench', optional: true, description: 'Tool bench to operate.' },
      zone: { kind: 'zone', optional: true, description: 'Search area for loose sticks/stones.' }
    },
    steps: [
      { op: 'deliver_to_workbench', type: 'stick', target: '$targetWorkbench', zone: '$zone' },
      { op: 'deliver_to_workbench', type: 'stone', target: '$targetWorkbench', zone: '$zone' },
      { op: 'craft_workbench', recipe: 'crude_axe', target: '$targetWorkbench' },
      { op: 'loop' }
    ]
  },
  build_bots: {
    id: 'build_bots', name: 'Build Bots',
    description: 'Supply a selected factory with log + 3 planks + pole + tree seed and assemble idle bots.',
    slots: {
      targetFactory: { kind: 'structure', type: 'factory', optional: true, description: 'Factory to operate.' },
      sourceSawbench: { kind: 'structure', type: 'sawbench', optional: true, description: 'Preferred production area; bots pick loose planks/poles around it, not from inventory.' },
      zone: { kind: 'zone', optional: true, description: 'Search area for loose resources.' }
    },
    steps: [
      { op: 'deliver_to_factory', type: 'log', target: '$targetFactory', zone: '$zone' },
      { op: 'deliver_to_factory', type: 'plank', target: '$targetFactory', source: '$sourceSawbench', zone: '$zone' },
      { op: 'deliver_to_factory', type: 'pole', target: '$targetFactory', source: '$sourceSawbench', zone: '$zone' },
      { op: 'deliver_to_factory', type: 'tree_seed', target: '$targetFactory', zone: '$zone' },
      { op: 'assemble_bot', recipe: { log: 1, plank: 3, pole: 1, tree_seed: 1 }, target: '$targetFactory' },
      { op: 'loop' }
    ]
  },
  taught_loop: {
    id: 'taught_loop', name: 'Taught Loop',
    description: 'Replay the last teach-by-doing recording assigned to this bot.',
    slots: {},
    steps: [
      { op: 'pick_up', type: 'log' },
      { op: 'deposit_to_structure', type: 'log', target: 'recorded structure' },
      { op: 'loop' }
    ]
  },
  idle: {
    id: 'idle', name: 'Idle / Depot Parking',
    description: 'Park bot at depot and wait for the orchestrator.',
    slots: {},
    steps: [{ op: 'idle_parking' }, { op: 'wait', seconds: 1 }, { op: 'loop' }]
  }
};

export const DSL_ACTION_WIKI = {
  title: 'Bot DSL Action Wiki',
  purpose: 'Reference for AI/router prompts and Settings. Bot programs are JSON step loops; each step uses one allowed op plus the listed args. End repeating workflows with {"op":"loop"}. Assistant knowledge packs decide which concepts/ops are in prompt context.',
  outputShape: {
    toolCall: { name: 'assignBotProgram', arguments: { botId: 1, program: 'chop_wood', targetStructureId: 1, zone: { kind: 'rect', x: 100, y: 200, w: 80, h: 60 } } },
    dslAssignment: { botId: 1, program: { id: 'custom_loop', name: 'Feed sawbench logs', steps: [{ op: 'pick_up', type: 'log' }, { op: 'deposit_to_structure', type: 'log', structureId: 1 }, { op: 'loop' }] } }
  },
  args: {
    zone: 'Optional search area. Use {kind:"rect",x,y,w,h}, rect(x,y,w,h), radius(x,y,r), {kind:"radius",centerStructureId,radius}, {kind:"nearby",radius}, "nearby"/"nearby 500" for a moving bot-centered radius, a zone id/ref, or "$zone" inside templates.',
    target: 'Target for actions. Structures use numeric IDs/names. follow accepts me/player or bot name/ref/id. attack accepts hostile target refs/names or may be omitted when using type/zone. rename_bot accepts an optional bot name/ref/id target; omitted means the executing bot.',
    type: 'Item/resource type for logistics actions: log, plank, pole, stick, stone, tree_seed, crude_axe, crude_pickaxe, crude_shovel, crude_hammer; or hostile target type for attack: monster, night_monster, passive_monster, enemy, throne.',
    radius: 'Optional numeric radius for radius/nearby zones. For attack zone:"nearby", radius:500 means search 500px around each assigned bot as it moves. For guard_area it controls the guarded radius around the guard center; for patrol_route it controls threat interception range.',
    points: 'Patrol checkpoints for patrol_route, preferably JSON array [{x,y},{x,y}] or semicolon-separated coordinate pairs like "320,320;480,320".',
    recipe: 'Crafting recipe for production actions. craft_smithery supports sword/wooden_sword and shield/wooden_shield; craft_bowmaker supports bow.',
    distance: 'Optional follow spacing in pixels; follow defaults to a small escort distance if omitted.',
    targetKind: 'Generic target for use_held_item: tree, hemp, stone_deposit, dig_spot, dug_hole, structure, or ground. Validation resolves this to the concrete op and keeps knowledge-pack locks.',
    source: 'Optional source structure, usually a sawbench for loose planks/poles near production or an item_palette for storage pickup.',
    goto: 'Zero-based step index used by if_inventory when the bot already holds the required item.',
    bot: 'Bot id/ref/name to receive a named player-saved template, e.g. 2, bot:2, or Bot 2. For rename_bot/promote_to_manager, bot may also be used as the optional target bot.',
    name: 'Safe bot display name for rename_bot. Trimmed, control characters stripped, and clamped to 2-32 visible characters.',
    knowledgePacks: 'Optional manager pack ids for promote_to_manager, e.g. ["starter_automation","woodworking"]. Defaults to the current assistant loadout in UI or starter_automation in runtime.',
    recipient: 'Manager bot id/ref/name for delegate_to_manager. The recipient must already have status manager.',
    message: 'Short text instruction for delegate_to_manager. It is sanitized and routed through the manager LLM prompt with that manager’s known packs.',
    templateName: 'Exact name of a template saved in the Templates drawer from a teach-by-doing recording.'
  },
  actions: actionStepWikiActions(),
  examples: [
    { name: 'Chop wood loop', steps: PROGRAM_TEMPLATES.chop_wood.steps },
    { name: 'Dig holes loop', steps: PROGRAM_TEMPLATES.dig_holes.steps },
    { name: 'Pick up planks from a rectangle', steps: [{ op: 'if_inventory', type: 'plank', goto: 4 }, { op: 'find_item', type: 'plank', zone: { kind: 'rect', x: 100, y: 200, w: 80, h: 60 } }, { op: 'move_to_target' }, { op: 'pick_up_specific', type: 'plank' }, { op: 'loop' }] },
    { name: 'Bring item to player', steps: [{ op: 'pick_up', type: 'log' }, { op: 'deposit_to_player', type: 'log' }, { op: 'loop' }] },
    { name: 'Take item from player', steps: [{ op: 'take_from_player', type: 'stone' }, { op: 'loop' }] },
    { name: 'Rename bot', steps: [{ op: 'rename_bot', name: 'Lumberjack' }, { op: 'loop' }] },
    { name: 'Promote manager', steps: [{ op: 'promote_to_manager', knowledgePacks: ['starter_automation'] }, { op: 'loop' }] },
    { name: 'Delegate to manager', steps: [{ op: 'delegate_to_manager', recipient: 'Guard', message: 'make bot 2 chop trees' }, { op: 'loop' }] },
    { name: 'Assign saved template to another bot', steps: [{ op: 'assign_template', bot: 2, templateName: 'Feed sawbench' }, { op: 'loop' }] },
    { name: 'Plant trees in holes', steps: PROGRAM_TEMPLATES.plant_trees.steps },
    { name: 'Search hemp for seeds', steps: [{ op: 'find_hemp', zone: '$zone' }, { op: 'move_to_target' }, { op: 'search_hemp' }, { op: 'loop' }] },
    { name: 'Follow player', steps: [{ op: 'follow', target: 'me' }, { op: 'loop' }] },
    { name: 'Attack nearby monsters', steps: [{ op: 'attack', type: 'monster', zone: 'nearby', radius: 500 }, { op: 'loop' }] }
  ]
};

export function formatDslActionWiki() {
  const packLines = Object.values(ASSISTANT_KNOWLEDGE_PACKS).map(pack => `- ${pack.id}: ops ${pack.unlockedOps.join(', ')}; vocab ${pack.vocabulary.join(', ')}`);
  const lines = [
    `${DSL_ACTION_WIKI.title}: ${DSL_ACTION_WIKI.purpose}`,
    `Allowed ops: ${ALLOWED_OPS.join(', ')}.`,
    '',
    'Assistant knowledge packs:',
    ...packLines,
    '',
    'Arguments:',
    ...Object.entries(DSL_ACTION_WIKI.args).map(([name, description]) => `- ${name}: ${description}`),
    '',
    'Actions:',
    ...DSL_ACTION_WIKI.actions.map(action => `- ${action.op}${action.args.length ? `(${action.args.join(', ')})` : '()'}: ${action.description}`),
    '',
    'Examples:',
    ...DSL_ACTION_WIKI.examples.map(example => `- ${example.name}: ${JSON.stringify({ steps: example.steps })}`)
  ];
  return lines.join('\n');
}

export function getActionStepChainRows() {
  return actionStepChainRows({
    programTemplates: PROGRAM_TEMPLATES,
    knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS
  });
}

export const DEFAULT_WORLD_ZONES = [];

export const BUILDING_TYPES = {
  sawbench: { label: 'Sawbench', category: 'production', w: 92, h: 54, color: '#8a6a3d', cost: 'free prototype' },
  workbench: { label: 'Crude Tool Bench', category: 'production', w: 98, h: 54, color: '#735f43', cost: 'free prototype' },
  factory: { label: 'Bot Factory', category: 'production', w: 108, h: 66, color: '#637772', cost: 'free prototype' },
  portable_3d_printer: { label: 'Portable 3D Printer', category: 'production', w: 96, h: 76, color: '#d8ded9', cost: 'story kit' },
  assembler: { label: 'Portable Assembler', category: 'production', w: 112, h: 70, color: '#6d7c62', cost: 'story kit' },
  smithery: { label: 'Smithery', category: 'military', w: 100, h: 58, color: '#6f6760', cost: 'free prototype', processingDurations: { wooden_sword: 1.0, wooden_shield: 1.0 } },
  bowmaker: { label: 'Bowmaker', category: 'military', w: 104, h: 58, color: '#5f7054', cost: 'free prototype', processingDurations: { bow: 5.5 } },
  defensetower: { label: 'Defense Tower', category: 'military', w: 82, h: 96, color: '#5b625d', cost: 'free prototype', attackRange: 260, attackDamage: 1, attackCooldown: 1 },
  throne: { label: 'Throne', category: 'military', w: 118, h: 86, color: '#8a6a42', cost: 'multiplayer objective', maxHp: 120 },
  item_palette: { label: 'Item Palette', category: 'storage', w: 86, h: 48, color: '#6f7661', cost: 'free prototype', capacity: 40 },
  power_station: { label: 'Power Station', category: 'storage', w: 76, h: 72, color: '#5f625d', cost: 'story kit', capacity: 12 },
  robotics_parts_bin: { label: 'DIY Robotics Parts Bin', category: 'storage', w: 96, h: 60, color: '#766c54', cost: 'story kit', capacity: 24 },
  camper_van: { label: 'Simple White Camper Van', category: 'camp', w: 132, h: 64, color: '#edf3ef', cost: 'story kit' },
  hammock_camp: { label: 'Hammock Camp', category: 'camp', w: 118, h: 72, color: '#4b6b52', cost: 'story kit' },
  ultrabook_desk: { label: 'Ultrabook Field Desk', category: 'camp', w: 88, h: 62, color: '#766a58', cost: 'story kit' },
  solar_array: { label: 'Fold-Out Solar Panels', category: 'camp', w: 118, h: 70, color: '#4b6f78', cost: 'story kit' }
};
