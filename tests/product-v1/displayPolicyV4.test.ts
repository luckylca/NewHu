import assert from 'node:assert/strict';
import test from 'node:test';

import type { CandidateArticle } from '../../src/product-v1/core/candidateAcquisition';
import type { ProductV1CandidateRecord } from '../../src/product-v1/types';
import { promoteAutoSearchExploration, selectDiverseDisplayRecords } from '../../src/product-v1/displayPolicy';

function record(id: string, interest: string, source: 'recommendation' | 'search', seedId?: string): ProductV1CandidateRecord {
  const candidate: CandidateArticle = {
    articleId: id,
    url: `https://example.test/${id}`,
    title: id,
    excerpt: '',
    source,
    sourceRank: 0,
    batchId: 'batch',
    sessionId: 'session',
    retrievedAt: new Date().toISOString(),
    rawMetadata: source === 'search' ? { targetInterest: interest, searchOffset: 0 } : {},
    duplicateKey: id,
    encoderEmbedding: null,
    matchedInterestIds: [interest],
    matchedInterestScores: [0.9],
    bestMatchedInterest: interest,
    bestSemanticScore: 0.9,
    qualified: true,
    rejectionReason: null,
    seenBefore: false,
    sourceOrigins: [source],
    queries: seedId ? [seedId] : [],
    seedIds: seedId ? [seedId] : [],
    searchSeedId: seedId ?? null,
  };
  return { candidate, feed: {} as ProductV1CandidateRecord['feed'] };
}

test('display V4 allows adjacent Search from different units but breaks an interest burst after three', () => {
  const rows = [
    record('c1', 'Crypto', 'search', 's1'),
    record('c2', 'Crypto', 'search', 's2'),
    record('c3', 'Crypto', 'search', 's3'),
    record('c4', 'Crypto', 'search', 's4'),
    record('ai1', 'AI', 'recommendation'),
  ];
  const output = selectDiverseDisplayRecords(rows, { searchQuotaByInterest: { Crypto: 2 } });
  assert.deepEqual(output.slice(0, 5).map((row) => row.candidate.articleId), ['c1', 'c2', 'c3', 'ai1', 'c4']);
});

test('AUTO Search exploration can promote same-interest Search without changing the interest allocation', () => {
  const rows = [
    record('r1', 'Crypto', 'recommendation'),
    record('r2', 'Crypto', 'recommendation'),
    record('r3', 'AI', 'recommendation'),
    record('s1', 'Crypto', 'search', 'seed-a'),
  ];
  const scores = {
    r1: { finalScore: 0.90 },
    r2: { finalScore: 0.80 },
    r3: { finalScore: 0.85 },
    s1: { finalScore: 0.78 },
  };
  const promoted = promoteAutoSearchExploration(rows, scores, 1, 3, 0.12);
  assert.equal(promoted.slice(0, 3).filter((row) => row.candidate.source === 'search').length, 1);
  assert.equal(promoted.slice(0, 3).filter((row) => row.candidate.bestMatchedInterest === 'Crypto').length, 2);
});
