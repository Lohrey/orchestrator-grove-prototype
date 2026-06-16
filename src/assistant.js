import { PROGRAMS, PROGRAM_TEMPLATES, ASSISTANT_KNOWLEDGE_PACKS, DEFAULT_ASSISTANT_LOADOUT, DSL_ACTION_WIKI } from './data.js?v=t_step_registry';
import { runtimeDslSignaturesForOps } from './action-steps.js?v=t_step_registry';

export const LOCAL_AI_PROVIDERS = {
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    backendLabel: 'Ollama',
    baseUrl: null
  },
  tabbyapi: {
    id: 'tabbyapi',
    label: 'Qwen2.5-Coder 7B Instruct EXL2 6.5bpw (TabbyAPI)',
    backendLabel: 'TabbyAPI / ExLlama',
    baseUrl: 'http://127.0.0.1:5000/v1',
    chatCompletionsUrl: 'http://127.0.0.1:5000/v1/chat/completions',
    defaultModel: 'Qwen2.5-Coder-7B-Instruct-exl2-6_5'
  }
};

export function defaultOllamaEndpoint() {
  if (location.hostname === 'docs.pau1.cloud') return '/ollama-proxy';
  return 'http://127.0.0.1:11434';
}

export function getDefaultProviderConfig(provider = 'ollama') {
  if (provider === 'tabbyapi') return { provider, endpoint: LOCAL_AI_PROVIDERS.tabbyapi.baseUrl, model: LOCAL_AI_PROVIDERS.tabbyapi.defaultModel };
  return { provider: 'ollama', endpoint: defaultOllamaEndpoint(), model: preferredOllamaModel(OLLAMA_MODEL_PREFERENCES) || 'gemma4:12b' };
}

const OLLAMA_MODEL_PREFERENCES = [
  'gemma4:12b',
  'gemma4:latest',
  'gemma4-26b-a4b-local:latest',
  'gemma4-26b-a4b-local',
  'bonsai8b-q1:latest',
  'bonsai8b-q1',
  'llama3:latest',
  'llama3',
  'llama3.2-vision:latest',
  'llama3.2-vision:11b-instruct-q8_0',
  'qwen2.5:0.5b'
];

function isRunnableChatModel(name) {
  return !/^bge-m3(?::|$)/.test(name);
}

export function preferredOllamaModel(names) {
  const available = (names || []).filter(Boolean);
  return OLLAMA_MODEL_PREFERENCES.map(preferred => available.find(name => name === preferred)).find(Boolean)
    || available.find(name => /^gemma4(?::|-)/.test(name))
    || available.find(isRunnableChatModel)
    || available[0]
    || '';
}

export function normalizeProgram(text) {
  const s = String(text || '').toLowerCase().replace(/[_-]/g, ' ');
  const plankHaul = /haul|carry|move|bring|transport/.test(s) && /plank|board/.test(s);
  const toSawbench = /\b(?:to|into|onto)\s+(?:the\s+)?saw\s*bench\b/.test(s);
  if (/plant|sow|replant/.test(s) || (/seed|tree seed/.test(s) && /hole|holes/.test(s))) return 'plant_trees';
  if (/dig|hole|holes|shovel/.test(s)) return 'dig_holes';
  if (/mine|quarry|pickaxe/.test(s) && /stone|rock/.test(s)) return 'mine_stone';
  if (/pick\s*up|pickup|collect|grab|take/.test(s) && /(log|wood|plank|board|pole|stick|stone|rock|seed|axe|pickaxe)/.test(s)) return 'pickup_item';
  if (/axe|tool bench|workbench|crude tool|craft tool/.test(s)) return 'craft_axes';
  if (/pole|poles/.test(s)) return 'make_poles';
  if (/build|new bot|produce bot|assemble/.test(s)) return 'build_bots';
  if (/chop|cut|tree|wood|fell/.test(s) && !/haul|carry|move|bring|transport/.test(s)) return 'chop_wood';
  if (plankHaul && toSawbench) return 'make_poles';
  if (/haul|carry|move|bring|transport/.test(s) && /plank|board/.test(s)) return 'haul_planks';
  if (/plank|saw\b|process|board/.test(s) && !/haul|carry|move|bring|transport/.test(s)) return 'make_planks';
  if (/haul|carry|move|bring|transport/.test(s) && /log|wood/.test(s)) return 'haul_logs';
  if (/chop|cut|tree|wood|fell/.test(s)) return 'chop_wood';
  if (/idle|stop|park/.test(s)) return 'idle';
  return null;
}

function zoneArgsFromText(lower, game) {
  const rectZone = game.parseRectangleZoneMention?.(lower);
  if (rectZone) return { zone: rectZone };
  const explicitZone = game.findZoneMention?.(lower);
  if (explicitZone) return { zoneId: explicitZone.id };
  const radiusZone = game.parseRadiusZoneMention?.(lower);
  if (radiusZone) return { zone: radiusZone };
  return {};
}

function itemTypeFromText(lower, game) {
  const candidates = ['crude pickaxe', 'pickaxe', 'crude axe', 'axe', 'tree seeds', 'tree seed', 'seeds', 'seed', 'planks', 'plank', 'boards', 'board', 'logs', 'log', 'wood', 'poles', 'pole', 'sticks', 'stick', 'stones', 'stone', 'rocks', 'rock'];
  const found = candidates.find(word => new RegExp(`\\b${word.replace(/ /g, '\\s+')}\\b`).test(lower));
  return game.normalizeItemType?.(found === 'wood' ? 'log' : found, 'log') || 'log';
}

function sourcePaletteFromText(lower, game) {
  return game.findStructureMention?.(lower, 'item_palette') || (/palette|storage/.test(lower) ? game.structures?.find(s => s.type === 'item_palette') : null);
}

