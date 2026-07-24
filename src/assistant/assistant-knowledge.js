import { ASSISTANT_KNOWLEDGE_PACKS, DEFAULT_ASSISTANT_LOADOUT } from './assistant-pack-catalog.js';
import { parseKnowledgePackSource } from '../core/index.js';
import { actionStepDetailsForOps, normalizeActionStepAliasOverrides, validActionStepOps } from '../action-steps.js';

function packCatalog(knowledgePacks = ASSISTANT_KNOWLEDGE_PACKS) {
  return knowledgePacks && typeof knowledgePacks === 'object' ? knowledgePacks : ASSISTANT_KNOWLEDGE_PACKS;
}

export function estimateTokenCount(text = '') {
  const value = String(text || '');
  if (!value.trim()) return 0;
  return Math.max(1, Math.ceil(value.length / 4));
}

export function estimateValueTokenCount(value) {
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
  const source = parseKnowledgePackSource(pack);
  const id = String(source.id || '').trim();
  const selectedOps = validActionStepOps(source.unlockedOps || source.selectedOps || source.ops || []);
  const actionPartAliases = normalizeActionStepAliasOverrides(source.actionPartAliases || source.partAliases || {}, selectedOps);
  const actions = actionStepDetailsForOps(selectedOps, { actionPartAliases });
  const normalized = {
    id,
    name: String(source.name || id || 'Custom Action Pack').trim(),
    custom: !!source.custom,
    concepts: derivePackConcepts(source, actions),
    vocabulary: derivePackVocabulary(source, actions),
    optionalContext: parseTextList(source.optionalContext || source.contextVariables),
    contextVariables: parseTextList(source.contextVariables || source.optionalContext),
    unlockedOps: selectedOps,
    actionPartAliases,
    actions,
    actionDetails: actions,
    examples: Array.isArray(source.examples) ? source.examples : parseTextList(source.examples)
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
