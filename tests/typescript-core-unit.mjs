import assert from 'node:assert/strict';

import {
  parseAssistantResponsePayload,
  parseDslAssignmentList,
  parseDslProgram,
  parseKnowledgePackSource
} from '../src/core/index.js';
import { normalizeAssistantKnowledgePack } from '../src/assistant/assistant-knowledge.js';

const program = parseDslProgram({
  id: 'haul_once',
  repeat: false,
  steps: [
    { op: 'pick_up', type: 'log' },
    { op: 'deposit_to_structure', type: 'log', target: 'sawbench 1' }
  ]
});
assert.equal(program.steps.length, 2);
assert.equal(program.steps[0].type, 'log', 'action-specific arguments remain forward-compatible');

const assignments = parseDslAssignmentList([
  { botId: 1, program: { repeat: false, steps: [{ op: 'wait', seconds: 1 }] } }
]);
assert.equal(assignments[0].botId, 1);

const response = parseAssistantResponsePayload({
  dsl_assignments: assignments,
  help: false
});
assert.equal(response.dsl_assignments?.length, 1);

assert.throws(
  () => parseDslProgram({ steps: [{ op: 'loop', steps: [{ op: 'wait' }] }] }),
  /nested DSL steps are not allowed/
);
assert.throws(
  () => parseAssistantResponsePayload({ dsl_assignments: {} }),
  /assistant response failed schema validation/
);
assert.throws(
  () => parseAssistantResponsePayload({ dsl_assignments: [] }),
  /must include assignments, tool calls, or help/
);
assert.throws(
  () => parseKnowledgePackSource({ id: '', unlockedOps: ['wait'] }),
  /knowledge pack id is required/
);

const pack = normalizeAssistantKnowledgePack({
  id: 'custom_wait',
  name: 'Custom Wait',
  selectedOps: ['wait'],
  concepts: 'Pause before continuing.'
});
assert.deepEqual(pack.unlockedOps, ['wait']);
assert.deepEqual(pack.concepts, ['Pause before continuing.']);

console.log('typescript core unit passed');
