import assert from 'node:assert/strict';
import test from 'node:test';
import { StableAsyncResultCache } from '../../src/utils/stableAsyncResultCache';

test('stable async results are shared during a scroll remount and never replaced for the same item', async () => {
  const cache = new StableAsyncResultCache<string[]>(10);
  let classifications = 0;
  const first = cache.get('answer:42', async () => {
    classifications += 1;
    await Promise.resolve();
    return ['机器人'];
  });
  const concurrentRemount = cache.get('answer:42', async () => {
    classifications += 1;
    return ['Linux'];
  });

  assert.deepEqual(await first, ['机器人']);
  assert.deepEqual(await concurrentRemount, ['机器人']);
  assert.deepEqual(await cache.get('answer:42', async () => {
    classifications += 1;
    return ['其他'];
  }), ['机器人']);
  assert.equal(classifications, 1);
});