export function normalizeAssistantLoadout(loadout = DEFAULT_ASSISTANT_LOADOUT) {
  const source = Array.isArray(loadout) ? loadout : DEFAULT_ASSISTANT_LOADOUT;
  return [...new Set(source)].filter(id => ASSISTANT_KNOWLEDGE_PACKS[id]);
}

export function getAssistantKnowledgePacks(loadout = DEFAULT_ASSISTANT_LOADOUT) {
  return normalizeAssistantLoadout(loadout).map(id => ASSISTANT_KNOWLEDGE_PACKS[id]).filter(Boolean);
}

export function formatAssistantLoadout(loadout = DEFAULT_ASSISTANT_LOADOUT) {
  return getAssistantKnowledgePacks(loadout).map(pack => ({
    id: pack.id,
    name: pack.name,
    concepts: pack.concepts,
    vocabulary: pack.vocabulary,
    optionalContext: pack.optionalContext || [],
    unlockedOps: pack.unlockedOps,
    examples: pack.examples
  }));
}

export function summarizeAssistantLoadout(loadout = DEFAULT_ASSISTANT_LOADOUT) {
  const packs = formatAssistantLoadout(loadout);
  return {
    ids: packs.map(pack => pack.id),
    names: packs.map(pack => pack.name),
    unlockedOps: [...new Set(packs.flatMap(pack => pack.unlockedOps))],
    optionalContext: [...new Set(packs.flatMap(pack => pack.optionalContext || []))],
    vocabulary: [...new Set(packs.flatMap(pack => pack.vocabulary))],
    concepts: packs.flatMap(pack => pack.concepts)
  };
}

function dslAssignment(botId, name, steps, reason) {
  return { botId, program: { id: 'generated_taught_loop', name, steps }, reason };
}

