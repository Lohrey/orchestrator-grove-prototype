import { PROGRAMS, ASSISTANT_KNOWLEDGE_PACKS, DEFAULT_ASSISTANT_LOADOUT } from './data.js?v=t_building_kits_0618';
import { actionStepDetailsForOps, normalizeActionStepAliasOverrides, validActionStepOps } from './action-steps.js?v=t_building_kits_0618';

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

function nearbyZoneFromText(lower, game) {
  if (!/\bnearby\b/.test(lower)) return null;
  const radiusMatch = lower.match(/\b(?:nearby|within|radius|range)\D{0,16}(\d{2,4})\b/) || lower.match(/\b(\d{2,4})\D{0,16}\bnearby\b/);
  const radius = radiusMatch ? Number(radiusMatch[1]) : undefined;
  return game.normalizeZoneSpec?.({ kind: 'nearby', radius })?.zoneSpec || { kind: 'nearby', radius, name: radius ? `nearby ${radius}px around bot` : 'nearby around bot' };
}

function zoneArgsFromText(lower, game) {
  const nearbyZone = nearbyZoneFromText(lower, game);
  if (nearbyZone) return { zone: nearbyZone };
  const rectZone = game.parseRectangleZoneMention?.(lower);
  if (rectZone) return { zone: rectZone };
  const explicitZone = game.findZoneMention?.(lower);
  if (explicitZone) return { zoneId: explicitZone.id };
  const radiusZone = game.parseRadiusZoneMention?.(lower);
  if (radiusZone) return { zone: radiusZone };
  return {};
}

function numericRadiusFromText(lower) {
  const match = lower.match(/\b(?:radius|range|within|nearby)\D{0,16}(\d{2,4})\b/) || lower.match(/\b(\d{2,4})\s*(?:px|pixels)?\s*(?:radius|range|nearby)\b/);
  return match ? Number(match[1]) : null;
}

function followDistanceFromText(lower) {
  const match = lower.match(/\b(?:distance|spacing|follow\s+distance)\D{0,16}(\d{2,3})\b/);
  return match ? Number(match[1]) : null;
}

function waitSecondsFromText(lower) {
  const match = lower.match(/\b(?:wait|pause)\b(?:\s+for)?\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/)
    || lower.match(/\b(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b.*\b(?:wait|pause)\b/);
  return match ? Number(match[1]) : null;
}

function itemTypeFromText(lower, game) {
  const candidates = ['arrow pack', 'arrow packs', 'quiver', 'crude pickaxe', 'pickaxe', 'crude axe', 'axe', 'tree seeds', 'tree seed', 'seeds', 'seed', 'planks', 'plank', 'boards', 'board', 'logs', 'log', 'wood', 'poles', 'pole', 'sticks', 'stick', 'stones', 'stone', 'rocks', 'rock'];
  const found = candidates.find(word => new RegExp(`\\b${word.replace(/ /g, '\\s+')}\\b`).test(lower));
  const normalized = found === 'wood' ? 'log' : (found?.includes('arrow') || found === 'quiver' ? 'arrow_pack' : found);
  return game.normalizeItemType?.(normalized, 'log') || 'log';
}

function buildingKitTypeFromText(lower, game) {
  const explicit = lower.match(/\b([a-z0-9_ -]+?)\s+kit\b/)?.[0];
  const candidates = [explicit, 'sawbench kit', 'workbench kit', 'crude tool bench kit', 'factory kit', 'bot factory kit', 'item palette kit', 'defense tower kit', 'smithery kit', 'bowmaker kit', 'power station kit', 'camper van kit', 'hammock camp kit', 'solar array kit'].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === explicit || new RegExp(`\\b${candidate.replace(/[_ -]+/g, '\\s+')}\\b`).test(lower)) {
      const kitType = game.normalizeBuildingKitItemType?.(candidate, null);
      if (kitType) return kitType;
    }
  }
  return game.normalizeBuildingKitItemType?.(explicit || 'sawbench kit', 'sawbench_kit') || 'sawbench_kit';
}

function structureTargetFromText(lower, game) {
  return game.findStructureMention?.(lower, null) || (game.structures || []).find(s => lower.includes(String(s.name || '').toLowerCase()) || lower.includes(String(s.type || '').replace(/_/g, ' ')));
}

function weaponTypeFromText(lower, game) {
  const candidates = ['wooden sword', 'sword', 'wooden shield', 'shield', 'bow'];
  const found = candidates.find(word => new RegExp(`\\b${word.replace(/ /g, '\\s+')}s?\\b`).test(lower));
  return game.normalizeWeaponItemType?.(found || 'sword') || (found === 'bow' ? 'bow' : found?.includes('shield') ? 'wooden_shield' : 'wooden_sword');
}

function smitheryRecipeFromText(lower, game) {
  const recipe = /shield/.test(lower) ? 'shield' : 'sword';
  return game.normalizeSmitheryRecipe?.(recipe) || (recipe === 'shield' ? 'wooden_shield' : 'wooden_sword');
}

function sourcePaletteFromText(lower, game) {
  return game.findStructureMention?.(lower, 'item_palette') || (/palette|storage/.test(lower) ? game.structures?.find(s => s.type === 'item_palette') : null);
}

