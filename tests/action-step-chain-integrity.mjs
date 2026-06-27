import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTION_STEPS,
  ALLOWED_OPS,
  ASSISTANT_KNOWLEDGE_PACKS,
  DEFAULT_ASSISTANT_LOADOUT,
  DSL_ACTION_WIKI,
  PROGRAMS,
  PROGRAM_TEMPLATES,
  getActionStepChainRows
} from '../src/data.js';
import { ACTION_STEP_ORDER, ACTION_STEP_REGISTRY, actionStepDetailsForOps, actionStepOpsForPack } from '../src/action-steps.js';
import { ASSISTANT_PROTOCOL_KERNEL, buildOllamaPrompt, normalizeAssistantKnowledgePack, normalizeAssistantPackCatalog, summarizeAssistantLoadout } from '../src/assistant.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const asSorted = values => [...values].sort();
const unique = values => [...new Set(values)];
const assertSameSet = (actual, expected, message) => {
  assert.deepEqual(asSorted(actual), asSorted(expected), message);
};

assert.deepEqual(ALLOWED_OPS, ACTION_STEP_ORDER, 'ALLOWED_OPS must be the registry order');
assert.deepEqual(ACTION_STEPS, ACTION_STEP_REGISTRY, 'data ACTION_STEPS must expose the canonical registry content');
assertSameSet(Object.keys(ACTION_STEPS), ALLOWED_OPS, 'registry keys must match ALLOWED_OPS');

const wikiOps = DSL_ACTION_WIKI.actions.map(action => action.op);
assert.deepEqual(wikiOps, ALLOWED_OPS, 'DSL wiki actions must be generated in registry order');
for (const action of DSL_ACTION_WIKI.actions) {
  const registered = ACTION_STEPS[action.op];
  assert.deepEqual(action.args, registered.args || [], `${action.op} wiki args must match registry`);
  assert.equal(action.description, registered.description, `${action.op} wiki description must match registry`);
  assert.ok(Array.isArray(registered.aliases?.step), `${action.op} must expose step aliases in the registry`);
  assert.ok(registered.aliases.step.length > 0, `${action.op} must expose at least one step alias`);
  for (const arg of registered.args || []) {
    assert.ok(Array.isArray(registered.aliases?.args?.[arg]), `${action.op}.${arg} must expose arg aliases in the registry`);
  }
}

for (const pack of Object.values(ASSISTANT_KNOWLEDGE_PACKS)) {
  if (pack.custom) {
    assert.ok(pack.unlockedOps.length > 0, `${pack.id} custom pack must declare unlocked ops explicitly`);
  } else {
    assert.deepEqual(pack.unlockedOps, actionStepOpsForPack(pack.id), `${pack.id} unlockedOps must be registry-derived`);
  }
  const details = actionStepDetailsForOps(pack.unlockedOps);
  assert.deepEqual(details.map(action => action.op), pack.unlockedOps, `${pack.id} action details must preserve registry-derived pack ops`);
  for (const action of details) {
    assert.deepEqual(action.validVariables, ACTION_STEPS[action.op].args || [], `${pack.id} action ${action.op} variables must be registry args`);
    assert.ok(action.dslSnippet, `${pack.id} action ${action.op} needs a DSL snippet`);
    assert.ok(action.promptSignature, `${pack.id} action ${action.op} needs prompt signature`);
  }
  for (const op of pack.unlockedOps) {
    assert.ok(ACTION_STEPS[op], `${pack.id} unlocks unknown op ${op}`);
    assert.ok(ACTION_STEPS[op].signature, `${pack.id} op ${op} needs a prompt signature`);
  }
}

const customPack = normalizeAssistantKnowledgePack({
  id: 'custom_tree_courier',
  name: 'Tree courier',
  custom: true,
  unlockedOps: ['pick_up', 'not_real_op', 'deposit_to_player'],
  contextVariables: ['availableBotNames'],
  actionPartAliases: {
    pick_up: {
      step: ['collect thing'],
      args: {
        type: ['loot type'],
        zone: ['search patch']
      }
    }
  }
});
assert.deepEqual(customPack.unlockedOps, ['pick_up', 'deposit_to_player'], 'custom pack ops must be filtered through the registry');
assert.deepEqual(customPack.actions.map(action => action.op), customPack.unlockedOps, 'custom pack action details must match selected valid ops only');
assert.deepEqual(customPack.actions[0].validVariables, ACTION_STEPS.pick_up.args, 'custom pack action variables derive from registry args');
assert.ok(customPack.actions[0].dslSnippet.includes('"type":"$type"'), 'custom pack action snippets derive from registry snippets');
assert.deepEqual(customPack.actionPartAliases.pick_up.step, ['collect thing'], 'custom pack must persist custom step aliases');
assert.deepEqual(customPack.actions[0].partAliases.step, ['collect thing'], 'custom action details must expose customized step aliases');
assert.ok(customPack.vocabulary.includes('collect thing'), 'custom pack vocabulary must include action aliases');
assert.ok(customPack.vocabulary.includes('loot type'), 'custom pack vocabulary must include arg aliases');
const customCatalog = normalizeAssistantPackCatalog({ ...ASSISTANT_KNOWLEDGE_PACKS, [customPack.id]: customPack });
const customSummary = summarizeAssistantLoadout([customPack.id], customCatalog);
assert.deepEqual(customSummary.unlockedOps, customPack.unlockedOps, 'custom loadout unlocks selected custom ops only');
assert.equal(customSummary.packs[0].actions.length, 2, 'custom loadout includes per-pack action details');

