const freezeList = values => Object.freeze([...values]);

export const KNOWLEDGE_PACK_IDS = freezeList(['starter_automation', 'woodworking', 'logistics', 'farming', 'mining_tools']);

export const KNOWLEDGE_PACK_OP_ORDER = Object.freeze({
  starter_automation: freezeList(['pick_up', 'drop_item', 'move_to_structure', 'use_held_item', 'assign_template', 'deposit_to_player', 'take_from_player', 'loop', 'wait']),
  woodworking: freezeList(['pick_up', 'deposit_to_structure', 'use_held_item', 'chop_tree', 'search_tree', 'loop']),
  logistics: freezeList(['pick_up_from_storage', 'deposit_to_structure', 'drop_item', 'use_held_item', 'loop']),
  farming: freezeList(['pick_up', 'plant_seed', 'use_held_item', 'search_tree', 'loop']),
  mining_tools: freezeList(['mine_stone', 'chop_hemp', 'use_held_item', 'search_hemp', 'loop'])
});

export const ACTION_STEP_ORDER = freezeList([
  'find_nearest_tree', 'find_stone_deposit', 'find_hemp', 'find_item', 'find_dig_spot', 'move_to_target',
  'chop_tree', 'search_tree', 'chop_hemp', 'search_hemp', 'mine_stone', 'dig_hole',
  'pick_up', 'pick_up_from_storage', 'pick_up_specific',
  'deliver_to_sawbench', 'process_sawbench', 'process_poles', 'fetch_plank_from_sawbench', 'fetch_pole_from_sawbench',
  'deliver_to_workbench', 'craft_workbench', 'deliver_to_factory', 'assemble_bot',
  'idle_parking', 'wait', 'loop', 'if_inventory', 'assign_template',
  'move_to_structure', 'deposit_to_structure', 'drop_item', 'find_dug_hole', 'plant_seed', 'use_held_item',
  'deposit_to_player', 'take_from_player'
]);

function step(definition) {
  const normalized = {
    args: [],
    packs: [],
    templates: false,
    customLoop: false,
    customLoopNote: '',
    recordable: false,
    uiCard: 'generic DSL card',
    ...definition
  };
  return Object.freeze({
    ...normalized,
    args: freezeList(normalized.args || []),
    packs: freezeList(normalized.packs || [])
  });
}

