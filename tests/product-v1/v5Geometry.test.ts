import assert from 'node:assert/strict';
import test from 'node:test';

import {
  productV1V5BackgroundNorm,
  sourceScopedV5Embedding,
} from '../../src/product-v1/v5Geometry';

function norm(values: ArrayLike<number>) {
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) sum += Number(values[index]) ** 2;
  return Math.sqrt(sum);
}

test('v5 frozen Search background keeps the mobile handoff norm', () => {
  // The phone runtime stores the frozen background as Float32Array, so pin the
  // norm of the actual mobile payload instead of a higher-precision research value.
  assert.ok(Math.abs(productV1V5BackgroundNorm() - 0.6634892527357195) < 1e-8);
});

test('recommendation source keeps raw normalized geometry', () => {
  const raw = new Float32Array(128);
  raw[0] = 3;
  raw[1] = 4;
  const transformed = sourceScopedV5Embedding(raw, 'recommendation');
  assert.ok(Math.abs(transformed[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(transformed[1] - 0.8) < 1e-6);
  assert.ok(Math.abs(norm(transformed) - 1) < 1e-6);
});

test('search source subtracts frozen background then L2 normalizes', () => {
  const raw = new Float32Array(128);
  raw[0] = 1;
  const recommendation = sourceScopedV5Embedding(raw, 'recommendation');
  const search = sourceScopedV5Embedding(raw, 'search');

  assert.ok(Math.abs(norm(search) - 1) < 1e-6);
  assert.notDeepEqual(Array.from(search.slice(0, 8)), Array.from(recommendation.slice(0, 8)));
  assert.ok(search[1] < 0, 'positive background dimension should become negative after subtraction');
});
