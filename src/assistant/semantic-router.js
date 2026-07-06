export const SEMANTIC_ROUTER_STORAGE_KEY = 'orchestratorGrove.semanticRouterState.v1';
export const SEMANTIC_ROUTER_THRESHOLD = 0.58;
export const SEMANTIC_ROUTER_AMBIGUITY_GAP = 0.05;
export const SEMANTIC_ROUTER_MAX_PACKS = 3;

function cleanText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s:(){}\[\].,/?+*'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueTexts(values = []) {
  return [...new Set(values.map(value => cleanText(value)).filter(Boolean))];
}

function packTextSnippets(pack = {}) {
  const actionTexts = Array.isArray(pack.actions)
    ? pack.actions.flatMap(action => [
        action.op,
        action.label,
        action.description,
        action.promptSignature,
        action.dslSnippet,
        ...(action.args || []),
        ...(action.aliasVocabulary || []),
        ...(action.partAliases?.step || []),
        ...Object.values(action.partAliases?.args || {}).flat()
      ])
    : [];

  const exampleTexts = Array.isArray(pack.examples)
    ? pack.examples.flatMap(example => {
        if (!example) return [];
        if (typeof example === 'string') return [example];
        return [
          example.intent,
          example.name,
          JSON.stringify(example.dsl || example.program || example, null, 0)
        ];
      })
    : [];

  return uniqueTexts([
    pack.id,
    pack.name,
    ...(pack.concepts || []),
    ...(pack.vocabulary || []),
    ...(pack.optionalContext || []),
    ...(pack.contextVariables || []),
    ...actionTexts,
    ...exampleTexts
  ]);
}

export function buildAssistantSemanticProfiles(knowledgePacks = {}, loadout = []) {
  const catalog = knowledgePacks && typeof knowledgePacks === 'object' ? knowledgePacks : {};
  const packIds = Array.isArray(loadout) && loadout.length ? loadout : Object.keys(catalog);
  return packIds
    .map((id, index) => {
      const pack = catalog[id];
      if (!pack) return null;
      return {
        id: pack.id,
        name: pack.name || pack.id,
        index,
        texts: packTextSnippets(pack)
      };
    })
    .filter(Boolean);
}

export function createSemanticCatalogFingerprint(knowledgePacks = {}, loadout = []) {
  const catalog = knowledgePacks && typeof knowledgePacks === 'object' ? knowledgePacks : {};
  const packIds = Array.isArray(loadout) && loadout.length ? loadout : Object.keys(catalog);
  return JSON.stringify(packIds.map(id => {
    const pack = catalog[id] || {};
    return {
      id: String(id),
      name: String(pack.name || ''),
      custom: !!pack.custom,
      concepts: uniqueTexts(pack.concepts || []),
      vocabulary: uniqueTexts(pack.vocabulary || []),
      optionalContext: uniqueTexts(pack.optionalContext || pack.contextVariables || []),
      actions: Array.isArray(pack.actions) ? pack.actions.map(action => ({
        op: String(action.op || ''),
        label: String(action.label || ''),
        description: String(action.description || ''),
        promptSignature: String(action.promptSignature || ''),
        args: Array.isArray(action.args) ? action.args.slice() : []
      })) : [],
      examples: Array.isArray(pack.examples)
        ? pack.examples.map(example => (typeof example === 'string' ? example : String(example?.intent || example?.name || JSON.stringify(example || {}))))
        : []
    };
  }));
}

export function selectSemanticLoadout(route = null, loadout = [], {
  threshold = SEMANTIC_ROUTER_THRESHOLD,
  ambiguityGap = SEMANTIC_ROUTER_AMBIGUITY_GAP,
  maxPacks = SEMANTIC_ROUTER_MAX_PACKS
} = {}) {
  const fallbackLoadout = Array.isArray(loadout) ? [...loadout] : [];
  if (!route || !Array.isArray(route.topMatches) || !route.topMatches.length) {
    return {
      effectiveLoadout: fallbackLoadout,
      recommendedLoadout: fallbackLoadout,
      useRecommendedLoadout: false,
      reason: 'no_route'
    };
  }

  const top = route.topMatches.slice(0, maxPacks);
  const bestScore = Number(route.bestScore || 0);
  const runnerUp = Number(route.topMatches[1]?.score || 0);
  const recommendedLoadout = top
    .filter((match, index) => index === 0 || match.score >= threshold || match.score >= bestScore - 0.14)
    .map(match => match.id)
    .filter(Boolean);
  const needsCalibration = !!route.needsCalibration || bestScore < threshold || (runnerUp > 0 && bestScore - runnerUp < ambiguityGap);
  const useRecommendedLoadout = recommendedLoadout.length > 0 && !needsCalibration;

  return {
    effectiveLoadout: useRecommendedLoadout ? recommendedLoadout : fallbackLoadout,
    recommendedLoadout,
    useRecommendedLoadout,
    needsCalibration,
    reason: useRecommendedLoadout ? 'strong_match' : (needsCalibration ? 'needs_calibration' : 'fallback')
  };
}

export function formatSemanticRouteSummary(route = null) {
  if (!route?.topMatches?.length) return 'No semantic route yet.';
  const matches = route.topMatches
    .slice(0, 3)
    .map(match => `${match.name || match.id} ${Math.round((match.score || 0) * 100)}%`)
    .join(' · ');
  const base = route.needsCalibration
    ? 'Needs calibration'
    : `Semantic route: ${route.bestName || route.bestId || 'unknown'}`;
  return `${base}${matches ? ` · ${matches}` : ''}`;
}