const promptGame = {
  bots: [{ id: 1, ref: 'bot 1', name: 'Bot 1', status: 'worker', program: 'idle' }],
  structures: [{ id: 1, ref: 'sawbench 1', name: 'Sawbench 1', type: 'sawbench' }],
  zones: [],
  customTemplates: [],
  monsters: [],
  player: { inventory: null }
};
const starterPrompt = buildOllamaPrompt('bot 1 bring me a log', promptGame, { loadout: ['starter_automation'] });
assert.deepEqual(JSON.parse(starterPrompt.systemPrompt), ASSISTANT_PROTOCOL_KERNEL, 'system prompt must be the domain-free protocol kernel JSON');
assert.doesNotMatch(starterPrompt.systemPrompt, /pick_up|log|tree|sawbench|tool_calls/, 'protocol kernel must not contain domain actions, objects, or legacy output shapes');
assert.deepEqual(ASSISTANT_PROTOCOL_KERNEL.responseSchema.properties.dsl_assignments.items.required, ['program'], 'protocol kernel assignments must require only program and allow botId or assignee selection');
assert.equal(ASSISTANT_PROTOCOL_KERNEL.responseSchema.properties.dsl_assignments.items.properties.assignee.required[0], 'strategy', 'protocol kernel assignee selector must require strategy');
assert.deepEqual(ASSISTANT_PROTOCOL_KERNEL.responseSchema.properties.dsl_assignments.items.properties.program.required, ['repeat', 'steps'], 'protocol kernel program contract must require repeat and steps');
const starterPayload = JSON.parse(starterPrompt.userPrompt);
assert.deepEqual(Object.keys(starterPayload), ['capabilities', 'symbols', 'lockedRequestHints', 'request'], 'user payload must separate capabilities, symbols, availability hints, and request');
assert.equal(starterPayload.request, 'bot 1 bring me a log', 'request appears once in the user payload');
const starterActionOps = starterPayload.capabilities.actions.map(action => action.op);
assert.equal(starterActionOps.length, new Set(starterActionOps).size, 'each selected action contract appears exactly once');
assert.deepEqual(starterActionOps, actionStepOpsForPack('starter_automation'), 'capability actions must match the selected pack');
assert.ok(starterPayload.symbols.bots?.some(bot => bot.id === 1), 'request-relevant bot symbol must be included');
assert.deepEqual(starterPayload.symbols.itemTypes, ['log'], 'only the request-relevant item type must be included');
assert.ok(starterPayload.capabilities.recipes.some(recipe => recipe.intent === 'bot 1 bring log to me'), 'request-relevant domain recipe must be included');
assert.doesNotMatch(starterPrompt.finalPrompt, /tool_calls|assignBotProgram/, 'model prompt must not advertise legacy tool calls');
assert.ok(starterPrompt.finalPrompt.length < 8000, `starter prompt must stay compact, got ${starterPrompt.finalPrompt.length} characters`);
const fullPrompt = buildOllamaPrompt('bot 1 bring me a log', promptGame, { loadout: DEFAULT_ASSISTANT_LOADOUT });
assert.ok(fullPrompt.finalPrompt.length < 16000, `full built-in loadout prompt must stay within the compact budget, got ${fullPrompt.finalPrompt.length} characters`);

assertSameSet(Object.keys(PROGRAM_TEMPLATES), PROGRAMS, 'PROGRAMS and PROGRAM_TEMPLATES must match');
for (const [templateId, template] of Object.entries(PROGRAM_TEMPLATES)) {
  for (const step of template.steps || []) {
    assert.ok(ALLOWED_OPS.includes(step.op), `${templateId} uses unknown op ${step.op}`);
  }
}

