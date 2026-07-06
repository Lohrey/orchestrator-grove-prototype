import { buildAssistantSemanticProfiles, SEMANTIC_ROUTER_AMBIGUITY_GAP, SEMANTIC_ROUTER_THRESHOLD, selectSemanticLoadout } from './semantic-router.js';

let embedder = null;
let embedderMode = 'hash';
let embedderStatus = 'Semantic router worker starting...';
let profiles = [];
let profileState = new Map();
let routedMemory = {};
let routeReady = false;
let readyPromise = null;

function post(type, payload = {}) {
  self.postMessage({ type, payload });
}

function normalizeVector(vector) {
  let magnitude = 0;
  for (let i = 0; i < vector.length; i += 1) magnitude += vector[i] * vector[i];
  magnitude = Math.sqrt(magnitude) || 1;
  for (let i = 0; i < vector.length; i += 1) vector[i] /= magnitude;
  return vector;
}

function hashWord(word) {
  let hash = 2166136261;
  for (let i = 0; i < word.length; i += 1) {
    hash ^= word.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenize(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function vectorizeText(text, dimension = 256) {
  const vector = new Float32Array(dimension);
  const tokens = tokenize(text);
  if (!tokens.length) return normalizeVector(vector);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const hash = hashWord(token);
    vector[hash % dimension] += 1.0;
    vector[(hash >>> 8) % dimension] += 0.6;
    if (token.length > 3) vector[(hash >>> 16) % dimension] += 0.4;
    if (index > 0) {
      const bigram = `${tokens[index - 1]}_${token}`;
      const bigramHash = hashWord(bigram);
      vector[bigramHash % dimension] += 0.75;
    }
  }
  return normalizeVector(vector);
}

async function loadEmbedder() {
  if (embedder || readyPromise) return readyPromise;
  readyPromise = (async () => {
    try {
      const transformers = await import('@huggingface/transformers');
      const pipeline = transformers.pipeline || transformers.default?.pipeline;
      if (!pipeline) throw new Error('transformers pipeline unavailable');
      embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
      embedderMode = 'transformers';
      embedderStatus = 'Semantic router ready with bge-small embeddings.';
    } catch (error) {
      embedder = null;
      embedderMode = 'hash';
      embedderStatus = `Semantic router using local hash embeddings (${error?.message || 'embedder unavailable'}).`;
    }
    routeReady = true;
    post('READY', { mode: embedderMode, status: embedderStatus });
    return embedder;
  })();
  return readyPromise;
}

async function embedText(text) {
  if (embedderMode === 'transformers' && embedder) {
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data || []);
  }
  return Array.from(vectorizeText(text));
}

function similarity(a, b) {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) sum += a[i] * b[i];
  return sum;
}

async function rebuildProfiles(knowledgePacks = {}, loadout = []) {
  const baseProfiles = buildAssistantSemanticProfiles(knowledgePacks, loadout);
  const nextState = new Map();
  for (const profile of baseProfiles) {
    const memoryEntry = routedMemory[profile.id] || {};
    const sourceTexts = [...new Set([...(profile.texts || []), ...((memoryEntry.examples || []).map(entry => entry.text).filter(Boolean))])];
    const vectors = [];
    for (const text of sourceTexts) {
      vectors.push(await embedText(text));
    }
    nextState.set(profile.id, {
      ...profile,
      texts: sourceTexts,
      vectors
    });
  }
  profiles = baseProfiles;
  profileState = nextState;
}

