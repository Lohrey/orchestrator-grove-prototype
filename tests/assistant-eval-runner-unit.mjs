import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assignmentMatchesExpectation, normalizeAssignmentForEval, summarizeEvalRows } from '../src/assistant-eval.js';
import { parseAssistantRequest, validateDslAssignments } from '../src/assistant.js';
import { ASSISTANT_KNOWLEDGE_PACKS } from '../src/data.js';
import { Game } from '../src/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'assistant-eval-corpus.json'), 'utf8'));

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

assert.equal(corpus.length >= 6, true, 'eval corpus should cover multiple request classes');

const game = makeGame();
const bring = parseAssistantRequest('bot 1 bring me a log', game, { enableTemplates: true, loadout: ['starter_automation'], knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
const bringValidated = validateDslAssignments(bring.dslAssignments, game, { loadout: ['starter_automation'], knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
assert.equal(bringValidated[0].program.repeat, false, bringValidated);
assert.equal(assignmentMatchesExpectation(bringValidated[0], corpus.find(entry => entry.id === 'bring_log_once').expected), true);

const feed = parseAssistantRequest('bot 1 keep sawbench full of logs', game, { enableTemplates: true, loadout: ['starter_automation', 'woodworking'], knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
const feedValidated = validateDslAssignments(feed.dslAssignments, game, { loadout: ['starter_automation', 'woodworking'], knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
assert.equal(feedValidated[0].program.repeat, true, feedValidated);
assert.equal(assignmentMatchesExpectation(feedValidated[0], corpus.find(entry => entry.id === 'feed_sawbench_repeat').expected), true);

const anyone = parseAssistantRequest('someone bring me a log', game, { enableTemplates: true, loadout: ['starter_automation'], knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
const anyoneValidated = validateDslAssignments(anyone.dslAssignments, game, { loadout: ['starter_automation'], knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
assert.equal(anyoneValidated[0].assignee.strategy, 'any_eligible', anyoneValidated);
assert.equal(anyoneValidated[0].program.repeat, false, anyoneValidated);

const normalized = normalizeAssignmentForEval(anyoneValidated[0]);
assert.equal(normalized.program.repeat, false, normalized);

const summary = summarizeEvalRows([
  { firstPassValid: true, repairedValid: false, semanticCorrect: true, latencyMs: 100, inputTokens: 10, outputTokens: 5 },
  { firstPassValid: false, repairedValid: true, semanticCorrect: true, latencyMs: 200, inputTokens: 20, outputTokens: 8 }
]);
assert.deepEqual(summary, {
  total: 2,
  firstPassValid: 1,
  repairedValid: 1,
  semanticallyCorrect: 2,
  avgLatencyMs: 150,
  avgInputTokens: 15,
  avgOutputTokens: 7
});

console.log('assistant eval runner unit passed');