function botIdsFromText(lower, game) {
  const seen = new Set();
  const add = value => {
    const n = Number(String(value || '').replace(/\D+/g, ''));
    if (Number.isFinite(n) && n > 0) seen.add(n);
  };
  if (/\ball\s+bots?\b/.test(lower)) for (const bot of game.bots || []) seen.add(bot.id);
  for (const match of lower.matchAll(/\bbots?\s*[:#-]?\s*((?:\d+\s*(?:,|and|&|\+)?\s*)+)/g)) {
    for (const n of match[1].matchAll(/\d+/g)) add(n[0]);
  }
  for (const match of lower.matchAll(/\bbot\s*[:#-]?\s*(\d+)\b/g)) add(match[1]);
  for (const bot of game.bots || []) {
    const labels = [bot.name, bot.ref, `bot ${bot.id}`, `bot:${bot.id}`].map(v => String(v || '').toLowerCase());
    if (labels.some(label => label && new RegExp(`(^|\\W)${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(\\W|$)`).test(lower))) seen.add(bot.id);
  }
  return [...seen];
}

function followTargetFromText(lower, game) {
  if (/\bfollow\s+(me|player|my character|spieler|mir|mich)\b/.test(lower)) return { target: 'me', targetBotId: null };
  const botTarget = lower.match(/\bfollow\s+(bot\s*[:#-]?\s*(\d+)|bot:(\d+))\b/);
  if (botTarget) {
    const id = Number(botTarget[2] || botTarget[3]);
    const bot = game.findBot?.(id) || (game.bots || []).find(b => b.id === id);
    return { target: bot?.name || `Bot ${id}`, targetBotId: id };
  }
  const named = (game.bots || []).find(bot => {
    const name = String(bot.name || '').toLowerCase();
    return name && lower.includes(`follow ${name}`);
  });
  if (named) return { target: named.name, targetBotId: named.id };
  return { target: 'me', targetBotId: null };
}

function renameBotNameFromText(text, botId, game) {
  const source = String(text || '').trim();
  const escapedId = String(botId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\b(?:rename|name|call)\\s+bot\\s*[:#-]?\\s*${escapedId}\\s+(?:to|as)?\\s+(.+)$`, 'i'),
    new RegExp(`\\bbot\\s*[:#-]?\\s*${escapedId}\\s+(?:rename|name|call)\\s+(?:to|as)?\\s+(.+)$`, 'i')
  ];
  const match = patterns.map(pattern => source.match(pattern)).find(Boolean);
  const rawName = match?.[1]
    ?.replace(/[.!?]+$/g, '')
    ?.trim()
    ?.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  const fallback = String(rawName || '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>`{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32)
    .trim();
  return game.normalizeBotDisplayName?.(rawName, { minLength: 2, maxLength: 32 }) || (fallback.length >= 2 ? fallback : '');
}

function attackTypeFromText(lower) {
  if (/night\s+monsters?|night_monster/.test(lower)) return 'night_monster';
  if (/passive\s+monsters?|passive_monster/.test(lower)) return 'passive_monster';
  if (/throne|tower|structure/.test(lower)) return 'structure';
  if (/monsters?|enemies|enemy|hostiles?|hostile/.test(lower)) return 'monster';
  return 'monster';
}

function delegateTargetFromText(text, game) {
  const source = String(text || '').trim();
  const match = source.match(/\bdelegate\s+(?:to\s+)?(?:manager\s+)?([^:]+)\s*:\s*(.+)$/i)
    || source.match(/\bask\s+manager\s+([^:]+)\s*:\s*(.+)$/i);
  if (!match) return null;
  const recipientRaw = match[1].replace(/\b(to|manager)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const message = match[2].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  const recipient = game.resolveBotReference?.(recipientRaw) || null;
  return { recipient: recipient ? (recipient.name || recipient.ref || `Bot ${recipient.id}`) : recipientRaw, message };
}

function packCatalog(knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  return knowledgePacks && typeof knowledgePacks === 'object' ? knowledgePacks : ASSISTANT_KNOWLEDGE_PACKS;
}

export function estimateTokenCount(text = '') {
  const value = String(text || '');
  if (!value.trim()) return 0;
  return Math.max(1, Math.ceil(value.length / 4));
}

function estimateValueTokenCount(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return estimateTokenCount(value);
  try {
    return estimateTokenCount(JSON.stringify(value));
  } catch {
    return estimateTokenCount(String(value));
  }
}

function parseTextList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
}

function derivePackConcepts(pack, actions) {
  const explicit = parseTextList(pack.concepts);
  if (explicit.length) return explicit;
  return actions.length
    ? [`Action pack exposing ${actions.map(action => action.label || action.op).join(', ')}.`]
    : ['Custom action pack.'];
}

function derivePackVocabulary(pack, actions) {
  const explicit = parseTextList(pack.vocabulary);
  return [...new Set([...explicit, ...actions.flatMap(action => [action.op, action.label, ...(action.args || []), ...(action.aliasVocabulary || [])])]
    .map(value => String(value || '').toLowerCase().replace(/_/g, ' ').trim())
    .filter(Boolean))];
}

export function normalizeAssistantKnowledgePack(pack = {}) {
  const id = String(pack.id || '').trim();
  const selectedOps = validActionStepOps(pack.unlockedOps || pack.selectedOps || pack.ops || []);
  const actionPartAliases = normalizeActionStepAliasOverrides(pack.actionPartAliases || pack.partAliases || {}, selectedOps);
  const actions = actionStepDetailsForOps(selectedOps, { actionPartAliases });
  const normalized = {
    id,
    name: String(pack.name || id || 'Custom Action Pack').trim(),
    custom: !!pack.custom,
    concepts: derivePackConcepts(pack, actions),
    vocabulary: derivePackVocabulary(pack, actions),
    optionalContext: parseTextList(pack.optionalContext || pack.contextVariables),
    contextVariables: parseTextList(pack.contextVariables || pack.optionalContext),
    unlockedOps: selectedOps,
    actionPartAliases,
    actions,
    actionDetails: actions,
    examples: Array.isArray(pack.examples) ? pack.examples : parseTextList(pack.examples)
  };
  return {
    ...normalized,
    tokenCount: estimateValueTokenCount(normalized)
  };
}

export function normalizeAssistantPackCatalog(knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  const catalog = packCatalog(knowledgePacks);
  return Object.fromEntries(Object.values(catalog)
    .map(normalizeAssistantKnowledgePack)
    .filter(pack => pack.id)
    .map(pack => [pack.id, pack]));
}

export function normalizeAssistantLoadout(loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  const source = Array.isArray(loadout) ? loadout : DEFAULT_ASSISTANT_LOADOUT;
  const catalog = normalizeAssistantPackCatalog(knowledgePacks);
  return [...new Set(source)].filter(id => catalog[id]);
}

export function getAssistantKnowledgePacks(loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  const catalog = normalizeAssistantPackCatalog(knowledgePacks);
  return normalizeAssistantLoadout(loadout, catalog).map(id => catalog[id]).filter(Boolean);
}

export function formatAssistantLoadout(loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  return getAssistantKnowledgePacks(loadout, knowledgePacks).map(pack => ({
    id: pack.id,
    name: pack.name,
    custom: !!pack.custom,
    tokenCount: pack.tokenCount || estimateValueTokenCount(pack),
    concepts: pack.concepts,
    vocabulary: pack.vocabulary,
    optionalContext: pack.optionalContext || [],
    contextVariables: pack.contextVariables || pack.optionalContext || [],
    unlockedOps: pack.unlockedOps,
    actions: pack.actions || actionStepDetailsForOps(pack.unlockedOps),
    actionDetails: pack.actionDetails || actionStepDetailsForOps(pack.unlockedOps),
    examples: pack.examples
  }));
}

export function summarizeAssistantLoadout(loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  const packs = formatAssistantLoadout(loadout, knowledgePacks);
  return {
    ids: packs.map(pack => pack.id),
    names: packs.map(pack => pack.name),
    tokenCount: packs.reduce((sum, pack) => sum + Number(pack.tokenCount || 0), 0),
    unlockedOps: [...new Set(packs.flatMap(pack => pack.unlockedOps))],
    optionalContext: [...new Set(packs.flatMap(pack => pack.optionalContext || []))],
    vocabulary: [...new Set(packs.flatMap(pack => pack.vocabulary))],
    concepts: packs.flatMap(pack => pack.concepts),
    packs
  };
}

function normalizeGeneratedProgramSteps(steps = []) {
  const list = Array.isArray(steps) ? steps.slice() : [];
  const repeat = list.at(-1)?.op === 'loop';
  return {
    repeat,
    steps: repeat ? list.slice(0, -1) : list
  };
}

function repeatRequested(lower, defaultRepeat = false) {
  if (/\b(once|one time|single|just once)\b/.test(lower)) return false;
  if (/\b(keep|forever|repeat|repeatedly|loop|always|continue|maintain)\b/.test(lower)) return true;
  return defaultRepeat;
}

function dslAssignment(botId, name, steps, reason, repeat = null) {
  const normalized = normalizeGeneratedProgramSteps(steps);
  return { botId, program: { id: 'generated_taught_loop', name, repeat: repeat ?? normalized.repeat, steps: normalized.steps }, reason };
}

function dslAssigneeAssignment(assignee, name, steps, reason, repeat = null) {
  const normalized = normalizeGeneratedProgramSteps(steps);
  return { assignee, program: { id: 'generated_taught_loop', name, repeat: repeat ?? normalized.repeat, steps: normalized.steps }, reason };
}

function mentionsAnyEligibleBot(lower) {
  return /\b(someone|anyone|anybody|whichever bot|a bot|any idle bot|any free bot|some bot)\b/.test(lower);
}

function compileDslIntent({ botId, text, lower, game, unlockedOps }) {
  const zoneArgs = zoneArgsFromText(lower, game);
  const zone = zoneArgs.zone || zoneArgs.zoneId || null;
  const withZone = step => zone ? { ...step, zone } : step;
  const canUse = steps => !unlockedOps || steps.every(step => unlockedOps.has(step.op));
  if (botId && /\b(delegate|ask)\b.*\bmanager\b/.test(lower)) {
    const delegated = delegateTargetFromText(text, game);
    if (delegated?.recipient && delegated.message) {
      const steps = [{ op: 'delegate_to_manager', recipient: delegated.recipient, message: delegated.message }, { op: 'loop' }];
      if (canUse(steps)) return dslAssignment(botId, 'Delegate to manager', steps, 'Generated pack-backed DSL: send a manager instruction.', false);
    }
  }
  if (botId && /\b(promote|make|set)\b.*\bmanager\b|\bmanager\b.*\b(promote|make|set)\b/.test(lower)) {
    const steps = [{ op: 'promote_to_manager' }, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Promote to manager', steps, 'Generated pack-backed DSL: promote the requested bot to manager status.', false);
  }
  if (botId && /\b(rename|name|call)\b/.test(lower)) {
    const name = renameBotNameFromText(text, botId, game);
    if (name) {
      const steps = [{ op: 'rename_bot', name }, { op: 'loop' }];
      if (canUse(steps)) return dslAssignment(botId, `Rename bot to ${name}`, steps, 'Generated pack-backed DSL: rename the requested bot.', false);
    }
  }
  if (botId && /\b(wait|pause)\b/.test(lower)) {
    const seconds = waitSecondsFromText(lower) ?? 1;
    const steps = [{ op: 'wait', seconds }, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, `Wait ${seconds} seconds`, steps, 'Generated pack-backed DSL: pause this bot before advancing.', false);
  }
  if (botId && (/\bguard\b|\bhold\s+(?:this\s+)?(?:area|position|zone|post)\b/.test(lower))) {
    const radius = numericRadiusFromText(lower);
    const step = withZone({ op: 'guard_area' });
    if (radius) step.radius = radius;
    const steps = [step, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Guard area', steps, 'Generated pack-backed DSL: hold a guard center, attack local hostiles, and return to post.', repeatRequested(lower, true));
  }
  if (botId && /\bpatrol\b/.test(lower)) {
    const radius = numericRadiusFromText(lower);
    const points = [{ x: game.findBot?.(botId)?.x || 320, y: game.findBot?.(botId)?.y || 320 }, { x: (game.findBot?.(botId)?.x || 320) + 160, y: game.findBot?.(botId)?.y || 320 }];
    const step = { op: 'patrol_route', points, radius: radius || 180 };
    const steps = [step, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Patrol route', steps, 'Generated pack-backed DSL: patrol between checkpoints and attack nearby threats.', repeatRequested(lower, true));
  }
  if (botId && /\b(equip|arm|pick\s*up|grab)\b.*\b(sword|shield|bow)\b/.test(lower)) {
    const steps = [{ op: 'equip_item', type: weaponTypeFromText(lower, game) }, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Equip weaponry', steps, 'Generated pack-backed DSL: equip only supported weaponry.', false);
  }
  if (botId && /\b(deploy|place|build)\b.*\bkit\b|\bkit\b.*\b(deploy|place|build)\b/.test(lower)) {
    const kitType = buildingKitTypeFromText(lower, game);
    const step = withZone({ op: 'deploy_building_kit', type: kitType });
    const steps = [{ op: 'pick_up', type: kitType }, step, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, `Deploy ${kitType.replace(/_/g, ' ')}`, steps, 'Generated pack-backed DSL: pick up and deploy a building kit.', false);
  }
  if (botId && /\b(disassemble|pack\s*up|pack|tear\s*down)\b.*\b(building|bench|factory|tower|palette|station|camp|sawbench|workbench|smithery|bowmaker)\b|\b(building|bench|factory|tower|palette|station|camp|sawbench|workbench|smithery|bowmaker)\b.*\b(disassemble|pack\s*up|tear\s*down)\b/.test(lower)) {
    const target = structureTargetFromText(lower, game);
    const steps = [{ op: 'disassemble_building_to_kit', ...(target ? { target: target.name, structureId: target.id, structureType: target.type } : { target: 'building' }) }, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Disassemble building to kit', steps, 'Generated pack-backed DSL: remove a building and carry its matching kit.', false);
  }
  if (botId && /\b(craft|make|produce)\b.*\b(sword|shield)\b/.test(lower)) {
    const smithery = game.findStructureMention?.(lower, 'smithery') || game.structures?.find(s => s.type === 'smithery');
    const step = { op: 'craft_smithery', recipe: smitheryRecipeFromText(lower, game) };
    if (smithery) step.target = smithery.name;
    const steps = [step, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Craft smithery weapon', steps, 'Generated pack-backed DSL: craft an existing smithery weapon recipe.', repeatRequested(lower, false));
  }
  if (botId && /\b(craft|make|produce)\b.*\bbows?\b/.test(lower)) {
    const bowmaker = game.findStructureMention?.(lower, 'bowmaker') || game.structures?.find(s => s.type === 'bowmaker');
    const step = { op: 'craft_bowmaker', recipe: 'bow' };
    if (bowmaker) step.target = bowmaker.name;
    const steps = [step, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Craft bow', steps, 'Generated pack-backed DSL: craft the existing bowmaker recipe.', repeatRequested(lower, false));
  }
  if (botId && /\b(craft|make|produce|fletch)\b.*\b(arrow\s*packs?|arrows?)\b|\barrowmaker\b/.test(lower)) {
    const arrowmaker = game.findStructureMention?.(lower, 'arrowmaker') || game.structures?.find(s => s.type === 'arrowmaker');
    const step = { op: 'craft_arrowmaker', recipe: 'arrow_pack' };
    if (arrowmaker) step.target = arrowmaker.name;
    const steps = [step, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Craft arrow packs', steps, 'Generated pack-backed DSL: craft the existing arrowmaker recipe.', repeatRequested(lower, false));
  }
  if (botId && /\bfollow\b|\bescort\b/.test(lower)) {
    const targetInfo = followTargetFromText(lower, game);
    const distance = followDistanceFromText(lower);
    const step = { op: 'follow', target: targetInfo.target };
    if (distance) step.distance = distance;
    const steps = [step, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, `Follow ${targetInfo.target}`, steps, 'Generated pack-backed DSL: follow a moving player/bot target.', repeatRequested(lower, true));
  }
  if (botId && /\b(attack|fight|kill|hunt|engage)\b/.test(lower)) {
    const zoneArgs = zoneArgsFromText(lower, game);
    const zone = zoneArgs.zone || zoneArgs.zoneId || null;
    const radius = numericRadiusFromText(lower);
    const step = { op: 'attack', type: attackTypeFromText(lower) };
    if (zone) step.zone = zone;
    if (radius) step.radius = radius;
    const steps = [step, { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Attack hostile targets', steps, 'Generated pack-backed DSL: move into range and attack hostile targets.', repeatRequested(lower, true));
  }
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
    if (canUse(steps)) return dslAssignment(botId, `Bring ${playerItemType.replace(/_/g, ' ')} to player`, steps, 'Generated pack-backed DSL: pick up the item and deliver it to the player storage slot.', repeatRequested(lower, false));
  }
  const wantsTakeFromPlayer = mentionsPlayer && (/\b(take|grab|get|collect|remove)\b.*\b(from|out of)\b/.test(lower) || /\bfrom\s+(me|player|my character)\b/.test(lower));
  if (botId && wantsTakeFromPlayer) {
    const steps = [
      { op: 'take_from_player', type: playerItemType },
      { op: 'loop' }
    ];
    if (canUse(steps)) return dslAssignment(botId, `Take ${playerItemType.replace(/_/g, ' ')} from player`, steps, 'Generated pack-backed DSL: take one matching item from the player storage slot.', repeatRequested(lower, false));
  }
  if (botId && sawbench && wantsLogFeed) {
    const steps = [
      withZone({ op: 'pick_up', type: 'log' }),
      { op: 'deposit_to_structure', type: 'log', structureId: sawbench.id, structureName: sawbench.name, structureType: sawbench.type },
      { op: 'loop' }
    ];
    if (canUse(steps)) return dslAssignment(botId, 'Feed sawbench with logs', steps, 'Generated pack-backed DSL: pick up logs, deposit to sawbench, repeat.', repeatRequested(lower, true));
  }
  if (botId && /plant|sow|replant/.test(lower) && /seed|tree/.test(lower)) {
    const steps = [
      withZone({ op: 'pick_up', type: 'tree_seed' }),
      withZone({ op: 'plant_seed' }),
      { op: 'loop' }
    ];
    if (canUse(steps)) return dslAssignment(botId, 'Plant tree seeds', steps, 'Generated pack-backed DSL: collect tree seeds and plant them in open holes.', repeatRequested(lower, true));
  }
  if (botId && /mine|quarry|pickaxe/.test(lower) && /stone|rock/.test(lower)) {
    const steps = [withZone({ op: 'mine_stone' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Mine stone', steps, 'Generated pack-backed DSL: mine stone deposits repeatedly.', repeatRequested(lower, true));
  }
  if (botId && /(search|forage).*(tree|wood)|tree.*(search|forage)/.test(lower)) {
    const steps = [withZone({ op: 'search_tree' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Search trees', steps, 'Generated pack-backed DSL: search trees repeatedly.', repeatRequested(lower, true));
  }
  if (botId && /(chop|cut|fell).*(tree|wood)|(tree|wood).*(chop|cut|fell)/.test(lower)) {
    const steps = [withZone({ op: 'chop_tree' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Chop trees', steps, 'Generated pack-backed DSL: chop trees repeatedly.', repeatRequested(lower, true));
  }
  if (botId && /search.*hemp|hemp.*search/.test(lower)) {
    const steps = [withZone({ op: 'search_hemp' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Search hemp', steps, 'Generated pack-backed DSL: search hemp repeatedly.', repeatRequested(lower, true));
  }
  if (botId && /(chop|cut).*(hemp)|hemp.*(chop|cut)/.test(lower)) {
    const steps = [withZone({ op: 'chop_hemp' }), { op: 'loop' }];
    if (canUse(steps)) return dslAssignment(botId, 'Chop hemp', steps, 'Generated pack-backed DSL: chop hemp repeatedly.', repeatRequested(lower, true));
  }
  return null;
}

function compileDslIntentForAssignee({ assignee, text, lower, game, unlockedOps }) {
  const assignment = compileDslIntent({ botId: 1, text, lower, game, unlockedOps });
  if (!assignment?.program?.steps?.length) return null;
  return dslAssigneeAssignment(assignee, assignment.program.name, assignment.program.steps, assignment.reason, assignment.program.repeat);
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

export function parseAssistantRequest(text, game, { enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS } = {}) {
  if (!enableTemplates) {
    return { help: true, source: 'mock', meta: 'Workflow template routing is disabled in Settings.' };
  }
  const loadoutSummary = summarizeAssistantLoadout(loadout, knowledgePacks);
  const unlockedOps = new Set(loadoutSummary.unlockedOps);
  const lower = text.toLowerCase();
  const calls = [];
  if (/all\s+bots?.*(idle|stop|park)/.test(lower)) {
    for (const bot of game.bots) calls.push({ name: 'assignBotProgram', arguments: { botId: bot.id, program: 'idle', reason: 'All bots idle' } });
    return { calls, source: 'mock' };
  }
  let botMatches = botIdsFromText(lower, game);
  if (/\bfollow\b/.test(lower)) {
    const targetInfo = followTargetFromText(lower, game);
    if (targetInfo.targetBotId && botMatches.length > 1) botMatches = botMatches.filter(id => id !== targetInfo.targetBotId);
  }
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
  const dslAssignments = botMatches.map(botId => compileDslIntent({ botId, text, lower, game, unlockedOps })).filter(Boolean);
  if (dslAssignments.length) return { dslAssignments, source: 'mock', meta: `Generated DSL for ${dslAssignments.length} bot(s) from equipped knowledge packs.` };
  if (!botMatches.length && mentionsAnyEligibleBot(lower)) {
    const anyEligibleAssignment = compileDslIntentForAssignee({
      assignee: { strategy: 'any_eligible' },
      text,
      lower,
      game,
      unlockedOps
    });
    if (anyEligibleAssignment) return { dslAssignments: [anyEligibleAssignment], source: 'mock', meta: 'Generated DSL for any eligible idle worker bot.' };
  }
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

const CANONICAL_ITEM_TYPES = ['log', 'plank', 'pole', 'stick', 'stone', 'tree_seed', 'crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer', 'hemp', 'hemp_seed', 'sawbench_kit', 'workbench_kit', 'factory_kit', 'item_palette_kit'];

const RESOURCE_STRUCTURE_RULES = {
  resourcesAreNotStructures: ['tree', 'trees', 'hemp', 'stone deposit', 'stone_deposit', 'rock', 'rocks', 'dug hole', 'hole'],
  structureOps: ['move_to_structure', 'deposit_to_structure', 'pick_up_from_storage'],
  rule: 'Trees/hemp/stone deposits/holes are resources, not structures. Never put resource words into target/source/structureName for structure ops. If the resource op is locked, return help instead of substituting a structure op.'
};

function packIdsUnlockingOp(op, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  return Object.values(normalizeAssistantPackCatalog(knowledgePacks)).filter(pack => pack.unlockedOps.includes(op)).map(pack => pack.id);
}

function likelyLockedRequestHints(text, unlockedOps, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  const lower = String(text || '').toLowerCase();
  const allowed = new Set(unlockedOps);
  const hints = [];
  const maybePush = (op, pattern, reason) => {
    if (pattern.test(lower) && !allowed.has(op)) {
      hints.push({ op, requiredPacks: packIdsUnlockingOp(op, knowledgePacks), reason, doNotSubstituteWith: RESOURCE_STRUCTURE_RULES.structureOps });
    }
  };
  maybePush('chop_tree', /\b(chop|cut|fell)\b.*\b(tree|trees|wood)\b|\b(tree|trees|wood)\b.*\b(chop|cut|fell)\b/, 'Tree chopping requires chop_tree; trees are resources, not move_to_structure targets.');
  maybePush('search_tree', /\b(search|look)\b.*\b(tree|trees)\b|\b(stick|sticks|seed|seeds)\b.*\b(tree|trees)\b/, 'Searching trees requires search_tree; trees are resources, not structures.');
  maybePush('mine_stone', /\b(mine|quarry)\b.*\b(stone|rock|rocks)\b|\b(stone|rock|rocks)\b.*\b(mine|quarry)\b/, 'Mining stone requires mine_stone; stone deposits are resources, not structures.');
  maybePush('plant_seed', /\b(plant|sow)\b.*\b(seed|tree_seed|tree seed)\b/, 'Planting tree seeds requires plant_seed plus an open dug hole.');
  return hints;
}

export const ASSISTANT_PROTOCOL_KERNEL = Object.freeze({
  role: 'command_compiler',
  responseSchema: Object.freeze({
    type: 'object',
    required: ['dsl_assignments'],
    properties: Object.freeze({
      dsl_assignments: Object.freeze({
        type: 'array',
        items: Object.freeze({
          type: 'object',
          required: ['program'],
          properties: Object.freeze({
            botId: Object.freeze({ type: 'number' }),
            assignee: Object.freeze({
              type: 'object',
              required: ['strategy'],
              properties: Object.freeze({
                strategy: Object.freeze({ type: 'string' })
              })
            }),
            program: Object.freeze({
              type: 'object',
              required: ['repeat', 'steps'],
              properties: Object.freeze({
                repeat: Object.freeze({ type: 'boolean' }),
                steps: Object.freeze({
                  type: 'array',
                  items: Object.freeze({ type: 'object', required: ['op'] })
                })
              })
            })
          })
        })
      }),
      help: Object.freeze({ type: 'boolean' }),
      reason: Object.freeze({ type: 'string' }),
      missingOps: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }),
      requiredPacks: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) })
    })
  }),
  rules: Object.freeze([
    'Return exactly one compact JSON object and nothing else.',
    'Use only operations supplied in capabilities.actions.',
    'Preserve the requested action order.',
    'Use program.repeat true for repeating work and false for one-shot work.',
    'Each step is a flat object with one op and only arguments declared for that operation.',
    'Do not invent operation names or argument names.',
    'When the request cannot be represented, return an empty dsl_assignments array with help, reason, missingOps, and requiredPacks.',
    'Never output markdown or JavaScript.'
  ])
});


function compactActionRule(action) {
  const signature = String(action.promptSignature || '');
  const separator = signature.indexOf(' - ');
  return separator >= 0 ? signature.slice(separator + 3) : (action.description || '');
}

function mergeUniqueStrings(...lists) {
  return [...new Set(lists.flat().map(value => String(value || '').trim()).filter(Boolean))];
}

function compactCapabilities(equippedPacks) {
  const actionsByOp = new Map();
  for (const pack of equippedPacks) {
    for (const action of pack.actions || []) {
      const aliases = action.partAliases || { step: [], args: {} };
      const current = actionsByOp.get(action.op);
      if (!current) {
        const contract = { op: action.op, args: action.args || [], rule: compactActionRule(action) };
        if ((aliases.step || []).length) contract.aliases = aliases.step;
        const argAliases = Object.fromEntries(Object.entries(aliases.args || {}).filter(([, values]) => values?.length));
        if (Object.keys(argAliases).length) contract.argAliases = argAliases;
        actionsByOp.set(action.op, contract);
        continue;
      }
      current.aliases = mergeUniqueStrings(current.aliases || [], aliases.step || []);
      for (const [arg, values] of Object.entries(aliases.args || {})) {
        current.argAliases ||= {};
        current.argAliases[arg] = mergeUniqueStrings(current.argAliases[arg] || [], values || []);
      }
    }
  }
  return [...actionsByOp.values()];
}

function requestWords(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9_]+/g) || []);
}

function relevantPackRecipes(text, equippedPacks, limit = 2) {
  const wanted = requestWords(text);
  return equippedPacks.flatMap(pack => (pack.examples || [])
    .filter(example => example && typeof example === 'object' && example.intent && example.dsl)
    .map(example => ({
      score: [...requestWords(example.intent)].filter(word => word.length > 2 && wanted.has(word)).length,
      intent: example.intent,
      dsl: example.dsl
    })))
    .filter(recipe => recipe.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ intent, dsl }) => ({ intent, dsl }));
}

function mentionsPhrase(text, phrase) {
  const normalized = String(phrase || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|\\b)${escaped}(?:$|\\b)`, 'i').test(String(text || '').replace(/[_-]+/g, ' '));
}

function relevantRuntimeSymbols(text, game, equippedPacks) {
  const wanted = new Set(equippedPacks.flatMap(pack => pack.optionalContext || []));
  const symbols = {};
  if (wanted.has('availableBotNames')) {
    const bots = (game.bots || []).filter(bot => [bot.ref, bot.name, `bot ${bot.id}`].some(value => mentionsPhrase(text, value)))
      .slice(0, 8)
      .map(bot => ({ id: bot.id, ref: bot.ref || `bot ${bot.id}`, name: bot.name || `Bot ${bot.id}` }));
    if (bots.length) symbols.bots = bots;
  }
  if (wanted.has('availableBuildingNames')) {
    const structures = (game.structures || []).filter(structure => [structure.ref, structure.name, structure.type].some(value => mentionsPhrase(text, value)))
      .slice(0, 8)
      .map(structure => ({ id: structure.id, ref: structure.ref, name: structure.name, type: structure.type }));
    if (structures.length) symbols.structures = structures;
  }
  const zones = (game.zones || []).filter(zone => mentionsPhrase(text, zone.name || `zone ${zone.id}`))
    .slice(0, 8)
    .map(zone => ({ id: zone.id, name: zone.name, kind: zone.kind }));
  if (zones.length) symbols.zones = zones;
  if (wanted.has('availableItemTypes')) {
    const items = CANONICAL_ITEM_TYPES.filter(type => {
      const words = type.split('_');
      return mentionsPhrase(text, type) || (words.length > 1 && mentionsPhrase(text, words.at(-1)));
    });
    if (items.length) symbols.itemTypes = items;
  }
  if (wanted.has('availableTemplateNames')) {
    const templates = (game.customTemplates || []).map(template => template.name).filter(name => mentionsPhrase(text, name)).slice(0, 8);
    if (templates.length) symbols.templates = templates;
  }
  if (wanted.has('availableMonsterTypes')) {
    const monsterTypes = [...new Set((game.monsters || []).map(monster => monster.type || monster.kind || 'monster').concat(['monster', 'night_monster', 'passive_monster']))]
      .filter(type => mentionsPhrase(text, type));
    if (monsterTypes.length) symbols.monsterTypes = monsterTypes;
  }
  if (wanted.has('currentPlayerInventory') && /\b(player|me|my)\b/i.test(text) && game.player?.inventory?.type) {
    symbols.playerInventory = game.player.inventory.type;
  }
  return symbols;
}

export function buildOllamaKnowledge(text, game, { loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS } = {}) {
  const equippedPacks = formatAssistantLoadout(loadout, knowledgePacks);
  const unlockedOps = [...new Set(equippedPacks.flatMap(pack => pack.unlockedOps))];
  return {
    capabilities: {
      actions: compactCapabilities(equippedPacks),
      facts: mergeUniqueStrings(equippedPacks.flatMap(pack => pack.concepts || [])),
      recipes: relevantPackRecipes(text, equippedPacks)
    },
    symbols: relevantRuntimeSymbols(text, game, equippedPacks),
    lockedRequestHints: likelyLockedRequestHints(text, unlockedOps, knowledgePacks),
    request: text,
  };
}

export function formatOllamaFinalPrompt(messages = []) {
  return messages.map(message => `${String(message.role || 'message').toUpperCase()}:\n${message.content || ''}`).join('\n\n---\n\n');
}

function appendRepairMessages(messages, repairContext = null) {
  if (!repairContext) return messages;
  return [
    ...messages,
    { role: 'assistant', content: repairContext.previousAnswer || '{}' },
    {
      role: 'user',
      content: JSON.stringify({
        repair: true,
        error: repairContext.error || 'Previous answer failed validation.',
        validationDetails: repairContext.validationDetails || [],
        instruction: 'Correct the previous JSON answer. Keep the same intent. Return one corrected JSON object only.'
      })
    }
  ];
}

export function buildOllamaPrompt(text, game, { enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS, repairContext = null } = {}) {
  const equippedPacks = formatAssistantLoadout(loadout, knowledgePacks);
  const unlockedOps = [...new Set(equippedPacks.flatMap(pack => pack.unlockedOps))];
  const knowledge = buildOllamaKnowledge(text, game, { loadout, knowledgePacks });
  const systemPrompt = JSON.stringify(ASSISTANT_PROTOCOL_KERNEL);
  const userPrompt = JSON.stringify(knowledge);
  const baseMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  const messages = appendRepairMessages(baseMessages, repairContext);
  const loadoutKnowledge = { equippedPacks, unlockedOps, actionGuide: knowledge.capabilities.actions };
  const finalPrompt = formatOllamaFinalPrompt(messages);
  return {
    systemPrompt,
    userPrompt,
    messages,
    finalPrompt,
    finalPromptTokens: estimateTokenCount(finalPrompt),
    systemPromptTokens: estimateTokenCount(systemPrompt),
    userPromptTokens: estimateTokenCount(userPrompt),
    messagesTokenCount: messages.reduce((sum, message) => sum + estimateValueTokenCount(`${String(message.role || 'message').toUpperCase()}:\n${message.content || ''}`), 0),
    equippedPacks,
    unlockedOps,
    knowledge,
    loadoutKnowledge
  };
}

export function isGemma412BModel(model) {
  return /^gemma4[:_-]12b(?:$|[:_-])/i.test(String(model || '').trim());
}

export function buildOllamaRequestBody(text, game, { model, enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS, think = false, repairContext = null } = {}) {
  const prompt = buildOllamaPrompt(text, game, { enableTemplates, loadout, knowledgePacks, repairContext });
  const body = {
    model, stream: false, format: 'json', think,
    messages: prompt.messages,
    options: { temperature: 0, num_predict: 180, num_ctx: 4096 }
  };
  return { body, prompt };
}

export function buildOpenAiCompatibleRequestBody(text, game, { model, enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS, temperature = 0.1, repairContext = null } = {}) {
  const prompt = buildOllamaPrompt(text, game, { enableTemplates, loadout, knowledgePacks, repairContext });
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

function attachValidationMetadata(error, message, validationDetails = []) {
  const err = error instanceof Error ? error : new Error(message);
  if (message) err.message = message;
  err.validationDetails = validationDetails;
  return err;
}

function extractUsage(provider, response = {}) {
  if (provider === 'ollama') {
    return {
      inputTokens: Number(response?.prompt_eval_count || 0),
      outputTokens: Number(response?.eval_count || 0)
    };
  }
  return {
    inputTokens: Number(response?.usage?.prompt_tokens || 0),
    outputTokens: Number(response?.usage?.completion_tokens || 0)
  };
}

function buildRepairContext(returned, error) {
  return {
    previousAnswer: returned?.rawResponse || returned?.content || returned?.rawHttpBody || '{}',
    error: error?.message || returned?.error || 'Previous answer failed validation.',
    validationDetails: error?.validationDetails || returned?.validationErrors?.details || []
  };
}

export function validateToolCalls(rawCalls, game, { loadout, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS } = {}) {
  if (!Array.isArray(rawCalls)) throw new Error('tool_calls must be an array');
  const valid = [];
  const errors = [];
  const validationDetails = [];
  const allowedOps = loadout ? new Set(summarizeAssistantLoadout(loadout, knowledgePacks).unlockedOps) : null;
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
      validationDetails.push({ code: 'locked_program', field: 'program', value: program });
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
  if (!valid.length && rawCalls.length) throw attachValidationMetadata(new Error(errors[0] || 'no valid tool calls'), errors[0] || 'no valid tool calls', validationDetails);
  return valid;
}

export function validateDslAssignments(rawAssignments, game, { loadout, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS } = {}) {
  if (!Array.isArray(rawAssignments)) throw new Error('dsl_assignments must be an array');
  const valid = [];
  const errors = [];
  const validationDetails = [];
  const allowedOps = loadout ? new Set(summarizeAssistantLoadout(loadout, knowledgePacks).unlockedOps) : null;
  for (const raw of rawAssignments.slice(0, 10)) {
    const botId = Number(raw.botId || String(raw.bot || '').replace(/^bot:/, ''));
    const assigneeStrategy = String(raw.assignee?.strategy || '').trim();
    const hasBotId = game.bots.some(b => b.id === botId);
    const hasAnyEligibleAssignee = assigneeStrategy === 'any_eligible';
    if (!hasBotId && !hasAnyEligibleAssignee) {
      errors.push('DSL assignment requires botId or assignee.strategy any_eligible');
      validationDetails.push({ code: 'missing_assignee', field: hasBotId ? 'botId' : 'assignee', value: raw });
      continue;
    }
    const program = raw.program || raw.dsl || raw;
    const checked = game.validateDslProgram?.(program);
    if (!checked?.ok) {
      if (checked?.error) errors.push(checked.error);
      if (checked?.details?.length) validationDetails.push(...checked.details);
      continue;
    }
    if (allowedOps) {
      const locked = [...new Set((checked.program?.steps || []).map(step => step.op).filter(op => !allowedOps.has(op)))];
      if (locked.length) {
        errors.push(`DSL assignment for ${hasBotId ? `bot ${botId}` : 'assignee any_eligible'} uses locked op ${locked.join(', ')}; equipped packs unlock only ${[...allowedOps].join(', ') || '(none)'}`);
        validationDetails.push(...locked.map(op => ({ code: 'locked_op', field: 'op', value: op })));
        continue;
      }
    }
    const assignment = {
      program: checked.program || checked.normalizedProgram || program,
      reason: raw.reason || 'Model generated validated DSL loop'
    };
    if (hasBotId) assignment.botId = botId;
    if (hasAnyEligibleAssignee) assignment.assignee = { strategy: 'any_eligible' };
    valid.push(assignment);
  }
  if (!valid.length && rawAssignments.length) throw attachValidationMetadata(new Error(errors[0] || 'no valid DSL assignments'), errors[0] || 'no valid DSL assignments', validationDetails);
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

export async function parseWithOllama(text, game, { endpoint, model, enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS }) {
  if (!model) {
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true, loadout, knowledgePacks }) : { help: true, source: 'ollama', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? 'No model selected; workflow template fallback.' : 'No model selected; workflow template fallback disabled.', debug: { sent: { endpoint, model, text, enableTemplates, loadout: normalizeAssistantLoadout(loadout, knowledgePacks) }, returned: { error: 'No model selected.' } } };
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

  const runAttempt = async ({ attempt, think, repairContext = null }) => {
    const built = buildOllamaRequestBody(text, game, { model, enableTemplates, loadout, knowledgePacks, think, repairContext });
    requestBody = built.body;
    sentDebug = { url, body: requestBody, request: { text, model, endpoint, enableTemplates, loadout: normalizeAssistantLoadout(loadout, knowledgePacks), attempt, think, repair: !!repairContext }, finalPrompt: built.prompt.finalPrompt };
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
      err.validationDetails = [{ code: 'invalid_json', field: 'response', value: content }];
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
    try { calls = validateToolCalls(rawCalls, game, { loadout, knowledgePacks }); } catch (err) { callError = err; }
    try { dslAssignments = validateDslAssignments(rawDslAssignments, game, { loadout, knowledgePacks }); } catch (err) { dslError = err; }
    returned = { ...returned, parsed: json, validCalls: calls, validDslAssignments: dslAssignments, validationErrors: { toolCalls: callError?.message || null, dslAssignments: dslError?.message || null, details: [...(callError?.validationDetails || []), ...(dslError?.validationDetails || [])] } };
    if (!calls.length && !dslAssignments.length && (callError || dslError)) throw markModelResponseFailure(callError || dslError);
    console.info('[Orchestrator chat AI] returned from Ollama', returned);
    const usage = extractUsage('ollama', data);
    return {
      calls,
      dslAssignments,
      source: 'ollama',
      meta: `Ollama ${model}: ${Math.round(performance.now() - started)}ms, valid calls=${calls.length}, DSL=${dslAssignments.length}${repairContext ? ', repaired' : (think ? ', retried with think=true' : '')}`,
      metrics: { latencyMs: Math.round(performance.now() - started), attempt, repaired: !!repairContext, ...usage },
      debug: { sent: sentDebug, returned: withPreviousAttempts({ ...returned, usage }) }
    };
  };

  try {
    try {
      return await runAttempt({ attempt: 1, think: false });
    } catch (firstError) {
      recordFailedAttempt(1, false, firstError);
      if (!firstError.retryWithThinkAllowed) throw firstError;
      const repairContext = buildRepairContext(returned, firstError);
      console.warn('[Orchestrator chat AI] parse/validation failed; retrying once with repair feedback', { sent: sentDebug || { url, body: requestBody }, returned, repairContext });
      try {
        return await runAttempt({ attempt: 2, think: isGemma412BModel(model), repairContext });
      } catch (secondError) {
        recordFailedAttempt(2, true, secondError);
        throw secondError;
      }
    }
  } catch (e) {
    returned = withPreviousAttempts({ ...(returned || {}), error: e.message });
    console.warn('[Orchestrator chat AI] Ollama failed/fell back', { sent: sentDebug || { url, body: requestBody }, returned });
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true, loadout, knowledgePacks }) : { help: true, source: 'ollama', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? `Ollama failed: ${e.message}; workflow template fallback.` : `Ollama failed: ${e.message}; workflow template fallback disabled.`, debug: { sent: sentDebug || { url, body: requestBody }, returned } };
  }
}

export async function parseWithOpenAiCompatible(text, game, { endpoint, model, enableTemplates = false, loadout = DEFAULT_ASSISTANT_LOADOUT, knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS, providerLabel = 'OpenAI-compatible local model' }) {
  if (!model) {
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true, loadout, knowledgePacks }) : { help: true, source: 'openai-compatible', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? 'No model selected; workflow template fallback.' : 'No model selected; workflow template fallback disabled.', debug: { sent: { endpoint, model, text, enableTemplates, loadout: normalizeAssistantLoadout(loadout, knowledgePacks) }, returned: { error: 'No model selected.' } } };
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

  const runAttempt = async (attempt, repairContext = null) => {
    const built = buildOpenAiCompatibleRequestBody(text, game, { model, enableTemplates, loadout, knowledgePacks, temperature: 0.1, repairContext });
    requestBody = built.body;
    sentDebug = { url, body: requestBody, request: { text, model, endpoint, enableTemplates, loadout: normalizeAssistantLoadout(loadout, knowledgePacks), attempt, repair: !!repairContext }, finalPrompt: built.prompt.finalPrompt };
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
      err.validationDetails = [{ code: 'invalid_json', field: 'response', value: content }];
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
    try { calls = validateToolCalls(rawCalls, game, { loadout, knowledgePacks }); } catch (err) { callError = err; }
    try { dslAssignments = validateDslAssignments(rawDslAssignments, game, { loadout, knowledgePacks }); } catch (err) { dslError = err; }
    returned = { ...returned, parsed: json, validCalls: calls, validDslAssignments: dslAssignments, validationErrors: { toolCalls: callError?.message || null, dslAssignments: dslError?.message || null, details: [...(callError?.validationDetails || []), ...(dslError?.validationDetails || [])] } };
    if (!calls.length && !dslAssignments.length && (callError || dslError)) throw markModelResponseFailure(callError || dslError);
    const usage = extractUsage('openai-compatible', data);
    return {
      calls,
      dslAssignments,
      source: 'openai-compatible',
      meta: `${providerLabel} ${model}: ${Math.round(performance.now() - started)}ms, valid calls=${calls.length}, DSL=${dslAssignments.length}${repairContext ? ', repaired' : (attempt > 1 ? ', retried once' : '')}`,
      metrics: { latencyMs: Math.round(performance.now() - started), attempt, repaired: !!repairContext, ...usage },
      debug: { sent: sentDebug, returned: withPreviousAttempts({ ...returned, usage }) }
    };
  };

  try {
    try {
      return await runAttempt(1);
    } catch (firstError) {
      recordFailedAttempt(1, firstError);
      if (!firstError.retryAllowed) throw firstError;
      return await runAttempt(2, buildRepairContext(returned, firstError));
    }
  } catch (e) {
    if (previousAttempts.length < 2 && sentDebug) recordFailedAttempt(previousAttempts.length + 1, e);
    returned = withPreviousAttempts({ ...(returned || {}), error: e.message });
    const fallback = enableTemplates ? parseAssistantRequest(text, game, { enableTemplates: true, loadout, knowledgePacks }) : { help: true, source: 'openai-compatible', calls: [] };
    return { ...fallback, fallback: true, meta: enableTemplates ? `${providerLabel} failed: ${e.message}; workflow template fallback.` : `${providerLabel} failed: ${e.message}; workflow template fallback disabled.`, debug: { sent: sentDebug || { url, body: requestBody }, returned } };
  }
}
