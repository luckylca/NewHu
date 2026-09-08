import assert from 'node:assert/strict';
import test from 'node:test';
import { selectProductV1DomainMatches } from '../../src/product-v1/domainSelection';

test('domain selection keeps multiple strong nearby domains and caps the result', () => {
  const matches = selectProductV1DomainMatches([
    { domain: 'AI', score: 0.43 },
    { domain: 'Technology', score: 0.40 },
    { domain: 'Robotics', score: 0.35 },
    { domain: 'Programming', score: 0.34 },
    { domain: 'Food', score: 0.20 },
  ], {
    labelForDomain: (domain) => `L:${domain}`,
  });

  assert.deepEqual(matches.map((row) => row.domain), ['AI', 'Technology', 'Robotics']);
  assert.deepEqual(matches.map((row) => row.label), ['L:AI', 'L:Technology', 'L:Robotics']);
});

test('domain selection deduplicates domains using their best seed score', () => {
  const matches = selectProductV1DomainMatches([
    { domain: 'AI', score: 0.21 },
    { domain: 'AI', score: 0.39 },
    { domain: 'Technology', score: 0.35 },
  ]);

  assert.deepEqual(matches, [
    { domain: 'AI', score: 0.39, label: 'AI' },
    { domain: 'Technology', score: 0.35, label: 'Technology' },
  ]);
});

test('domain selection hides weak or unknown classifications', () => {
  assert.deepEqual(selectProductV1DomainMatches([
    { domain: 'UNKNOWN', score: 0.9 },
    { domain: 'AI', score: 0.179 },
  ]), []);
});
