import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTION_STEPS,
  ALLOWED_OPS,
  ASSISTANT_KNOWLEDGE_PACKS,
  DSL_ACTION_WIKI,
  PROGRAMS,
  PROGRAM_TEMPLATES,
  getActionStepChainRows
} from '../src/data.js';
import { ACTION_STEP_ORDER, ACTION_STEP_REGISTRY, actionStepDetailsForOps, actionStepOpsForPack } from '../src/action-steps.js';
import { normalizeAssistantKnowledgePack, normalizeAssistantPackCatalog, summarizeAssistantLoadout } from '../src/assistant.js';

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
}

for (const pack of Object.values(ASSISTANT_KNOWLEDGE_PACKS)) {
  assert.deepEqual(pack.unlockedOps, actionStepOpsForPack(pack.id), `${pack.id} unlockedOps must be registry-derived`);
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
  contextVariables: ['availableBotNames']
});
assert.deepEqual(customPack.unlockedOps, ['pick_up', 'deposit_to_player'], 'custom pack ops must be filtered through the registry');
assert.deepEqual(customPack.actions.map(action => action.op), customPack.unlockedOps, 'custom pack action details must match selected valid ops only');
assert.deepEqual(customPack.actions[0].validVariables, ACTION_STEPS.pick_up.args, 'custom pack action variables derive from registry args');
assert.ok(customPack.actions[0].dslSnippet.includes('"type":"$type"'), 'custom pack action snippets derive from registry snippets');
const customCatalog = normalizeAssistantPackCatalog({ ...ASSISTANT_KNOWLEDGE_PACKS, [customPack.id]: customPack });
const customSummary = summarizeAssistantLoadout([customPack.id], customCatalog);
assert.deepEqual(customSummary.unlockedOps, customPack.unlockedOps, 'custom loadout unlocks selected custom ops only');
assert.equal(customSummary.packs[0].actions.length, 2, 'custom loadout includes per-pack action details');

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
  if (row.packs.length && !row.customLoop && !row.notes) {
    throw new Error(`${row.op} is exposed to knowledge packs without custom-loop support or an explicit registry note`);
  }
}
assert.equal(rows.find(row => row.op === 'pick_up').dslSnippet, '{"op":"pick_up","type":"$type","zone":"$zone"}', 'pick_up DSL snippet must show op/type/zone JSON');
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
assert.match(assistantSource, /runtimeDslSignaturesForOps/, 'assistant prompt signatures must use the action-step registry helper');
assert.match(assistantSource, /return runtimeDslSignaturesForOps\(unlockedOps\)/, 'runtimeSignaturesForOps must delegate to registry signatures');

const mainSource = read('src/main.js');
assert.match(mainSource, /getActionStepChainRows/, 'main UI must render registry-backed step-chain rows');
assert.match(mainSource, /DSL snippet/, 'settings step-chain table must label the DSL snippet column');
assert.match(mainSource, /row\.dslSnippet/, 'settings step-chain table must render row.dslSnippet');
assert.match(mainSource, /window\.allowedProgramOps = ALLOWED_OPS\.slice\(\)/, 'public allowedProgramOps must expose ALLOWED_OPS');

const indexSource = read('index.html');
assert.match(indexSource, /actionStepChainTable/, 'settings UI must contain the action step chain table host');

const agentsSource = read('AGENTS.md');
assert.match(agentsSource, /Action Step Mechanism Chain/, 'AGENTS.md must define the step-chain rule');
assert.match(agentsSource, /src\/action-steps\.js/, 'AGENTS.md must name the canonical registry');

console.log(`action step chain integrity passed (${ALLOWED_OPS.length} ops, ${rows.length} rows)`);