function routeAgainstProfiles(inputVector, loadout = [], { threshold = SEMANTIC_ROUTER_THRESHOLD, ambiguityGap = SEMANTIC_ROUTER_AMBIGUITY_GAP, maxPacks = 3 } = {}) {
  const activeIds = new Set(Array.isArray(loadout) && loadout.length ? loadout : [...profileState.keys()]);
  const matches = [];
  for (const [id, profile] of profileState.entries()) {
    if (!activeIds.has(id)) continue;
    let bestScore = -1;
    for (const vector of profile.vectors || []) {
      const score = similarity(inputVector, vector);
      if (score > bestScore) bestScore = score;
    }
    if (bestScore >= 0) matches.push({ id: profile.id, name: profile.name, score: bestScore, exampleCount: profile.vectors?.length || 0 });
  }
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0] || null;
  const runnerUp = matches[1] || null;
  const bestScore = Number(best?.score || 0);
  const needsCalibration = !best || bestScore < SEMANTIC_ROUTER_THRESHOLD || (runnerUp && bestScore - runnerUp.score < SEMANTIC_ROUTER_AMBIGUITY_GAP);
  const selected = selectSemanticLoadout({
    topMatches: matches,
    bestScore,
    bestId: best?.id || null,
    bestName: best?.name || null,
    needsCalibration
  }, loadout, { threshold, ambiguityGap, maxPacks });
  return {
    requestText: '',
    mode: embedderMode,
    bestId: best?.id || null,
    bestName: best?.name || null,
    bestScore,
    needsCalibration,
    topMatches: matches,
    selectedLoadout: selected.effectiveLoadout,
    recommendedLoadout: selected.recommendedLoadout,
    useRecommendedLoadout: selected.useRecommendedLoadout,
    reason: selected.reason
  };
}

async function trainProfile(text, packId) {
  const profile = profileState.get(packId);
  if (!profile) return { ok: false, error: `Unknown semantic pack ${packId}` };
  const vector = await embedText(text);
  profile.vectors = profile.vectors || [];
  profile.texts = profile.texts || [];
  profile.vectors.push(vector);
  profile.texts.push(text);
  routedMemory[packId] ||= { examples: [] };
  routedMemory[packId].examples.push({ text, at: Date.now(), mode: embedderMode });
  if (routedMemory[packId].examples.length > 64) routedMemory[packId].examples.shift();
  if (profile.vectors.length > 64) profile.vectors.shift();
  return {
    ok: true,
    memory: routedMemory,
    packId,
    packName: profile.name,
    mode: embedderMode
  };
}

self.onmessage = async event => {
  const { id, type, payload = {} } = event.data || {};
  try {
    if (type === 'INIT') {
      routedMemory = payload.memory && typeof payload.memory === 'object' ? payload.memory : routedMemory;
      await loadEmbedder();
      await rebuildProfiles(payload.knowledgePacks || {}, payload.loadout || []);
      post('READY', {
        id,
        mode: embedderMode,
        status: embedderStatus,
        profileCount: profileState.size
      });
      return;
    }

    if (type === 'ROUTE') {
      if (!routeReady) await loadEmbedder();
      if (payload.knowledgePacks) await rebuildProfiles(payload.knowledgePacks, payload.loadout || []);
      const requestText = String(payload.text || '').trim();
      const inputVector = await embedText(requestText);
      const route = routeAgainstProfiles(inputVector, payload.loadout || [], {
        threshold: Number(payload.threshold || SEMANTIC_ROUTER_THRESHOLD),
        ambiguityGap: Number(payload.ambiguityGap || SEMANTIC_ROUTER_AMBIGUITY_GAP),
        maxPacks: Number(payload.maxPacks || 3)
      });
      route.requestText = requestText;
      route.threshold = Number(payload.threshold || SEMANTIC_ROUTER_THRESHOLD);
      route.ambiguityGap = Number(payload.ambiguityGap || SEMANTIC_ROUTER_AMBIGUITY_GAP);
      post('ROUTE_RESULT', { id, route });
      return;
    }

    if (type === 'TRAIN') {
      if (payload.knowledgePacks) await rebuildProfiles(payload.knowledgePacks, payload.loadout || []);
      const result = await trainProfile(String(payload.text || '').trim(), String(payload.packId || '').trim());
      post('TRAIN_RESULT', { id, result });
      return;
    }

    if (type === 'EXPORT_STATE') {
      post('STATE', { id, state: routedMemory });
      return;
    }

    if (type === 'IMPORT_STATE') {
      routedMemory = payload.state && typeof payload.state === 'object' ? payload.state : {};
      post('STATE', { id, state: routedMemory });
      return;
    }

    post('ERROR', { id, error: `Unknown semantic router message type: ${type}` });
  } catch (error) {
    post('ERROR', { id, error: error?.message || String(error) });
  }
};

loadEmbedder().catch(error => {
  embedderMode = 'hash';
  embedderStatus = `Semantic router fell back to hash embeddings (${error?.message || 'failed to initialize'}).`;
  routeReady = true;
  post('READY', { mode: embedderMode, status: embedderStatus });
});
