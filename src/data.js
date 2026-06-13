export const PROGRAMS = ['chop_wood', 'mine_stone', 'dig_holes', 'pickup_item', 'plant_trees', 'haul_logs', 'make_planks', 'make_poles', 'haul_planks', 'craft_axes', 'build_bots', 'taught_loop', 'idle'];

export const ALLOWED_OPS = [
  'find_nearest_tree', 'find_stone_deposit', 'find_hemp', 'find_item', 'find_dig_spot', 'move_to_target', 'chop_tree', 'search_tree', 'chop_hemp', 'search_hemp', 'mine_stone', 'dig_hole', 'pick_up', 'pick_up_from_storage', 'pick_up_specific',
  'deliver_to_sawbench', 'process_sawbench', 'process_poles', 'fetch_plank_from_sawbench', 'fetch_pole_from_sawbench',
  'deliver_to_workbench', 'craft_workbench', 'deliver_to_factory', 'assemble_bot', 'idle_parking', 'wait', 'loop', 'if_inventory',
  'move_to_structure', 'deposit_to_structure', 'find_dug_hole', 'plant_seed'
];

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
      itemType: { kind: 'item', optional: false, description: 'Item to pick up, e.g. log, plank, stone, crude_axe.' },
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
  purpose: 'Reference for AI/router prompts and Settings. Bot programs are JSON step loops; each step uses one allowed op plus the listed args. End repeating workflows with {"op":"loop"}.',
  outputShape: {
    toolCall: { name: 'assignBotProgram', arguments: { botId: 1, program: 'chop_wood', targetStructureId: 1, zone: { kind: 'rect', x: 100, y: 200, w: 80, h: 60 } } },
    dslProgram: { id: 'custom_loop', steps: [{ op: 'find_nearest_tree', zone: '$zone' }, { op: 'move_to_target' }, { op: 'chop_tree' }, { op: 'loop' }] }
  },
  args: {
    zone: 'Optional search area. Use {kind:"rect",x,y,w,h}, {kind:"radius",centerStructureId,radius}, a zone id/ref, or "$zone" inside templates.',
    target: 'Structure target. Use numeric structure IDs from Game.objects for sawbench/workbench/factory/palette targets.',
    type: 'Item/resource type: log, plank, pole, stick, stone, tree_seed, crude_axe, crude_pickaxe, crude_shovel.',
    source: 'Optional source structure, usually a sawbench for loose planks/poles near production or an item_palette for storage pickup.',
    goto: 'Zero-based step index used by if_inventory when the bot already holds the required item.'
  },
  actions: [
    { op: 'find_nearest_tree', args: ['zone'], description: 'Select the nearest living tree in zone as the movement target.' },
    { op: 'find_stone_deposit', args: ['zone'], description: 'Select the nearest non-depleted stone deposit in zone as the target.' },
    { op: 'find_item', args: ['type', 'zone'], description: 'Select a loose ground item of type in zone.' },
    { op: 'find_dig_spot', args: ['zone'], description: 'Select open dirt in zone where a shovel can dig a new hole.' },
    { op: 'move_to_target', args: [], description: 'Walk to the current target selected by a find_* action.' },
    { op: 'chop_tree', args: [], description: 'Use a crude axe on the targeted tree; drops logs and eventually sticks/seeds.' },
    { op: 'search_tree', args: [], description: 'Bare-hand search of the targeted tree; waits a few seconds, then drops one stick and one tree_seed nearby.' },
    { op: 'find_hemp', args: ['zone'], description: 'Select a hemp plant in zone as the target.' },
    { op: 'chop_hemp', args: [], description: 'Use a crude axe on the targeted hemp plant; waits on a process bar, then drops hemp and hemp_seed.' },
    { op: 'search_hemp', args: [], description: 'Bare-hand search of the targeted hemp plant; waits on a process bar, then drops hemp_seed.' },
    { op: 'mine_stone', args: [], description: 'Use a crude pickaxe on the targeted stone deposit; drops stone.' },
    { op: 'dig_hole', args: [], description: 'Use a crude shovel at the targeted dig spot; creates a dug hole.' },
    { op: 'pick_up', args: ['type'], description: 'Pick up the nearest loose item of type when hands are empty; recordings store the type, not a specific item id.' },
    { op: 'pick_up_from_storage', args: ['type', 'source'], description: 'Take one item of type from an item palette/storage source.' },
    { op: 'pick_up_specific', args: ['type'], description: 'Pick up the specific item selected by find_item.' },
    { op: 'deliver_to_sawbench', args: ['type', 'target'], description: 'Carry log or plank to a sawbench. Logs become stored input; planks are processed into dropped poles.' },
    { op: 'process_sawbench', args: ['target'], description: 'Operate a sawbench with stored logs; drops planks beside the bench.' },
    { op: 'process_poles', args: ['target'], description: 'Operate pole production at a sawbench from plank input; drops poles.' },
    { op: 'fetch_plank_from_sawbench', args: ['source', 'zone'], description: 'Find/pick loose planks around a source sawbench, respecting zone.' },
    { op: 'fetch_pole_from_sawbench', args: ['source', 'zone'], description: 'Find/pick loose poles around a source sawbench, respecting zone.' },
    { op: 'deliver_to_workbench', args: ['type', 'target', 'zone'], description: 'Carry sticks/stones to a crude tool bench.' },
    { op: 'craft_workbench', args: ['recipe', 'target'], description: 'Craft at a tool bench, e.g. recipe crude_axe.' },
    { op: 'deliver_to_factory', args: ['type', 'target', 'source', 'zone'], description: 'Carry bot factory ingredients (log, plank, pole, tree_seed) to a factory.' },
    { op: 'assemble_bot', args: ['recipe', 'target'], description: 'Assemble a Basic Bot at a factory when the recipe is supplied.' },
    { op: 'idle_parking', args: [], description: 'Move/park the bot at the idle depot.' },
    { op: 'wait', args: ['seconds'], description: 'Pause briefly before advancing.' },
    { op: 'loop', args: [], description: 'Jump back to the first step; place at the end of repeating workflows.' },
    { op: 'if_inventory', args: ['type', 'goto'], description: 'If bot already holds type, jump to step index goto; otherwise continue.' },
    { op: 'move_to_structure', args: ['target'], description: 'Teach-by-doing action: walk to a recorded/named structure.' },
    { op: 'deposit_to_structure', args: ['type', 'target'], description: 'Teach-by-doing action: move to the recorded/named structure and deposit the held item there when the building is ready.' },
    { op: 'find_dug_hole', args: ['zone'], description: 'Select an open dug hole in zone for planting.' },
    { op: 'plant_seed', args: [], description: 'Plant a carried tree_seed in the targeted dug hole.' }
  ],
  examples: [
    { name: 'Chop wood loop', steps: PROGRAM_TEMPLATES.chop_wood.steps },
    { name: 'Dig holes loop', steps: PROGRAM_TEMPLATES.dig_holes.steps },
    { name: 'Pick up planks from a rectangle', steps: [{ op: 'if_inventory', type: 'plank', goto: 4 }, { op: 'find_item', type: 'plank', zone: { kind: 'rect', x: 100, y: 200, w: 80, h: 60 } }, { op: 'move_to_target' }, { op: 'pick_up_specific', type: 'plank' }, { op: 'loop' }] },
    { name: 'Plant trees in holes', steps: PROGRAM_TEMPLATES.plant_trees.steps },
    { name: 'Search hemp for seeds', steps: [{ op: 'find_hemp', zone: '$zone' }, { op: 'move_to_target' }, { op: 'search_hemp' }, { op: 'loop' }] }
  ]
};

