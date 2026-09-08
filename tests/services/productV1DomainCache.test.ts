import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProductV1DomainFingerprint,
  parseProductV1DomainCache,
  serializeProductV1DomainCache,
  type ProductV1DomainCacheEntry,
} from '../../src/product-v1/domainCache';

test('domain cache fingerprint is stable and changes with content', () => {
  const first = createProductV1DomainFingerprint('机器人', '嵌入式控制');
  const same = createProductV1DomainFingerprint('机器人', '嵌入式控制');
  const changed = createProductV1DomainFingerprint('机器人', '视觉控制');
  assert.equal(first, same);
  assert.notEqual(first, changed);
});

test('domain cache round-trips valid entries and enforces its cap', () => {
  const entries: ProductV1DomainCacheEntry[] = [
    ['answer:1', { fingerprint: 'a', matches: [{ domain: 'AI', label: '人工智能', score: 0.42 }] }],
    ['answer:2', { fingerprint: 'b', matches: [{ domain: 'Robotics', label: '机器人', score: 0.39 }] }],
  ];
  const parsed = parseProductV1DomainCache(serializeProductV1DomainCache(entries), 1);
  assert.deepEqual(parsed, [entries[1]]);
});

test('domain cache rejects malformed or mismatched payloads', () => {
  assert.deepEqual(parseProductV1DomainCache('{"version":999,"entries":[]}', 500), []);
  assert.deepEqual(parseProductV1DomainCache('{broken', 500), []);
  assert.deepEqual(parseProductV1DomainCache(JSON.stringify({
    version: 1,
    entries: [['answer:1', { fingerprint: 'x', matches: [{ domain: 'AI', label: '人工智能', score: 'bad' }] }]],
  }), 500), []);
});
