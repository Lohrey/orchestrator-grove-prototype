import assert from 'node:assert/strict';

import { parseWithOpenAiCompatible } from '../src/assistant.js';
import { ASSISTANT_KNOWLEDGE_PACKS } from '../src/data.js';
import { Game } from '../src/world.js';

const noop = () => {};
globalThis.window ||= { innerWidth: 1024, innerHeight: 768, addEventListener: noop, removeEventListener: noop, requestAnimationFrame: noop };
globalThis.requestAnimationFrame ||= noop;
globalThis.document ||= {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: noop,
  createElement: () => ({ style: {}, classList: { toggle: noop, add: noop, remove: noop }, appendChild: noop, querySelector: () => null, querySelectorAll: () => [] })
};

function makeGame() {
  const rect = { width: 1024, height: 768, left: 0, top: 0 };
  const canvas = {
    width: 1024,
    height: 768,
    style: {},
    parentElement: { getBoundingClientRect: () => rect },
    getBoundingClientRect: () => rect,
    addEventListener: noop,
    removeEventListener: noop
  };
  const renderBackend = { ctx: null, resize: noop, render: noop };
  const game = new Game({ canvas, renderBackend, chat: null, dom: {} });
  game.audio = { play: noop };
  game.addChat = noop;
  game.setManagerKnowledgePackCatalog?.(ASSISTANT_KNOWLEDGE_PACKS);
  return game;
}

const game = makeGame();
const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const body = JSON.parse(options.body);
  requests.push(body);
  const repaired = body.messages.length > 2;
  const content = repaired
    ? JSON.stringify({ dsl_assignments: [{ botId: 1, program: { repeat: false, steps: [{ op: 'pick_up', type: 'log' }] } }] })
    : JSON.stringify({ dsl_assignments: [{ botId: 1, program: { repeat: false, steps: [{ op: 'pick_up', type: 'mystery_ore' }] } }] });
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: repaired ? 60 : 40, completion_tokens: repaired ? 18 : 14 } })
  };
};

try {
  const parsed = await parseWithOpenAiCompatible('bot 1 bring me a log', game, {
    endpoint: 'http://example.test/v1',
    model: 'fake-model',
    providerLabel: 'FakeProvider',
    enableTemplates: true,
    loadout: ['starter_automation'],
    knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS
  });
  assert.equal(parsed.dslAssignments.length, 1, parsed);
  assert.equal(parsed.dslAssignments[0].program.steps[0].type, 'log', parsed);
  assert.equal(parsed.metrics.repaired, true, parsed);
  assert.equal(parsed.debug.returned.previousAttempts.length, 1, parsed.debug.returned);
  assert.equal(requests.length, 2, requests);
  const repairPayload = JSON.parse(requests[1].messages.at(-1).content);
  assert.equal(repairPayload.repair, true, repairPayload);
  assert.equal(repairPayload.validationDetails[0].code, 'unknown_item_type', repairPayload);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('assistant repair loop unit passed');