function compileDslIntent({ botId, lower, game, unlockedOps }) {
  const zoneArgs = zoneArgsFromText(lower, game);
  const zone = zoneArgs.zone || zoneArgs.zoneId || null;
  const withZone = step => zone ? { ...step, zone } : step;
  const canUse = steps => !unlockedOps || steps.every(step => unlockedOps.has(step.op));
  const sawbench = game.findStructureMention?.(lower, 'sawbench') || (/saw\s*bench|sawbench/.test(lower) ? game.structures?.find(s => s.type === 'sawbench') : null);
  const wantsLogFeed = /(feed|fill|full|supply|stock|keep|haul|carry|bring|move).*(saw\s*bench|sawbench)|(saw\s*bench|sawbench).*(feed|fill|full|supply|stock|keep).*(log|wood)/.test(lower) && /(log|wood)/.test(lower);
  const mentionsPlayer = /\b(player|me|my character|spieler|mir|mich)\b/.test(lower);
  const playerItemType = itemTypeFromText(lower, game);
  const wantsBringToPlayer = mentionsPlayer && /\b(bring|give|deliver|carry|haul|take)\b/.test(lower) && !/\b(from|out of|take from|get from|grab from)\b/.test(lower);
  if (botId && wantsBringToPlayer) {
    const steps = [
      withZone({ op: 'pick_up', type: playerItemType }),
      { op: 'deposit_to_player', type: playerItemType },
      { op: 'loop' }
    ];
    if (canUse(steps)) return dslAssignment(botId, `Bring ${playerItemType.replace(/_/g, ' ')} to player`, steps, 'Generated pack-backed DSL: pick up the item and deliver it to the player storage slot.');
  }
  const wantsTakeFromPlayer = mentionsPlayer && (/\b(take|grab|get|collect|remove)\b.*\b(from|out of)\b/.test(lower) || /\bfrom\s+(me|player|my character)\b/.test(lower));
  if (botId && wantsTakeFromPlayer) {
    const steps = [
      { op: 'take_from_player', type: playerItemType },
      { op: 'loop' }
    ];
    if (canUse(steps)) return dslAssignment(botId, `Take ${playerItemType.replace(/_/g, ' ')} from player`, steps, 'Generated pack-backed DSL: take one matching item from the player storage slot.');
  }
  if (botId && sawbench && wantsLogFeed) {
    const steps = [
      withZone({ op: 'pick_up', type: 'log' }),
      { op: 'deposit_to_structure', type: 'log', structureId: sawbench.id, structureName: sawbench.name, structureType: sawbench.type },
      { op: 'loop' }
    ];
    if (canUse(steps)) return dslAssignment(botId, 'Feed sawbench with logs', steps, 'Generated pack-backed DSL: pick up logs, deposit to sawbench, repeat.');
  }
  if (botId && /plant|sow|replant/.test(lower) && /seed|tree/.test(lower)) {
    const steps = [
      withZone({ op: 'pick_up', type: 'tree_seed' }),
      withZone({ op: 'plant_seed' }),
      { op: 'loop' }
    ];
    if (canUse(steps)) return dslAssignment(botId, 'Plant tree seeds', steps, 'Generated pack-backed DSL: collect tree seeds and plant them in open holes.');
  }
  if (botId && /mine|quarry|pickaxe/.test(lower) && /stone|rock/.test(lower)) {
    const steps = [withZone({ op: 'mine_stone' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Mine stone', steps, 'Generated pack-backed DSL: mine stone deposits repeatedly.');
  }
  if (botId && /(search|forage).*(tree|wood)|tree.*(search|forage)/.test(lower)) {
    const steps = [withZone({ op: 'search_tree' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Search trees', steps, 'Generated pack-backed DSL: search trees repeatedly.');
  }
  if (botId && /(chop|cut|fell).*(tree|wood)|(tree|wood).*(chop|cut|fell)/.test(lower)) {
    const steps = [withZone({ op: 'chop_tree' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Chop trees', steps, 'Generated pack-backed DSL: chop trees repeatedly.');
  }
  if (botId && /search.*hemp|hemp.*search/.test(lower)) {
    const steps = [withZone({ op: 'search_hemp' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Search hemp', steps, 'Generated pack-backed DSL: search hemp repeatedly.');
  }
  if (botId && /(chop|cut).*(hemp)|hemp.*(chop|cut)/.test(lower)) {
    const steps = [withZone({ op: 'chop_hemp' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Chop hemp', steps, 'Generated pack-backed DSL: chop hemp repeatedly.');
  }
  return null;
}

function programAvailableInLoadout(program, unlockedOps) {
  const requirements = {
    chop_wood: ['chop_tree'],
    mine_stone: ['mine_stone'],
    pickup_item: ['pick_up'],
    plant_trees: ['pick_up', 'plant_seed'],
    haul_logs: ['pick_up', 'deposit_to_structure'],
    idle: ['wait', 'loop']
  };
  const requiredOps = requirements[program];
  return !requiredOps || requiredOps.every(op => unlockedOps.has(op));
}

function assignmentArgsForText({ botId, program, lower, game, reason }) {
  const sawbench = game.findStructureMention?.(lower, 'sawbench');
  const factory = game.findStructureMention?.(lower, 'factory');
  const workbench = game.findStructureMention?.(lower, 'workbench');
  const palette = sourcePaletteFromText(lower, game);
  const args = { botId, program, reason, ...zoneArgsFromText(lower, game) };
  if (program === 'pickup_item') {
    args.itemType = itemTypeFromText(lower, game);
    if (palette) args.sourcePaletteId = palette.id;
  }
  if (['haul_logs', 'make_planks', 'make_poles'].includes(program) && sawbench) args.targetStructureId = sawbench.id;
  if (['haul_planks', 'build_bots'].includes(program)) {
    if (sawbench) args.sourceStructureId = sawbench.id;
    if (factory) args.targetFactoryId = factory.id;
  }
  if (program === 'craft_axes' && workbench) args.targetWorkbenchId = workbench.id;
  if (program === 'build_bots' && factory) args.targetFactoryId = factory.id;
  return args;
}

export function parseAssistantRequest(text, game, { enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT } = {}) {
  if (!enableTemplates) {
    return { help: true, source: 'mock', meta: 'Workflow template routing is disabled in Settings.' };
  }
  const loadoutSummary = summarizeAssistantLoadout(loadout);
  const unlockedOps = new Set(loadoutSummary.unlockedOps);
  const lower = text.toLowerCase();
  const calls = [];
  if (/all\s+bots?.*(idle|stop|park)/.test(lower)) {
    for (const bot of game.bots) calls.push({ name: 'assignBotProgram', arguments: { botId: bot.id, program: 'idle', reason: 'All bots idle' } });
    return { calls, source: 'mock' };
  }
  const botMatches = [...lower.matchAll(/bot\s*(\d+)/g)].map(m => Number(m[1])).filter(Boolean);
  if (botMatches.length && /template|vorlage/.test(lower) && game.customTemplates?.length) {
    const template = game.customTemplates.find(t => lower.includes(String(t.name || '').toLowerCase()));
    if (template && unlockedOps.has('assign_template')) {
      const assignments = botMatches.map(botId => ({
        name: 'assignBotTemplate',
        arguments: { botId, templateName: template.name, reason: 'Parsed named player template assignment' }
      }));
      return { templateAssignments: assignments, source: 'mock', meta: `Assigned template ${template.name} to ${assignments.length} bot(s).` };
    }
  }
  const dslAssignments = botMatches.map(botId => compileDslIntent({ botId, lower, game, unlockedOps })).filter(Boolean);
  if (dslAssignments.length) return { dslAssignments, source: 'mock', meta: `Generated DSL for ${dslAssignments.length} bot(s) from equipped knowledge packs.` };
  const program = normalizeProgram(lower);
  if (botMatches.length && program && programAvailableInLoadout(program, unlockedOps)) {
    for (const botId of botMatches) calls.push({ name: 'assignBotProgram', arguments: assignmentArgsForText({ botId, program, lower, game, reason: 'Parsed command with slots' }) });
    return { calls, source: 'mock' };
  }
  if (/idle bot|free bot|assign/.test(lower) && program && programAvailableInLoadout(program, unlockedOps)) {
    const bot = game.bots.find(b => b.program === 'idle') || game.bots[0];
    if (bot) calls.push({ name: 'assignBotProgram', arguments: assignmentArgsForText({ botId: bot.id, program, lower, game, reason: 'Assigned idle bot with slots' }) });
  }
  return calls.length ? { calls, source: 'mock' } : { help: true, source: 'mock' };
}

function compactTemplateInfo() {
  return Object.fromEntries(Object.entries(PROGRAM_TEMPLATES).map(([id, tpl]) => [id, Object.keys(tpl.slots || {})]));
}

const CANONICAL_ITEM_TYPES = ['log', 'plank', 'pole', 'stick', 'stone', 'tree_seed', 'crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer', 'hemp', 'hemp_seed'];

const RESOURCE_STRUCTURE_RULES = {
  resourcesAreNotStructures: ['tree', 'trees', 'hemp', 'stone deposit', 'stone_deposit', 'rock', 'rocks', 'dug hole', 'hole'],
  structureOps: ['move_to_structure', 'deposit_to_structure', 'pick_up_from_storage'],
  rule: 'Trees/hemp/stone deposits/holes are resources, not structures. Never put resource words into target/source/structureName for structure ops. If the resource op is locked, return help instead of substituting a structure op.'
};

function packIdsUnlockingOp(op) {
  return Object.values(ASSISTANT_KNOWLEDGE_PACKS).filter(pack => pack.unlockedOps.includes(op)).map(pack => pack.id);
}

function relevantActionGuideForOps(unlockedOps) {
  const allowed = new Set(unlockedOps);
  return DSL_ACTION_WIKI.actions
    .filter(action => allowed.has(action.op))
    .map(action => ({ op: action.op, args: action.args, description: action.description }));
}

function likelyLockedRequestHints(text, unlockedOps) {
  const lower = String(text || '').toLowerCase();
  const allowed = new Set(unlockedOps);
  const hints = [];
  const maybePush = (op, pattern, reason) => {
    if (pattern.test(lower) && !allowed.has(op)) {
      hints.push({ op, requiredPacks: packIdsUnlockingOp(op), reason, doNotSubstituteWith: RESOURCE_STRUCTURE_RULES.structureOps });
    }
  };
  maybePush('chop_tree', /\b(chop|cut|fell)\b.*\b(tree|trees|wood)\b|\b(tree|trees|wood)\b.*\b(chop|cut|fell)\b/, 'Tree chopping requires chop_tree; trees are resources, not move_to_structure targets.');
  maybePush('search_tree', /\b(search|look)\b.*\b(tree|trees)\b|\b(stick|sticks|seed|seeds)\b.*\b(tree|trees)\b/, 'Searching trees requires search_tree; trees are resources, not structures.');
  maybePush('mine_stone', /\b(mine|quarry)\b.*\b(stone|rock|rocks)\b|\b(stone|rock|rocks)\b.*\b(mine|quarry)\b/, 'Mining stone requires mine_stone; stone deposits are resources, not structures.');
  maybePush('plant_seed', /\b(plant|sow)\b.*\b(seed|tree_seed|tree seed)\b/, 'Planting tree seeds requires plant_seed plus an open dug hole.');
  return hints;
}

function runtimeSignaturesForOps(unlockedOps) {
  return runtimeDslSignaturesForOps(unlockedOps);
}

function optionalRuntimeKnowledge(game, equippedPacks) {
  const wanted = new Set(equippedPacks.flatMap(pack => pack.optionalContext || []));
  const knowledge = {};
  if (wanted.has('availableBotNames')) {
    knowledge.availableBotNames = (game.bots || []).map(bot => bot.ref || `bot ${bot.id}`);
  }
  if (wanted.has('availableTemplateNames')) {
    knowledge.availableTemplateNames = (game.customTemplates || []).map(template => template.name);
  }
  if (wanted.has('availableBuildingNames')) {
    knowledge.availableBuildingNames = (game.structures || []).map(structure => structure.name || structure.ref || `${structure.type} ${structure.id}`);
  }
  if (wanted.has('availableItemTypes')) knowledge.availableItemTypes = CANONICAL_ITEM_TYPES;
  if (wanted.has('currentPlayerInventory')) knowledge.currentPlayerInventory = game.player?.inventory?.type || null;
  return knowledge;
}

function dslAssignmentExampleForOps(unlockedOps, text = '') {
  const ops = new Set(unlockedOps);
  const loop = ops.has('loop') ? [{ op: 'loop' }] : [];
  const lower = String(text || '').toLowerCase();
  if (/\b(bring|give|deliver|carry)\b.*\b(player|me|my character)\b|\b(player|me|my character)\b.*\b(bring|give|deliver)\b/.test(lower) && ops.has('pick_up') && ops.has('deposit_to_player')) {
    return { dsl_assignments: [{ botId: 1, program: { id: 'generated_taught_loop', name: 'Bring item to player', steps: [{ op: 'pick_up', type: 'log' }, { op: 'deposit_to_player', type: 'log' }, ...loop] }, reason: 'Pick up the requested item and deliver it to the player as storage.' }] };
  }
  if (/\b(take|grab|get|collect)\b.*\b(from|out of)\b.*\b(player|me|my character)\b|\b(player|me|my character)\b.*\b(take|grab|get|collect)\b/.test(lower) && ops.has('take_from_player')) {
    return { dsl_assignments: [{ botId: 1, program: { id: 'generated_taught_loop', name: 'Take item from player', steps: [{ op: 'take_from_player', type: 'log' }, ...loop] }, reason: 'Take one matching item from the player storage slot.' }] };
  }
  if (/\b(chop|cut|fell)\b.*\b(tree|trees|wood)\b|\b(tree|trees|wood)\b.*\b(chop|cut|fell)\b/.test(lower) && ops.has('pick_up') && ops.has('chop_tree')) {
    const heldUseStep = ops.has('use_held_item') ? { op: 'use_held_item', targetKind: 'tree' } : { op: 'chop_tree' };
    return { dsl_assignments: [{ botId: 1, program: { id: 'generated_taught_loop', name: 'Chop trees', steps: [{ op: 'pick_up', type: 'crude_axe' }, heldUseStep, ...loop] }, reason: 'Pick up a crude axe, then use the held tool on the nearest tree resource.' }] };
  }
  if (ops.has('pick_up') && ops.has('deposit_to_structure')) {
    return { dsl_assignments: [{ botId: 1, program: { id: 'generated_taught_loop', name: 'Feed sawbench logs', steps: [{ op: 'pick_up', type: 'log' }, { op: 'deposit_to_structure', type: 'log', structureId: 1 }, ...loop] }, reason: '...' }] };
  }
  if (ops.has('pick_up') && ops.has('drop_item')) {
    return { dsl_assignments: [{ botId: 1, program: { id: 'generated_taught_loop', name: 'Collect and drop logs', steps: [{ op: 'pick_up', type: 'log' }, { op: 'drop_item', type: 'log' }, ...loop] }, reason: '...' }] };
  }
  if (ops.has('chop_tree')) {
    return { dsl_assignments: [{ botId: 1, program: { id: 'generated_taught_loop', name: 'Chop trees', steps: [{ op: 'chop_tree' }, ...loop] }, reason: '...' }] };
  }
  if (ops.has('wait')) {
    return { dsl_assignments: [{ botId: 1, program: { id: 'generated_taught_loop', name: 'Wait loop', steps: [{ op: 'wait', seconds: 1 }, ...loop] }, reason: '...' }] };
  }
  return { dsl_assignments: [] };
}

function compactGameState(game, { includeTemplates = false } = {}) {
  return {
    bots: game.bots.map(b => ({ id: b.id, ref: b.ref, program: b.program })),
    structures: game.structures.map(s => ({ id: s.id, ref: s.ref, name: s.name, type: s.type })),
    zones: game.zones.map(z => ({ id: z.id, name: z.name, kind: z.kind })),
    programs: PROGRAMS,
    ...(includeTemplates ? { templates: compactTemplateInfo() } : {})
  };
}

export function buildOllamaKnowledge(text, game, { enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT } = {}) {
  const equippedPacks = formatAssistantLoadout(loadout);
  const unlockedOps = [...new Set(equippedPacks.flatMap(pack => pack.unlockedOps))];
  const runtimeSignatures = runtimeSignaturesForOps(unlockedOps);
  const dslExample = dslAssignmentExampleForOps(unlockedOps, text);
  return {
    request: text,
    equippedPacks,
    unlockedOps,
    runtimeSignatures,
    actionGuide: relevantActionGuideForOps(unlockedOps),
    resourceStructureRules: RESOURCE_STRUCTURE_RULES,
    lockedRequestHints: likelyLockedRequestHints(text, unlockedOps),
    outputExamples: {
      dslAssignment: dslExample,
      legacyToolCall: { tool_calls: [{ name: 'assignBotProgram', arguments: { botId: 2, program: 'make_planks', target: 'sawbench 1' } }] }
    },
    optionalRuntimeKnowledge: optionalRuntimeKnowledge(game, equippedPacks),
    minimalGameContext: compactGameState(game, { includeTemplates: enableTemplates })
  };
}

export function formatOllamaFinalPrompt(messages = []) {
  return messages.map(message => `${String(message.role || 'message').toUpperCase()}:\n${message.content || ''}`).join('\n\n---\n\n');
}

export function buildOllamaPrompt(text, game, { enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT } = {}) {
  const templateGuidance = enableTemplates ? 'Legacy tool_calls are allowed only when a named program exactly matches the request.' : 'Legacy tool_calls are disabled; prefer dsl_assignments.';
  const knowledge = buildOllamaKnowledge(text, game, { enableTemplates, loadout });
  const systemPrompt = `You are a strict JSON compiler for bot commands. Return exactly one compact JSON object and nothing else.
Preferred shape: {"dsl_assignments":[{"botId":1,"program":{"id":"generated_taught_loop","name":"Short name","steps":[{"op":"pick_up","type":"log"},{"op":"loop"}]},"reason":"short reason"}]}
Fallback shape: {"tool_calls":[{"name":"assignBotProgram","arguments":{"botId":1,"program":"chop_wood"}}]}
Help shape when the request needs a locked op or impossible target: {"help":true,"reason":"short reason","missingOps":["chop_tree"],"requiredPacks":["woodworking"]}
Rules: use only unlockedOps from the user message knowledge; prefer use_held_item when the request means “use the carried item/tool on this target,” but only when the concrete target action is unlocked; never use it to bypass a missing pack; never substitute a different unlocked op when the user's requested action requires a locked op; steps are flat objects; loop may appear only as the final step; keep programs short; never output markdown or JavaScript.
Trees, hemp, stone deposits, rocks, and holes are resources, not structures. Use resource ops such as chop_tree/search_tree/mine_stone/plant_seed for them when unlocked; otherwise return the help shape. Never output move_to_structure with target/source/structureName set to tree/hemp/stone/hole.
For real building/item references, trust the user's wording and put the name/type in target/source/structureName/type fields; the game resolves names after validation. Use numeric ids only when the user or supplied knowledge explicitly gives them.
${templateGuidance}`;
  const userPrompt = `Knowledge: ${JSON.stringify(knowledge)}\nRequest: ${text}`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  return { systemPrompt, userPrompt, messages, finalPrompt: formatOllamaFinalPrompt(messages), equippedPacks: knowledge.equippedPacks, unlockedOps: knowledge.unlockedOps, knowledge };
}

export function isGemma412BModel(model) {
  return /^gemma4[:_-]12b(?:$|[:_-])/i.test(String(model || '').trim());
}

export function buildOllamaRequestBody(text, game, { model, enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, think = false } = {}) {
  const prompt = buildOllamaPrompt(text, game, { enableTemplates, loadout });
  const body = {
    model, stream: false, format: 'json', think,
    messages: prompt.messages,
    options: { temperature: 0, num_predict: 180, num_ctx: 4096 }
  };
  return { body, prompt };
}

export function buildOpenAiCompatibleRequestBody(text, game, { model, enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, temperature = 0.1 } = {}) {
  const prompt = buildOllamaPrompt(text, game, { enableTemplates, loadout });
  const body = {
    model,
    temperature,
    stream: false,
    response_format: { type: 'json_object' },
    messages: prompt.messages
  };
  return { body, prompt };
}

function parseJsonObject(text) {
  if (typeof text === 'object' && text) return text;
  const clean = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(clean); } catch (_) {
    const start = clean.indexOf('{'), end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('model returned invalid JSON');
  }
}

function parseArgs(raw) {
  const args = typeof raw.arguments === 'string' ? parseJsonObject(raw.arguments) : (raw.arguments || raw.args || raw.function?.arguments || {});
  return typeof args === 'string' ? parseJsonObject(args) : args;
}

export function validateToolCalls(rawCalls, game, { loadout } = {}) {
  if (!Array.isArray(rawCalls)) throw new Error('tool_calls must be an array');
  const valid = [];
  const errors = [];
  const allowedOps = loadout ? new Set(summarizeAssistantLoadout(loadout).unlockedOps) : null;
  for (const raw of rawCalls.slice(0, 10)) {
    const name = raw.name || raw.function?.name;
    const args = parseArgs(raw);
    if (name !== 'assignBotProgram') continue;
    const botId = Number(args.botId || String(args.bot || '').replace(/^bot:/, ''));
    if (!game.bots.some(b => b.id === botId)) continue;
    let program = PROGRAMS.includes(args.program) ? args.program : normalizeProgram(args.program || args.template || args.intent);
    if (!program) continue;
    if (allowedOps && !programAvailableInLoadout(program, allowedOps)) {
      errors.push(`tool_call program ${program} is locked by equipped knowledge packs`);
      continue;
    }

    const rawTarget = args.targetStructureId || args.targetSawbench || args.target;
    const anyTargetId = game.normalizeStructureId?.(rawTarget, null) || null;
    const anyTarget = anyTargetId ? game.structures.find(s => s.id === anyTargetId) : null;
    let targetStructureId = game.normalizeStructureId?.(args.targetSawbench || (anyTarget?.type === 'sawbench' ? anyTarget.id : rawTarget), 'sawbench') || null;
    let sourceStructureId = game.normalizeStructureId?.(args.sourceStructureId || args.sourceSawbench || args.source, 'sawbench') || null;
    const sourcePaletteId = game.normalizeStructureId?.(args.sourcePaletteId || args.sourcePalette || args.storage || args.palette || (anyTarget?.type === 'item_palette' ? anyTarget.id : null) || (program === 'pickup_item' ? args.source : null), 'item_palette') || null;
    const itemType = game.normalizeItemType?.(args.itemType || args.type || args.item || args.resource, 'log') || 'log';
    let targetFactoryId = game.normalizeStructureId?.(args.targetFactoryId || args.targetFactory || (anyTarget?.type === 'factory' ? anyTarget.id : null), 'factory') || null;
    const targetWorkbenchId = game.normalizeStructureId?.(args.targetWorkbenchId || args.targetWorkbench || args.workbench || (anyTarget?.type === 'workbench' ? anyTarget.id : null), 'workbench') || null;
    const zoneInput = args.zone || args.zoneId || args.searchZone || args.area;
    const normalizedZone = game.normalizeZoneSpec?.(zoneInput) || { zoneId: null, zoneSpec: null };
    if (program === 'haul_planks' && targetStructureId && !targetFactoryId) {
      program = 'make_poles';
      if (sourceStructureId === targetStructureId) sourceStructureId = null;
    }
    if (program === 'haul_planks' && targetStructureId && targetFactoryId && !sourceStructureId) {
      sourceStructureId = targetStructureId;
      targetStructureId = null;
    }

    valid.push({
      name,
      arguments: {
        botId,
        program,
        targetStructureId,
        sourceStructureId,
        sourcePaletteId,
        itemType,
        targetFactoryId,
        targetWorkbenchId,
        zoneId: normalizedZone.zoneId,
        zone: normalizedZone.zoneSpec,
        reason: args.reason || 'Model tool call with validated slots'
      }
    });
  }
  if (!valid.length && rawCalls.length) throw new Error(errors[0] || 'no valid tool calls');
  return valid;
}

export function validateDslAssignments(rawAssignments, game, { loadout } = {}) {
  if (!Array.isArray(rawAssignments)) throw new Error('dsl_assignments must be an array');
  const valid = [];
  const errors = [];
  const allowedOps = loadout ? new Set(summarizeAssistantLoadout(loadout).unlockedOps) : null;
  for (const raw of rawAssignments.slice(0, 10)) {
    const botId = Number(raw.botId || String(raw.bot || '').replace(/^bot:/, ''));
    if (!game.bots.some(b => b.id === botId)) continue;
    const program = raw.program || raw.dsl || raw;
    const checked = game.validateDslProgram?.(program);
    if (!checked?.ok) {
      if (checked?.error) errors.push(checked.error);
      continue;
    }
    if (allowedOps) {
      const locked = [...new Set((checked.program?.steps || []).map(step => step.op).filter(op => !allowedOps.has(op)))];
      if (locked.length) {
        errors.push(`DSL assignment for bot ${botId} uses locked op ${locked.join(', ')}; equipped packs unlock only ${[...allowedOps].join(', ') || '(none)'}`);
        continue;
      }
    }
    valid.push({
      botId,
      program: checked.program || checked.normalizedProgram || program,
      reason: raw.reason || 'Model generated validated DSL loop'
    });
  }
  if (!valid.length && rawAssignments.length) throw new Error(errors[0] || 'no valid DSL assignments');
  return valid;
}

export async function refreshOllamaModels({ endpointInput, modelSelect, statusEl }) {
  const endpoint = endpointInput.value.trim().replace(/\/$/, '') || defaultOllamaEndpoint();
  statusEl.textContent = `Loading models from ${endpoint}/api/tags …`;
  const res = await fetch(`${endpoint}/api/tags`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  const names = (data.models || []).map(m => m.name).filter(n => !/^gemma3/.test(n)).sort();
  modelSelect.innerHTML = names.length ? '' : '<option value="">No models found</option>';
  for (const name of names) { const o = document.createElement('option'); o.value = name; o.textContent = name; modelSelect.appendChild(o); }
  const preferred = preferredOllamaModel(names);
  if (preferred) modelSelect.value = preferred;
  statusEl.textContent = names.length ? `Loaded ${names.length} Ollama model(s). Selected ${preferred}.` : 'No models found.';
  return names;
}

function appendModelOptions(modelSelect, names, { preserve = [] } = {}) {
  const unique = [...new Set([...names, ...preserve].filter(Boolean))];
  modelSelect.innerHTML = unique.length ? '' : '<option value="">No models found</option>';
  for (const name of unique) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name === LOCAL_AI_PROVIDERS.tabbyapi.defaultModel
      ? 'Qwen2.5-Coder 7B Instruct EXL2 6.5bpw (TabbyAPI)'
      : name;
    modelSelect.appendChild(option);
  }
  return unique;
}

export async function refreshLocalAiModels({ provider, endpointInput, modelSelect, statusEl }) {
  const endpoint = endpointInput.value.trim().replace(/\/$/, '') || getDefaultProviderConfig(provider).endpoint;
  if (provider === 'tabbyapi') {
    statusEl.textContent = `Loading models from ${endpoint}/models ...`;
    const res = await fetch(`${endpoint}/models`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const names = (Array.isArray(data?.data) ? data.data : [])
      .map(model => model.id)
      .filter(Boolean)
      .sort();
    appendModelOptions(modelSelect, names, { preserve: [LOCAL_AI_PROVIDERS.tabbyapi.defaultModel] });
    modelSelect.value = names.includes(LOCAL_AI_PROVIDERS.tabbyapi.defaultModel)
      ? LOCAL_AI_PROVIDERS.tabbyapi.defaultModel
      : (names[0] || LOCAL_AI_PROVIDERS.tabbyapi.defaultModel);
    statusEl.textContent = `Loaded ${names.length || 1} TabbyAPI model(s). Selected ${modelSelect.value}.`;
    return names;
  }
  const names = await refreshOllamaModels({ endpointInput, modelSelect, statusEl });
  appendModelOptions(modelSelect, names, { preserve: [LOCAL_AI_PROVIDERS.tabbyapi.defaultModel] });
  if (!modelSelect.value && names[0]) modelSelect.value = names[0];
  return names;
}

export async function parseWithOllama(text, game, { endpoint, model, enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT }) {
  if (!model) {
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true, loadout }) : { help: true, source: 'ollama', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? 'No model selected; workflow template fallback.' : 'No model selected; workflow template fallback disabled.', debug: { sent: { endpoint, model, text, enableTemplates, loadout: normalizeAssistantLoadout(loadout) }, returned: { error: 'No model selected.' } } };
  }
  const started = performance.now();
  const url = `${endpoint}/api/chat`;
  const previousAttempts = [];
  let requestBody = null;
  let sentDebug = null;
  let returned = null;

  const withPreviousAttempts = value => previousAttempts.length ? { ...value, previousAttempts } : value;
  const markModelResponseFailure = err => {
    err.retryWithThinkAllowed = true;
    return err;
  };
  const markTransportFailure = err => {
    err.retryWithThinkAllowed = false;
    return err;
  };
  const recordFailedAttempt = (attempt, think, error) => {
    const failedReturned = { ...(returned || {}), error: error.message };
    previousAttempts.push({ attempt, think, sent: sentDebug || { url, body: requestBody }, returned: failedReturned });
    returned = failedReturned;
  };

  const runAttempt = async ({ attempt, think }) => {
    const built = buildOllamaRequestBody(text, game, { model, enableTemplates, loadout, think });
    requestBody = built.body;
    sentDebug = { url, body: requestBody, request: { text, model, endpoint, enableTemplates, loadout: normalizeAssistantLoadout(loadout), attempt, think }, finalPrompt: built.prompt.finalPrompt };
    console.info('[Orchestrator chat AI] sent to Ollama', sentDebug);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    const httpBody = await res.text().catch(() => '');
    if (!res.ok) {
      returned = { status: res.status, statusText: res.statusText, rawHttpBody: httpBody, rawResponse: httpBody, error: `${res.status} ${res.statusText}` };
      throw markTransportFailure(new Error(`${res.status} ${res.statusText}`));
    }
    let data = null;
    try {
      data = JSON.parse(httpBody || '{}');
    } catch (err) {
      returned = { status: res.status, statusText: res.statusText, rawHttpBody: httpBody, rawResponse: httpBody, error: `Ollama HTTP response was not JSON: ${err.message}` };
      throw markTransportFailure(new Error('Ollama HTTP response was not JSON'));
    }
    const content = data.message?.content || data.response || '';
    returned = { status: res.status, statusText: res.statusText, response: data, rawHttpBody: httpBody, rawResponse: content, content };
    let json = null;
    try {
      json = parseJsonObject(content);
    } catch (err) {
      returned = { ...returned, parseError: err.message, error: err.message };
      throw markModelResponseFailure(err);
    }
    const rawCalls = json.tool_calls || json.calls || [];
    const rawDslAssignments = json.dsl_assignments || json.dslAssignments || [];
    if (!rawCalls.length && !rawDslAssignments.length && (json.help || json.reason || json.error)) {
      const reason = json.reason || json.error || 'The requested command needs an unavailable DSL operation.';
      returned = { ...returned, parsed: json, validCalls: [], validDslAssignments: [], validationErrors: { toolCalls: null, dslAssignments: null } };
      return {
        help: true,
        calls: [],
        dslAssignments: [],
        source: 'ollama',
        meta: `Ollama ${model}: ${reason}${think ? ' (retried with think=true)' : ''}`,
        debug: { sent: sentDebug, returned: withPreviousAttempts(returned) }
      };
    }
    let calls = [], dslAssignments = [], callError = null, dslError = null;
    try { calls = validateToolCalls(rawCalls, game, { loadout }); } catch (err) { callError = err; }
    try { dslAssignments = validateDslAssignments(rawDslAssignments, game, { loadout }); } catch (err) { dslError = err; }
    returned = { ...returned, parsed: json, validCalls: calls, validDslAssignments: dslAssignments, validationErrors: { toolCalls: callError?.message || null, dslAssignments: dslError?.message || null } };
    if (!calls.length && !dslAssignments.length && (callError || dslError)) throw markModelResponseFailure(callError || dslError);
    console.info('[Orchestrator chat AI] returned from Ollama', returned);
    return { calls, dslAssignments, source: 'ollama', meta: `Ollama ${model}: ${Math.round(performance.now() - started)}ms, valid calls=${calls.length}, DSL=${dslAssignments.length}${think ? ', retried with think=true' : ''}`, debug: { sent: sentDebug, returned: withPreviousAttempts(returned) } };
  };

  try {
    try {
      return await runAttempt({ attempt: 1, think: false });
    } catch (firstError) {
      recordFailedAttempt(1, false, firstError);
      if (!isGemma412BModel(model) || !firstError.retryWithThinkAllowed) throw firstError;
      console.warn('[Orchestrator chat AI] Gemma 4 12B parse/validation failed; retrying once with think=true', { sent: sentDebug || { url, body: requestBody }, returned });
      try {
        return await runAttempt({ attempt: 2, think: true });
      } catch (secondError) {
        recordFailedAttempt(2, true, secondError);
        throw secondError;
      }
    }
  } catch (e) {
    returned = withPreviousAttempts({ ...(returned || {}), error: e.message });
    console.warn('[Orchestrator chat AI] Ollama failed/fell back', { sent: sentDebug || { url, body: requestBody }, returned });
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true, loadout }) : { help: true, source: 'ollama', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? `Ollama failed: ${e.message}; workflow template fallback.` : `Ollama failed: ${e.message}; workflow template fallback disabled.`, debug: { sent: sentDebug || { url, body: requestBody }, returned } };
  }
}

export async function parseWithOpenAiCompatible(text, game, { endpoint, model, enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, providerLabel = 'OpenAI-compatible local model' }) {
  if (!model) {
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true, loadout }) : { help: true, source: 'openai-compatible', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? 'No model selected; workflow template fallback.' : 'No model selected; workflow template fallback disabled.', debug: { sent: { endpoint, model, text, enableTemplates, loadout: normalizeAssistantLoadout(loadout) }, returned: { error: 'No model selected.' } } };
  }
  const started = performance.now();
  const url = `${endpoint.replace(/\/$/, '')}/chat/completions`;
  const previousAttempts = [];
  let requestBody = null;
  let sentDebug = null;
  let returned = null;

  const withPreviousAttempts = value => previousAttempts.length ? { ...value, previousAttempts } : value;
  const markModelResponseFailure = err => {
    err.retryAllowed = true;
    return err;
  };
  const markTransportFailure = err => {
    err.retryAllowed = false;
    return err;
  };
  const recordFailedAttempt = (attempt, error) => {
    const failedReturned = { ...(returned || {}), error: error.message };
    previousAttempts.push({ attempt, sent: sentDebug || { url, body: requestBody }, returned: failedReturned });
    returned = failedReturned;
  };

  const runAttempt = async attempt => {
    const built = buildOpenAiCompatibleRequestBody(text, game, { model, enableTemplates, loadout, temperature: 0.1 });
    requestBody = built.body;
    sentDebug = { url, body: requestBody, request: { text, model, endpoint, enableTemplates, loadout: normalizeAssistantLoadout(loadout), attempt }, finalPrompt: built.prompt.finalPrompt };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    const httpBody = await res.text().catch(() => '');
    if (!res.ok) {
      returned = { status: res.status, statusText: res.statusText, rawHttpBody: httpBody, rawResponse: httpBody, error: `${res.status} ${res.statusText}` };
      throw markTransportFailure(new Error(`${res.status} ${res.statusText}`));
    }
    let data = null;
    try {
      data = JSON.parse(httpBody || '{}');
    } catch (err) {
      returned = { status: res.status, statusText: res.statusText, rawHttpBody: httpBody, rawResponse: httpBody, error: `HTTP response was not JSON: ${err.message}` };
      throw markTransportFailure(new Error('HTTP response was not JSON'));
    }
    const content = data.choices?.[0]?.message?.content || '';
    returned = { status: res.status, statusText: res.statusText, response: data, rawHttpBody: httpBody, rawResponse: content, content };
    let json = null;
    try {
      json = parseJsonObject(content);
    } catch (err) {
      returned = { ...returned, parseError: err.message, error: err.message };
      throw markModelResponseFailure(err);
    }
    const rawCalls = json.tool_calls || json.calls || [];
    const rawDslAssignments = json.dsl_assignments || json.dslAssignments || [];
    if (!rawCalls.length && !rawDslAssignments.length && (json.help || json.reason || json.error)) {
      const reason = json.reason || json.error || 'The requested command needs an unavailable DSL operation.';
      returned = { ...returned, parsed: json, validCalls: [], validDslAssignments: [], validationErrors: { toolCalls: null, dslAssignments: null } };
      return {
        help: true,
        calls: [],
        dslAssignments: [],
        source: 'openai-compatible',
        meta: `${providerLabel} ${model}: ${reason}${attempt > 1 ? ' (retried once)' : ''}`,
        debug: { sent: sentDebug, returned: withPreviousAttempts(returned) }
      };
    }
    let calls = [], dslAssignments = [], callError = null, dslError = null;
    try { calls = validateToolCalls(rawCalls, game, { loadout }); } catch (err) { callError = err; }
    try { dslAssignments = validateDslAssignments(rawDslAssignments, game, { loadout }); } catch (err) { dslError = err; }
    returned = { ...returned, parsed: json, validCalls: calls, validDslAssignments: dslAssignments, validationErrors: { toolCalls: callError?.message || null, dslAssignments: dslError?.message || null } };
    if (!calls.length && !dslAssignments.length && (callError || dslError)) throw markModelResponseFailure(callError || dslError);
    return { calls, dslAssignments, source: 'openai-compatible', meta: `${providerLabel} ${model}: ${Math.round(performance.now() - started)}ms, valid calls=${calls.length}, DSL=${dslAssignments.length}${attempt > 1 ? ', retried once' : ''}`, debug: { sent: sentDebug, returned: withPreviousAttempts(returned) } };
  };

  try {
    try {
      return await runAttempt(1);
    } catch (firstError) {
      recordFailedAttempt(1, firstError);
      if (!firstError.retryAllowed) throw firstError;
      return await runAttempt(2);
    }
  } catch (e) {
    if (previousAttempts.length < 2 && sentDebug) recordFailedAttempt(previousAttempts.length + 1, e);
    returned = withPreviousAttempts({ ...(returned || {}), error: e.message });
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true, loadout }) : { help: true, source: 'openai-compatible', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? `${providerLabel} failed: ${e.message}; workflow template fallback.` : `${providerLabel} failed: ${e.message}; workflow template fallback disabled.`, debug: { sent: sentDebug || { url, body: requestBody }, returned } };
  }
}
