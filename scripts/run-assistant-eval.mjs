import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseAssistantRequest, parseWithOllama, parseWithOpenAiCompatible, validateDslAssignments } from '../src/assistant.js';
import { assignmentMatchesExpectation, normalizeAssignmentForEval, summarizeEvalRows } from '../src/assistant-eval.js';
import { ASSISTANT_KNOWLEDGE_PACKS } from '../src/data.js';
import { Game } from '../src/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusPath = path.join(ROOT, 'tests', 'assistant-eval-corpus.json');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));

const provider = args.get('provider') || 'mock';
const endpoint = args.get('endpoint') || 'http://127.0.0.1:11434';
const model = args.get('model') || '';
const outputPath = args.get('output') ? path.resolve(process.cwd(), args.get('output')) : null;

globalThis.window ||= {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() {}
};
globalThis.requestAnimationFrame ||= (() => {});
globalThis.document ||= {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  createElement: () => ({ style: {}, classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] })
};

function makeGame() {
  const rect = { width: 1024, height: 768, left: 0, top: 0 };
  const canvas = {
    width: 1024,
    height: 768,
    style: {},
    parentElement: { getBoundingClientRect: () => rect },
    getBoundingClientRect: () => rect,
    addEventListener() {},
    removeEventListener() {}
  };
  const renderBackend = { ctx: null, resize() {}, render() {} };
  const game = new Game({ canvas, renderBackend, chat: null, dom: {} });
  game.audio = { play() {} };
  game.addChat = () => {};
  game.setManagerKnowledgePackCatalog?.(ASSISTANT_KNOWLEDGE_PACKS);
  return game;
}

async function evaluateCase(entry) {
  const game = makeGame();
  const started = performance.now();
  let parsed;
  if (provider === 'ollama') {
    parsed = await parseWithOllama(entry.text, game, { endpoint, model, enableTemplates: true, loadout: entry.loadout, knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
  } else if (provider === 'tabbyapi') {
    parsed = await parseWithOpenAiCompatible(entry.text, game, { endpoint, model, providerLabel: 'TabbyAPI', enableTemplates: true, loadout: entry.loadout, knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
  } else {
    parsed = parseAssistantRequest(entry.text, game, { enableTemplates: true, loadout: entry.loadout, knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
    if (parsed.dslAssignments?.length) parsed.dslAssignments = validateDslAssignments(parsed.dslAssignments, game, { loadout: entry.loadout, knowledgePacks: ASSISTANT_KNOWLEDGE_PACKS });
  }
  const assignment = parsed.dslAssignments?.[0] || null;
  const previousAttempts = parsed.debug?.returned?.previousAttempts || [];
  const semanticCorrect = assignment ? assignmentMatchesExpectation(assignment, entry.expected) : false;
  return {
    id: entry.id,
    provider,
    text: entry.text,
    loadout: entry.loadout,
    firstPassValid: !!assignment && previousAttempts.length === 0,
    repairedValid: !!assignment && previousAttempts.length > 0,
    semanticCorrect,
    latencyMs: parsed.metrics?.latencyMs || Math.round(performance.now() - started),
    inputTokens: parsed.metrics?.inputTokens || 0,
    outputTokens: parsed.metrics?.outputTokens || 0,
    attempts: Math.max(1, previousAttempts.length + (assignment || parsed.help ? 1 : 0)),
    normalizedAssignment: assignment ? normalizeAssignmentForEval(assignment) : null,
    meta: parsed.meta || '',
    fallback: !!parsed.fallback
  };
}

const rows = [];
for (const entry of corpus) rows.push(await evaluateCase(entry));
const report = {
  provider,
  endpoint: provider === 'mock' ? null : endpoint,
  model: provider === 'mock' ? null : model,
  generatedAt: new Date().toISOString(),
  summary: summarizeEvalRows(rows),
  rows
};

const text = JSON.stringify(report, null, 2);
if (outputPath) fs.writeFileSync(outputPath, text);
console.log(text);
