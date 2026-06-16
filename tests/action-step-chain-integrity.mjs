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
import { ACTION_STEP_ORDER, ACTION_STEP_REGISTRY, actionStepOpsForPack } from '../src/action-steps.js';

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
  for (const op of pack.unlockedOps) {
    assert.ok(ACTION_STEPS[op], `${pack.id} unlocks unknown op ${op}`);
    assert.ok(ACTION_STEPS[op].signature, `${pack.id} op ${op} needs a prompt signature`);
  }
}

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
  assert.ok(row.promptSignature, `${row.op} needs a prompt signature`);
  if (row.packs.length && !row.customLoop && !row.notes) {
    throw new Error(`${row.op} is exposed to knowledge packs without custom-loop support or an explicit registry note`);
  }
}

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
assert.match(mainSource, /window\.allowedProgramOps = ALLOWED_OPS\.slice\(\)/, 'public allowedProgramOps must expose ALLOWED_OPS');

const indexSource = read('index.html');
assert.match(indexSource, /actionStepChainTable/, 'settings UI must contain the action step chain table host');

const agentsSource = read('AGENTS.md');
assert.match(agentsSource, /Action Step Mechanism Chain/, 'AGENTS.md must define the step-chain rule');
assert.match(agentsSource, /src\/action-steps\.js/, 'AGENTS.md must name the canonical registry');

console.log(`action step chain integrity passed (${ALLOWED_OPS.length} ops, ${rows.length} rows)`);
