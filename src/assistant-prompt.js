import { ASSISTANT_KNOWLEDGE_PACKS, DEFAULT_ASSISTANT_LOADOUT } from './assistant-pack-catalog.js?v=t_building_kits_0618';
import {
  estimateTokenCount,
  estimateValueTokenCount,
  formatAssistantLoadout,
  normalizeAssistantPackCatalog
} from './assistant-knowledge.js?v=t_building_kits_0618';

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

export function compactCapabilities(equippedPacks) {
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
