import assert from 'node:assert/strict';

import {
  buildAssistantSemanticProfiles,
  createSemanticCatalogFingerprint,
  formatSemanticRouteSummary,
  selectSemanticLoadout
} from '../src/semantic-router.js';

const catalog = {
  starter_automation: {
    id: 'starter_automation',
    name: 'Starter Automation',
    concepts: ['Bots repeat short JSON step loops.'],
    vocabulary: ['bot', 'loop', 'player', 'manager'],
    examples: [{ intent: 'bot 1 bring me a log', dsl: { steps: [{ op: 'pick_up' }] } }],
    actions: [{ op: 'pick_up', label: 'Pick up', description: 'Pick something up', promptSignature: 'pick_up(type?)' }]
  },
  woodworking: {
    id: 'woodworking',
    name: 'Woodworking',
    concepts: ['Logs feed sawbenches.'],
    vocabulary: ['log', 'sawbench', 'plank'],
    examples: [{ intent: 'keep sawbench full of logs', dsl: { steps: [{ op: 'deposit_to_structure' }] } }],
    actions: [{ op: 'deposit_to_structure', label: 'Deposit', description: 'Deposit an item', promptSignature: 'deposit_to_structure(type,target?)' }]
  }
};

const profiles = buildAssistantSemanticProfiles(catalog, ['starter_automation', 'woodworking']);
assert.equal(profiles.length, 2, 'buildAssistantSemanticProfiles should keep the active loadout packs');
assert.ok(profiles[0].texts.some(text => text.includes('starter automation')), 'profile texts should include the pack name');
assert.ok(profiles[1].texts.some(text => text.includes('sawbench')), 'profile texts should include pack vocabulary');

const route = {
  topMatches: [
    { id: 'woodworking', name: 'Woodworking', score: 0.91 },
    { id: 'starter_automation', name: 'Starter Automation', score: 0.82 }
  ],
  bestScore: 0.91,
  bestId: 'woodworking',
  bestName: 'Woodworking',
  needsCalibration: false
};
const selected = selectSemanticLoadout(route, ['starter_automation', 'woodworking']);
assert.deepEqual(selected.recommendedLoadout, ['woodworking', 'starter_automation'], 'router should keep the closest packs together');
assert.equal(selected.useRecommendedLoadout, true, 'strong routes should be applied');

const fallback = selectSemanticLoadout({
  topMatches: [{ id: 'woodworking', name: 'Woodworking', score: 0.41 }],
  bestScore: 0.41,
  bestId: 'woodworking',
  bestName: 'Woodworking',
  needsCalibration: true
}, ['starter_automation', 'woodworking']);
assert.equal(fallback.useRecommendedLoadout, false, 'weak routes should fall back to the original loadout');
assert.deepEqual(fallback.effectiveLoadout, ['starter_automation', 'woodworking'], 'fallback should preserve the full original loadout');

assert.match(formatSemanticRouteSummary(route), /Semantic route: Woodworking/, 'route summary should mention the best pack');
assert.equal(createSemanticCatalogFingerprint(catalog, ['starter_automation', 'woodworking']).includes('woodworking'), true, 'catalog fingerprint should include routed packs');

console.log('semantic router unit passed');

