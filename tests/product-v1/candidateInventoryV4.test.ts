import assert from 'node:assert/strict';
import test from 'node:test';

import type { CandidateArticle } from '../../src/product-v1/core/candidateAcquisition';
import { CandidateInventoryV3 } from '../../src/product-v1/core/candidateInventoryV3';
import { displayableSupplySnapshot, searchDisplayQuota } from '../../src/product-v1/core/searchAcquisitionV4';

function searchCandidate(index: number, seedId = 'crypto-seed'): CandidateArticle {
  const id = `search-${index}`;
  return {
    articleId: id,
    url: `https://example.test/${id}`,
    title: id,
    excerpt: '',
    publishedAt: 1_700_000_000 + index,
    updatedAt: 1_700_000_000 + index,
    source: 'search',
    sourceQuery: seedId,
    searchSeedId: seedId,
    sourceRank: index,
    batchId: 'batch',
    sessionId: 'session',
    retrievedAt: new Date().toISOString(),
    rawMetadata: {
      targetInterest: 'Crypto',
      TARGET_INTEREST_SCORE: 0.9 - index * 0.001,
      searchOffset: 0,
    },
    duplicateKey: id,
    encoderEmbedding: null,
    matchedInterestIds: ['Crypto'],
    matchedInterestScores: [0.9],
    bestMatchedInterest: 'Crypto',
    bestSemanticScore: 0.9,
    qualified: true,
    rejectionReason: null,
    seenBefore: false,
    sourceOrigins: ['search'],
    queries: [seedId],
    seedIds: [seedId],
  };
}

test('V4 retains twelve qualified rows while only activating the current display quota', () => {
  const inventory = new CandidateInventoryV3();
  inventory.setReserveCap('Crypto', 56);
  const rows = Array.from({ length: 17 }, (_, index) => searchCandidate(index));
  const accepted = inventory.acceptSearchBatchV4(rows, 'Crypto', 3, 12, 'freshness_first', Date.now(), 14);

  assert.equal(accepted.targetQualifiedUnique, 17);
  assert.equal(accepted.activeAccepted, 3);
  assert.equal(inventory.active.size, 3);
  assert.equal(inventory.reserve.size, 9);
  assert.equal(inventory.active.size + inventory.reserve.size, 12);

  const snapshot = displayableSupplySnapshot(inventory.active.values(), { Crypto: 14 }, true);
  assert.equal(snapshot.counts.Crypto, 3);
  assert.equal(snapshot.searchQuotaByInterest.Crypto, 3);
});

test('Reserve from the same search unit becomes reusable after displayed rows are consumed', () => {
  const inventory = new CandidateInventoryV3();
  const rows = Array.from({ length: 12 }, (_, index) => searchCandidate(index));
  inventory.acceptSearchBatchV4(rows, 'Crypto', 3, 12, 'freshness_first', Date.now(), 14);
  inventory.markUsed([...inventory.active.keys()]);

  const moved = inventory.activateReserveDisplaySlots('Crypto', 3, 3);
  assert.equal(moved, 3);
  assert.equal(inventory.active.size, 3);
  assert.equal(inventory.reserve.size, 6);
});

test('explicit Crypto targets 40/60/70 percent are reachable from low Recommendation supply', () => {
  for (const desired of [8, 12, 14]) {
    const inventory = new CandidateInventoryV3();
    const recommendation = { ...searchCandidate(10_000), source: 'recommendation' as const, sourceOrigins: ['recommendation' as const], searchSeedId: null, seedIds: [], queries: [], rawMetadata: {} };
    inventory.addRecommendation([recommendation]);
    let requests = 0;
    while (requests < 10) {
      const before = displayableSupplySnapshot(inventory.active.values(), { Crypto: desired }, true);
      const deficit = Math.max(0, desired - (before.counts.Crypto ?? 0));
      if (deficit === 0) break;
      const quota = searchDisplayQuota(deficit, true);
      const rows = Array.from({ length: 17 }, (_, index) => searchCandidate(requests * 100 + index, `seed-${requests}`));
      inventory.acceptSearchBatchV4(rows, 'Crypto', Math.min(deficit, quota), 12, 'freshness_first', Date.now(), deficit);
      requests += 1;
    }
    const after = displayableSupplySnapshot(inventory.active.values(), { Crypto: desired }, true);
    assert.equal(after.counts.Crypto, desired, `desired=${desired}`);
    assert.ok(requests <= 7, `desired=${desired}, requests=${requests}`);
  }
});
