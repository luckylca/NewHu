import assert from 'node:assert/strict';
import test from 'node:test';
import {
  microBalancedAssignmentVector,
  scoreInterestGeometries,
} from '../../src/semantic-v2/recommendationGeometry';

test('MicroBalanced changes assignment geometry but keeps a unit vector', () => {
  const raw = new Float32Array([1, 1]);
  const mean = new Float32Array([1, 0]);
  const balanced = microBalancedAssignmentVector(raw, mean);
  const norm = Math.hypot(...balanced);
  assert.ok(Math.abs(norm - 1) < 1e-6);
  assert.ok(balanced[0] < balanced[1]);
});

test('interest assignment and semantic relevance remain independent', () => {
  const semanticCenters = {
    AI: new Float32Array([1, 0]),
    Robotics: new Float32Array([0.8, 0.6]),
  };
  const assignmentCenters = {
    AI: new Float32Array([1, 0]),
    Robotics: new Float32Array([0, 1]),
  };
  const result = scoreInterestGeometries(
    new Float32Array([1, 0]),
    new Float32Array([0, 1]),
    semanticCenters,
    assignmentCenters,
  );

  assert.equal(result.assignmentMatches[0][0], 'Robotics');
  assert.ok(Math.abs((result.semanticScores.get('AI') ?? 0) - 1) < 1e-6);
  assert.ok(Math.abs(result.bestSemanticScore - 1) < 1e-6);
  assert.ok((result.semanticScores.get('Robotics') ?? 0) < result.bestSemanticScore);
});