const rows = getActionStepChainRows();
assert.deepEqual(rows.map(row => row.op), ALLOWED_OPS, 'step-chain rows must cover every op in order');
for (const row of rows) {
  assert.ok(row.backend, `${row.op} needs backend chain text`);
  assert.ok(row.uiCard, `${row.op} needs UI-card metadata`);
  assert.ok(row.dslSnippet, `${row.op} needs a DSL snippet`);
  const snippet = JSON.parse(row.dslSnippet);
  assert.equal(snippet.op, row.op, `${row.op} DSL snippet op must match`);
  assert.deepEqual(Object.keys(snippet), ['op', ...row.args], `${row.op} DSL snippet keys must match op + args`);
  for (const arg of row.args) {
    assert.equal(snippet[arg], `$${arg}`, `${row.op} DSL snippet must expose ${arg} placeholder`);
  }
  assert.ok(row.promptSignature, `${row.op} needs a prompt signature`);
  assert.ok(Array.isArray(row.aliasVocabulary), `${row.op} needs flattened alias vocabulary`);
  assert.ok(row.aliasVocabulary.length >= row.args.length, `${row.op} alias vocabulary should cover the step and its parts`);
  if (row.packs.length && !row.customLoop && !row.notes) {
    throw new Error(`${row.op} is exposed to knowledge packs without custom-loop support or an explicit registry note`);
  }
}
assert.equal(rows.find(row => row.op === 'pick_up').dslSnippet, '{"op":"pick_up","type":"$type","zone":"$zone"}', 'pick_up DSL snippet must show op/type/zone JSON');
assert.equal(rows.find(row => row.op === 'drop_item').dslSnippet, '{"op":"drop_item","zone":"$zone"}', 'drop_item DSL snippet must show the generic drop JSON');
assert.equal(rows.find(row => row.op === 'loop').dslSnippet, '{"op":"loop"}', 'loop DSL snippet must show op-only JSON');

const worldSource = read('src/world.js');
const taughtLoopStart = worldSource.indexOf('programTaughtLoop');
const taughtLoopEnd = worldSource.indexOf('programMakePlanks', taughtLoopStart);
assert.notEqual(taughtLoopStart, -1, 'programTaughtLoop source block must start');
assert.notEqual(taughtLoopEnd, -1, 'programTaughtLoop source block must end before programMakePlanks');
const taughtLoopSource = worldSource.slice(taughtLoopStart, taughtLoopEnd);

const customHandlerOps = new Set();
for (const match of taughtLoopSource.matchAll(/step\.op === '([^']+)'/g)) customHandlerOps.add(match[1]);
for (const match of taughtLoopSource.matchAll(/step\.op === '([^']+)'\s*\|\|\s*step\.op === '([^']+)'/g)) {
  customHandlerOps.add(match[1]);
  customHandlerOps.add(match[2]);
}
for (const [op, step] of Object.entries(ACTION_STEPS)) {
  if (step.customLoop && op !== 'loop') {
    assert.ok(customHandlerOps.has(op), `${op} is marked customLoop but has no programTaughtLoop branch`);
  }
}

const assistantSource = read('src/assistant.js');
const assistantKnowledgeSource = read('src/assistant-knowledge.js');
const assistantPromptSource = read('src/assistant-prompt.js');
const assistantPackCatalogSource = read('src/assistant-pack-catalog.js');
assert.match(assistantSource, /ASSISTANT_PROTOCOL_KERNEL/, 'assistant public API must expose the protocol kernel');
assert.match(assistantSource, /compactCapabilities/, 'assistant public API must expose compact capability compilation');
assert.match(assistantKnowledgeSource, /normalizeAssistantKnowledgePack/, 'knowledge-pack normalization must live in the assistant knowledge module');
assert.match(assistantPromptSource, /ASSISTANT_PROTOCOL_KERNEL/, 'assistant prompt module must own the protocol kernel');
assert.match(assistantPromptSource, /compactCapabilities/, 'assistant prompt module must own compact capability compilation');
assert.match(assistantPackCatalogSource, /ASSISTANT_KNOWLEDGE_PACKS/, 'built-in assistant pack catalog must live outside data.js');

const mainSource = read('src/main.js');
assert.match(mainSource, /getActionStepChainRows/, 'main UI must render registry-backed step-chain rows');
assert.match(mainSource, /DSL snippet/, 'settings step-chain table must label the DSL snippet column');
assert.match(mainSource, /row\.dslSnippet/, 'settings step-chain table must render row.dslSnippet');
assert.match(mainSource, /customPackAliasEditor/, 'main UI must wire the custom pack alias editor');
assert.match(mainSource, /data-action-alias-step/, 'main UI must render editable step alias inputs');
assert.match(mainSource, /window\.allowedProgramOps = ALLOWED_OPS\.slice\(\)/, 'public allowedProgramOps must expose ALLOWED_OPS');

const indexSource = read('index.html');
assert.match(indexSource, /actionStepChainTable/, 'settings UI must contain the action step chain table host');
assert.match(indexSource, /customPackAliasEditor/, 'knowledge pack UI must contain the alias editor host');

const agentsSource = read('AGENTS.md');
assert.match(agentsSource, /Action Step Mechanism Chain/, 'AGENTS.md must define the step-chain rule');
assert.match(agentsSource, /src\/action-steps\.js/, 'AGENTS.md must name the canonical registry');

console.log(`action step chain integrity passed (${ALLOWED_OPS.length} ops, ${rows.length} rows)`);
