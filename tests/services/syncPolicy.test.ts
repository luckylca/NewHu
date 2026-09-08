import { strict as assert } from 'node:assert';
import test from 'node:test';
import { isDependencySatisfied, isRetryableHttpStatus } from '../../src/services/syncPolicy';

test('a dependency completed during an earlier sync run is accepted', () => {
    assert.equal(isDependencySatisfied('parent', new Set(), 'synced'), true);
    assert.equal(isDependencySatisfied('parent', new Set(), 'pending'), false);
});

test('a dependency completed in the current run is accepted', () => {
    assert.equal(isDependencySatisfied('parent', new Set(['parent'])), true);
    assert.equal(isDependencySatisfied(null, new Set()), true);
});

test('only transient HTTP statuses are retried automatically', () => {
    for (const status of [408, 425, 429, 500, 503]) assert.equal(isRetryableHttpStatus(status), true);
    for (const status of [400, 401, 403, 404]) assert.equal(isRetryableHttpStatus(status), false);
});
