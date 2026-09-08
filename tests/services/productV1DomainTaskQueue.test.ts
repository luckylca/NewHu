import assert from 'node:assert/strict';
import test from 'node:test';
import { ProductV1DomainTaskQueue } from '../../src/product-v1/domainTaskQueue';

const result = (domain: string) => [{ domain, label: domain, score: 0.5 }];

test('domain task queue runs visible high priority work before queued low priority work', async () => {
  const queue = new ProductV1DomainTaskQueue();
  const order: string[] = [];

  const low = queue.enqueue('low', 'low', async () => {
    order.push('low');
    return result('low');
  });
  const high = queue.enqueue('high', 'high', async () => {
    order.push('high');
    return result('high');
  });

  await Promise.all([low, high]);
  assert.deepEqual(order, ['high', 'low']);
});

test('domain task queue cancels work that loses every consumer before execution', async () => {
  const queue = new ProductV1DomainTaskQueue();
  const controller = new AbortController();
  let executed = false;

  const pending = queue.enqueue('cancel-me', 'low', async () => {
    executed = true;
    return result('unexpected');
  }, controller.signal);
  controller.abort();

  assert.deepEqual(await pending, []);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(executed, false);
});

test('domain task queue deduplicates the same content and raises its pending priority', async () => {
  const queue = new ProductV1DomainTaskQueue();
  let executions = 0;
  const order: string[] = [];

  const first = queue.enqueue('same', 'low', async () => {
    executions += 1;
    order.push('same');
    return result('same');
  });
  const blocker = queue.enqueue('other', 'normal', async () => {
    order.push('other');
    return result('other');
  });
  const second = queue.enqueue('same', 'high', async () => result('should-not-run'));

  const [a, , b] = await Promise.all([first, blocker, second]);
  assert.equal(executions, 1);
  assert.deepEqual(order, ['same', 'other']);
  assert.deepEqual(a, b);
});