export const ACTION_STEP_REGISTRY = Object.freeze({
  find_nearest_tree: step({
    label: 'Find nearest tree',
    args: ['zone'],
    description: 'Select the nearest living tree in zone as the movement target.',
    signature: 'find_nearest_tree(zone?) - select the nearest living tree as the current target',
    templates: true,
    uiCard: 'location selector'
  }),
  find_stone_deposit: step({
    label: 'Find stone deposit',
    args: ['zone'],
    description: 'Select the nearest non-depleted stone deposit in zone as the target.',
    signature: 'find_stone_deposit(zone?) - select the nearest stone deposit as the current target',
    templates: true,
    uiCard: 'location selector'
  }),
  find_hemp: step({
    label: 'Find hemp',
    args: ['zone'],
    description: 'Select a hemp plant in zone as the target.',
    signature: 'find_hemp(zone?) - select the nearest hemp plant as the current target',
    templates: true,
    uiCard: 'location selector'
  }),
  find_item: step({
    label: 'Find loose item',
    args: ['type', 'zone'],
    description: 'Select a loose ground item of type in zone.',
    signature: 'find_item(type, zone?) - select a loose ground item as the current target',
    templates: true,
    uiCard: 'type + location selector'
  }),
  find_dig_spot: step({
    label: 'Find dig spot',
    args: ['zone'],
    description: 'Select open dirt in zone where a shovel can dig a new hole.',
    signature: 'find_dig_spot(zone?) - select open dirt as the current target',
    templates: true,
    uiCard: 'location selector'
  }),
  move_to_target: step({
    label: 'Move to target',
    description: 'Walk to the current target selected by a find_* action.',
    signature: 'move_to_target() - walk to the current target from a previous find step',
    templates: true,
    uiCard: 'read-only target step'
  }),
  chop_tree: step({
    label: 'Chop tree',
    args: ['zone'],
    description: 'Use a crude axe on the targeted tree; drops logs and eventually sticks/seeds.',
    signature: 'chop_tree(zone?) - chop/cut/fell nearest tree resource; not a structure op',
    packs: ['woodworking'],
    templates: true,
    customLoop: true,
    recordable: true,
    uiCard: 'resource action + location selector'
  }),
  search_tree: step({
    label: 'Search tree',
    args: ['zone'],
    description: 'Bare-hand search of the targeted tree; waits a few seconds, then drops one stick and one tree_seed nearby.',
    signature: 'search_tree(zone?) - search nearest tree resource for sticks/seeds without axe',
    packs: ['woodworking', 'farming'],
    customLoop: true,
    recordable: true,
    uiCard: 'resource action + location selector'
  }),
  chop_hemp: step({
    label: 'Chop hemp',
    args: ['zone'],
    description: 'Use a crude axe on the targeted hemp plant; waits on a process bar, then drops hemp and hemp_seed.',
    signature: 'chop_hemp(zone?) - chop nearest hemp resource with an axe',
    packs: ['mining_tools'],
    customLoop: true,
    recordable: true,
    uiCard: 'resource action + location selector'
  }),
  search_hemp: step({
    label: 'Search hemp',
    args: ['zone'],
    description: 'Bare-hand search of the targeted hemp plant; waits on a process bar, then drops hemp_seed.',
    signature: 'search_hemp(zone?) - search nearest hemp resource for seeds',
    packs: ['mining_tools'],
    customLoop: true,
    recordable: true,
    uiCard: 'resource action + location selector'
  }),
  mine_stone: step({
    label: 'Mine stone',
    args: ['zone'],
    description: 'Use a crude pickaxe on the targeted stone deposit; drops stone.',
    signature: 'mine_stone(zone?) - mine nearest stone deposit resource',
    packs: ['mining_tools'],
    templates: true,
    customLoop: true,
    recordable: true,
    uiCard: 'resource action + location selector'
  }),
  dig_hole: step({
    label: 'Dig hole',
    args: ['zone'],
    description: 'Use a crude shovel at the targeted dig spot; creates a dug hole.',
    signature: 'dig_hole(zone?) - dig a hole in the selected area with a crude shovel',
    templates: true,
    customLoop: true,
    recordable: true,
    uiCard: 'location selector'
  }),
  pick_up: step({
    label: 'Pick up',
    args: ['type', 'zone'],
    description: 'Pick up the nearest loose item of type when hands are empty; recordings store the type, not a specific item id.',
    signature: 'pick_up(type, zone?) - loose ground items only, e.g. crude_axe/crude_hammer/log/stick; not trees or buildings',
    packs: ['starter_automation', 'woodworking', 'farming'],
    templates: true,
    customLoop: true,
    recordable: true,
    uiCard: 'type + location selector'
  }),
  pick_up_from_storage: step({
    label: 'Pick up from storage',
    args: ['type', 'source'],
    description: 'Take one item of type from an item palette/storage source.',
    signature: 'pick_up_from_storage(type, source/structureId) - source must be an existing storage structure',
    packs: ['logistics'],
    templates: true,
    customLoop: true,
    recordable: true,
    uiCard: 'type + structure selector'
  }),
  pick_up_specific: step({
    label: 'Pick up specific',
    args: ['type'],
    description: 'Pick up the specific item selected by find_item.',
    signature: 'pick_up_specific(type) - pick up the current target selected by find_item',
    templates: true,
    uiCard: 'type field'
  }),
  deliver_to_sawbench: step({
    label: 'Deliver to sawbench',
    args: ['type', 'target'],
    description: 'Carry log or plank to a sawbench. Logs become stored input; planks are processed into dropped poles.',
    signature: 'deliver_to_sawbench(type, target?) - carry log/plank to a sawbench',
    templates: true,
    uiCard: 'type + structure selector'
  }),
  process_sawbench: step({
    label: 'Process sawbench',
    args: ['target'],
    description: 'Operate a sawbench with stored logs; drops planks beside the bench.',
    signature: 'process_sawbench(target?) - operate a sawbench with stored logs',
    templates: true,
    uiCard: 'structure selector'
  }),
  process_poles: step({
    label: 'Process poles',
    args: ['target'],
    description: 'Operate pole production at a sawbench from plank input; drops poles.',
    signature: 'process_poles(target?) - operate pole production at a sawbench',
    templates: true,
    uiCard: 'structure selector'
  }),
  fetch_plank_from_sawbench: step({
    label: 'Fetch plank from sawbench',
    args: ['source', 'zone'],
    description: 'Find/pick loose planks around a source sawbench, respecting zone.',
    signature: 'fetch_plank_from_sawbench(source?, zone?) - find loose planks near a sawbench',
    templates: true,
    uiCard: 'source + location selector'
  }),
  fetch_pole_from_sawbench: step({
    label: 'Fetch pole from sawbench',
    args: ['source', 'zone'],
    description: 'Find/pick loose poles around a source sawbench, respecting zone.',
    signature: 'fetch_pole_from_sawbench(source?, zone?) - find loose poles near a sawbench',
    templates: true,
    uiCard: 'source + location selector'
  }),
  deliver_to_workbench: step({
    label: 'Deliver to workbench',
    args: ['type', 'target', 'zone'],
    description: 'Carry sticks/stones to a crude tool bench.',
    signature: 'deliver_to_workbench(type, target?, zone?) - carry inputs to a crude tool bench',
    templates: true,
    uiCard: 'type + structure + location selector'
  }),
  craft_workbench: step({
    label: 'Craft at workbench',
    args: ['recipe', 'target'],
    description: 'Craft at a tool bench, e.g. recipe crude_axe or crude_hammer.',
    signature: 'craft_workbench(recipe, target?) - craft the selected workbench recipe',
    templates: true,
    uiCard: 'recipe + structure selector'
  }),
  deliver_to_factory: step({
    label: 'Deliver to factory',
    args: ['type', 'target', 'source', 'zone'],
    description: 'Carry bot factory ingredients (log, plank, pole, tree_seed) to a factory.',
    signature: 'deliver_to_factory(type, target?, source?, zone?) - carry bot factory ingredients',
    templates: true,
    uiCard: 'type + source/target + location selector'
  }),
  assemble_bot: step({
    label: 'Assemble bot',
    args: ['recipe', 'target'],
    description: 'Assemble a Basic Bot at a factory when the recipe is supplied.',
    signature: 'assemble_bot(recipe, target?) - assemble a Basic Bot at a factory',
    templates: true,
    uiCard: 'recipe + structure selector'
  }),
  idle_parking: step({
    label: 'Idle parking',
    description: 'Move/park the bot at the idle depot.',
    signature: 'idle_parking() - move/park the bot at the idle depot',
    templates: true,
    uiCard: 'read-only control step'
  }),
  wait: step({
    label: 'Wait',
    args: ['seconds'],
    description: 'Pause briefly before advancing.',
    signature: 'wait(seconds) - pause briefly before advancing',
    packs: ['starter_automation'],
    templates: true,
    customLoopNote: 'Known gap: custom/taught loops currently advance wait immediately.',
    uiCard: 'numeric seconds field'
  }),
  loop: step({
    label: 'Loop',
    description: 'Jump back to the first step; place at the end of repeating workflows.',
    signature: 'loop() - final step only; repeat from first step',
    packs: KNOWLEDGE_PACK_IDS,
    templates: true,
    customLoop: true,
    customLoopNote: 'Implicit in programTaughtLoop because the program counter wraps.',
    uiCard: 'read-only control step'
  }),
  if_inventory: step({
    label: 'If inventory',
    args: ['type', 'goto'],
    description: 'If bot already holds type, jump to step index goto; otherwise continue.',
    signature: 'if_inventory(type, goto) - jump to step index if the bot already holds type',
    templates: true,
    uiCard: 'type + goto field'
  }),
  assign_template: step({
    label: 'Assign template',
    args: ['bot', 'templateName'],
    description: 'Assign a named player-saved template loop to a specific bot.',
    signature: 'assign_template(bot, templateName) - assign a player-saved template by name to a specific bot',
    packs: ['starter_automation'],
    customLoop: true,
    uiCard: 'bot + template name fields'
  }),
  move_to_structure: step({
    label: 'Move to structure',
    args: ['target'],
    description: 'Teach-by-doing action: walk to a recorded/named structure.',
    signature: 'move_to_structure(target/structureId) - structure-only movement; never use for trees/resources',
    packs: ['starter_automation'],
    customLoop: true,
    recordable: true,
    uiCard: 'structure selector'
  }),
  deposit_to_structure: step({
    label: 'Deposit to structure',
    args: ['type', 'target'],
    description: 'Teach-by-doing action: move to the recorded/named structure and deposit the held item there when the building is ready.',
    signature: 'deposit_to_structure(type, target/structureId) - target must be an existing production/storage structure',
    packs: ['woodworking', 'logistics'],
    customLoop: true,
    recordable: true,
    uiCard: 'type + structure selector'
  }),
  drop_item: step({
    label: 'Drop item',
    args: ['type', 'zone'],
    description: 'Teach-by-doing action: move to the recorded/card-selected ground zone and drop the held item there.',
    signature: 'drop_item(type, zone?) - drop carried item on ground/zone',
    packs: ['starter_automation', 'logistics'],
    customLoop: true,
    recordable: true,
    uiCard: 'type + location selector'
  }),
  find_dug_hole: step({
    label: 'Find dug hole',
    args: ['zone'],
    description: 'Select an open dug hole in zone for planting.',
    signature: 'find_dug_hole(zone?) - select an open dug hole for planting',
    templates: true,
    uiCard: 'location selector'
  }),
  plant_seed: step({
    label: 'Plant seed',
    args: ['zone'],
    description: 'Plant a carried tree_seed in the targeted dug hole.',
    signature: 'plant_seed(zone?) - plant carried tree_seed in a dug hole resource',
    packs: ['farming'],
    templates: true,
    customLoop: true,
    recordable: true,
    uiCard: 'location selector'
  }),
  use_held_item: step({
    label: 'Use held item',
    args: ['targetKind', 'target', 'type', 'zone'],
    description: 'AI-friendly generic held-item action. Validation normalizes it to chop_tree, chop_hemp, mine_stone, dig_hole, plant_seed, deposit_to_structure, or drop_item; it cannot bypass locked concrete ops.',
    signature: 'use_held_item(targetKind, target?, type?, zone?) - generic held-item/tool action; validation resolves to a locked concrete op',
    packs: KNOWLEDGE_PACK_IDS,
    customLoopNote: 'Normalizer-only alias; validateDslProgram converts it to a concrete op.',
    uiCard: 'normalizer alias'
  }),
  deposit_to_player: step({
    label: 'Deposit to player',
    args: ['type'],
    description: 'Move to the player and give them the carried item if the player storage/inventory slot is empty. Not recordable; included in Starter Automation.',
    signature: 'deposit_to_player(type) - move to the player and give them the carried item',
    packs: ['starter_automation'],
    customLoop: true,
    uiCard: 'type field'
  }),
  take_from_player: step({
    label: 'Take from player',
    args: ['type'],
    description: 'Move to the player and take one matching item from the player storage/inventory slot when the bot has empty hands. Not recordable; included in Starter Automation.',
    signature: 'take_from_player(type) - move to the player and take the matching item',
    packs: ['starter_automation'],
    customLoop: true,
    uiCard: 'type field'
  })
});

