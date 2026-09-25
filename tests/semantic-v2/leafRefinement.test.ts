import assert from 'node:assert/strict';
import test from 'node:test';
import { decideSemanticV2LeafRefinement } from '../../src/semantic-v2/leafRefinement';

const policy = {
  leafCosineGte: 0.6,
  leafMarginGte: 0.02,
  crossBroadRescue: {
    enabled: true,
    leafCosineGte: 0.6,
    leafMarginGte: 0.05,
  },
};

test('Semantic V2 keeps the original same-broad leaf gate', () => {
  assert.equal(decideSemanticV2LeafRefinement('AI', 'AI', 0.6, 0.02, policy), 'same-broad-leaf');
  assert.equal(decideSemanticV2LeafRefinement('AI', 'AI', 0.6, 0.019, policy), 'broad-fallback');
});

test('Semantic V2 cross-broad rescue uses the stricter margin', () => {
  assert.equal(decideSemanticV2LeafRefinement('Cars', 'Travel', 0.64, 0.05, policy), 'cross-broad-rescue');
  assert.equal(decideSemanticV2LeafRefinement('Cars', 'Travel', 0.64, 0.049, policy), 'broad-fallback');
  assert.equal(decideSemanticV2LeafRefinement('Cars', 'Travel', 0.59, 0.12, policy), 'broad-fallback');
});

test('Semantic V2 can disable cross-broad rescue without changing same-broad behavior', () => {
  const disabled = {
    ...policy,
    crossBroadRescue: { ...policy.crossBroadRescue, enabled: false },
  };
  assert.equal(decideSemanticV2LeafRefinement('Cars', 'Travel', 0.8, 0.2, disabled), 'broad-fallback');
  assert.equal(decideSemanticV2LeafRefinement('AI', 'AI', 0.7, 0.03, disabled), 'same-broad-leaf');
});