export function formatDslActionWiki() {
  const lines = [
    `${DSL_ACTION_WIKI.title}: ${DSL_ACTION_WIKI.purpose}`,
    `Allowed ops: ${ALLOWED_OPS.join(', ')}.`,
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

export const DEFAULT_WORLD_ZONES = [];

export const BUILDING_TYPES = {
  sawbench: { label: 'Sawbench', category: 'production', w: 92, h: 54, color: '#8a6a3d', cost: 'free prototype' },
  workbench: { label: 'Crude Tool Bench', category: 'production', w: 98, h: 54, color: '#735f43', cost: 'free prototype' },
  factory: { label: 'Bot Factory', category: 'production', w: 108, h: 66, color: '#637772', cost: 'free prototype' },
  smithery: { label: 'Smithery', category: 'military', w: 100, h: 58, color: '#6f6760', cost: 'free prototype', processingDurations: { wooden_sword: 1.0, wooden_shield: 1.0 } },
  bowmaker: { label: 'Bowmaker', category: 'military', w: 104, h: 58, color: '#5f7054', cost: 'free prototype', processingDurations: { bow: 5.5 } },
  defensetower: { label: 'Defense Tower', category: 'military', w: 82, h: 96, color: '#5b625d', cost: 'free prototype', attackRange: 260, attackDamage: 1, attackCooldown: 1 },
  throne: { label: 'Throne', category: 'military', w: 118, h: 86, color: '#8a6a42', cost: 'multiplayer objective', maxHp: 120 },
  item_palette: { label: 'Item Palette', category: 'storage', w: 86, h: 48, color: '#6f7661', cost: 'free prototype', capacity: 40 }
};