export function actionStepList() {
  return ACTION_STEP_ORDER.map(op => ({ op, ...ACTION_STEP_REGISTRY[op] }));
}

export function actionStepOpsForPack(packId) {
  return (KNOWLEDGE_PACK_OP_ORDER[packId] || ACTION_STEP_ORDER.filter(op => (ACTION_STEP_REGISTRY[op].packs || []).includes(packId)))
    .filter(op => (ACTION_STEP_REGISTRY[op].packs || []).includes(packId));
}

export function actionStepWikiActions() {
  return actionStepList().map(step => ({
    op: step.op,
    args: step.args || [],
    description: step.description
  }));
}

export function runtimeDslSignaturesForOps(ops = []) {
  return ops.map(op => ACTION_STEP_REGISTRY[op]?.signature).filter(Boolean);
}

export function actionStepChainRows({ programTemplates = {}, knowledgePacks = {} } = {}) {
  const templateNamesByOp = {};
  for (const [templateId, template] of Object.entries(programTemplates || {})) {
    for (const step of template.steps || []) {
      if (!templateNamesByOp[step.op]) templateNamesByOp[step.op] = [];
      if (!templateNamesByOp[step.op].includes(templateId)) templateNamesByOp[step.op].push(templateId);
    }
  }
  const packNamesByOp = {};
  for (const pack of Object.values(knowledgePacks || {})) {
    for (const op of pack.unlockedOps || []) {
      if (!packNamesByOp[op]) packNamesByOp[op] = [];
      packNamesByOp[op].push(pack.id || pack.name);
    }
  }
  return actionStepList().map(step => {
    const templates = templateNamesByOp[step.op] || [];
    const packs = packNamesByOp[step.op] || step.packs || [];
    const backend = [
      step.templates ? 'built-in template' : '',
      step.customLoop ? 'custom/taught loop' : '',
      step.customLoopNote && !step.customLoop ? step.customLoopNote : ''
    ].filter(Boolean).join(' + ') || 'metadata only';
    return {
      op: step.op,
      label: step.label,
      args: step.args || [],
      packs,
      templates,
      backend,
      customLoop: !!step.customLoop,
      recordable: !!step.recordable,
      uiCard: step.uiCard,
      promptSignature: step.signature || '',
      notes: step.customLoopNote || ''
    };
  });
}
