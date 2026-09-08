import { strict as assert } from 'node:assert';
import test from 'node:test';
import { clearApiInstance, getApiInstance } from '../../src/api/ZhihuApi';

const COOKIE = 'd_c0=test-device; z_c0=test-session';

test('clearing the API session discards the credential-bearing singleton', () => {
    const first = getApiInstance(COOKIE);
    clearApiInstance();
    const second = getApiInstance(COOKIE);

    assert.notEqual(first, second);
    clearApiInstance();
});
