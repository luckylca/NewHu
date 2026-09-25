import assert from 'node:assert/strict';
import test from 'node:test';
import { bundledBadgeGraph } from '../../src/product-v1/bundledBadgeGraph';
import { selectProductV1ContentBadges } from '../../src/product-v1/topicBadgeSelection';

test('bundled capsule graph can classify explicit title topics without downloaded models', () => {
  const matches = selectProductV1ContentBadges(
    '深入理解大模型推理加速和模型压缩',
    '',
    bundledBadgeGraph,
    2,
  );

  assert.ok(matches.length > 0);
  assert.ok(matches.every((match) => match.label.length > 0));
});
