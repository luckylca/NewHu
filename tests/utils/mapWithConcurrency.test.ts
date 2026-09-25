import assert from 'node:assert/strict';
import test from 'node:test';
import { mapWithConcurrency } from '../../src/utils/mapWithConcurrency';

test('mapWithConcurrency caps parallel work and keeps results in input order', async () => {
  const items = [0, 1, 2, 3, 4, 5];
  let active = 0;
  let peak = 0;

  const results = await mapWithConcurrency(items, 2, async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, (5 - item) * 2));
    active -= 1;
    return item * 10;
  });

  assert.equal(peak, 2);
  assert.deepEqual(results, [0, 10, 20, 30, 40, 50]);
});

test('mapWithConcurrency handles empty lists and clamps concurrency to one worker', async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async (item: number) => item), []);

  let active = 0;
  let peak = 0;
  await mapWithConcurrency([1, 2, 3], 0, async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await Promise.resolve(item);
    active -= 1;
    return item;
  });

  assert.equal(peak, 1);
});
