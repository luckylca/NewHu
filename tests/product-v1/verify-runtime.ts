import { strict as assert } from 'node:assert';
import { CandidateInventoryV3, supplyInterestV3 } from '../../src/product-v1/core/candidateInventoryV3';
import type { CandidateArticle } from '../../src/product-v1/core/candidateAcquisition';
import { computeCandidateDeficits, desiredSupplyFromExplicit } from '../../src/product-v1/core/candidateDeficit';
import { createRatioControllerV2, allocateKnownInterestSlotV2 } from '../../src/product-v1/core/explicitInterestRatioV2';
import { evaluateReward } from '../../src/product-v1/core/reward';
import { highQualityEligibleV2 } from '../../src/product-v1/core/highQualityAcquisitionV2';
import { capAutoDesiredSupply, composeBubbleDisplayRecords, selectDiverseDisplayRecords } from '../../src/product-v1/displayPolicy';
import type { ProductV1CandidateRecord } from '../../src/product-v1/types';

function candidate(key: string, interest: string, source: 'recommendation' | 'search' = 'search'): CandidateArticle {
  return {
    articleId: key, url: '', title: key, excerpt: '', source, sourceRank: 0, batchId: 'b', sessionId: 's',
    retrievedAt: new Date().toISOString(), rawMetadata: source === 'search' ? { targetInterest: interest } : {},
    duplicateKey: key, matchedInterestIds: [interest], matchedInterestScores: [0.8], bestMatchedInterest: interest,
    bestSemanticScore: 0.8, qualified: true, seenBefore: false, sourceOrigins: [source], queries: [], seedIds: [],
  };
}

const desired = desiredSupplyFromExplicit({ AI: 0.6, Books: 0.4 }, 20);
assert.deepEqual(desired, { AI: 12, Books: 8 });
assert.equal(computeCandidateDeficits(desired, { AI: 12, Books: 5 }).find((row) => row.interestId === 'Books')?.deficit, 3);

const inventory = new CandidateInventoryV3();
inventory.reserve.set('reserve', candidate('reserve', 'AI'));
assert.equal(inventory.activateReserve('AI', 2), 1);
const result = inventory.acceptSearchBatch([
  candidate('a', 'AI'), candidate('b', 'AI'), candidate('c', 'AI'), candidate('d', 'AI'),
], 'AI', 3, 1, 'freshness_first');
assert.equal(result.activeAccepted, 3);
assert.equal(result.reserveInserted, 1);
assert.equal(supplyInterestV3(candidate('target', 'AI')), 'AI');
assert.deepEqual(capAutoDesiredSupply({ Photography: 20, Books: 4 }), { Photography: 8, Books: 4 });

const displayRecords = [
  ...Array.from({ length: 8 }, (_, index) => ({
    candidate: { ...candidate(`search-${index}`, 'Photography'), searchSeedId: index < 5 ? 'film' : `seed-${index}` },
    feed: {} as ProductV1CandidateRecord['feed'],
  })),
  ...Array.from({ length: 8 }, (_, index) => ({
    candidate: candidate(`recommendation-${index}`, index % 2 ? 'Books' : 'AI', 'recommendation'),
    feed: {} as ProductV1CandidateRecord['feed'],
  })),
];
const selectedDisplay = selectDiverseDisplayRecords(displayRecords);
assert.equal(selectedDisplay.filter((row) => row.candidate.source === 'search').length, 5);
assert.equal(selectedDisplay.filter((row) => row.candidate.searchSeedId === 'film').length, 2);
assert.ok(selectedDisplay.some((row, index) => index > 0
  && row.candidate.source === 'recommendation'
  && selectedDisplay[index - 1].candidate.source === 'search'));

const knownRecords = Array.from({ length: 20 }, (_, index) => ({
  candidate: candidate(`known-${index}`, index % 2 ? 'Books' : 'AI', 'recommendation'),
  feed: {} as ProductV1CandidateRecord['feed'],
}));
const bubbleRecord = {
  candidate: candidate('bubble', 'Travel'),
  feed: {} as ProductV1CandidateRecord['feed'],
};
bubbleRecord.candidate.rawMetadata.sourcePolicy = 'bubble_break';
assert.deepEqual(composeBubbleDisplayRecords(knownRecords, [bubbleRecord], false), knownRecords);
const bubbleDisplay = composeBubbleDisplayRecords(knownRecords, [bubbleRecord], true);
assert.equal(bubbleDisplay.filter((row) => row.candidate.rawMetadata.sourcePolicy === 'bubble_break').length, 1);
assert.equal(bubbleDisplay[10].candidate.duplicateKey, 'bubble');
assert.equal(bubbleDisplay.filter((row) => row.candidate.rawMetadata.sourcePolicy !== 'bubble_break').length, 20);

const qualityCandidate = candidate('quality', 'AI');
qualityCandidate.rawMetadata.voteupCount = 500;
assert.equal(highQualityEligibleV2(qualityCandidate), true);
qualityCandidate.rawMetadata.voteupCount = 10;
qualityCandidate.rawMetadata.favoriteCount = 2;
qualityCandidate.rawMetadata.commentCount = 3;
assert.equal(highQualityEligibleV2(qualityCandidate), false);

const ratio = createRatioControllerV2([
  { interestId: 'AI', userTarget: 0.7, pinned: false },
  { interestId: 'Books', userTarget: 0.3, pinned: false },
], 'EXPLICIT');
for (let index = 0; index < 20; index += 1) {
  allocateKnownInterestSlotV2(ratio, [
    { interestId: 'AI', baseScore: 0.8 },
    { interestId: 'Books', baseScore: 0.8 },
  ]);
}
assert.equal(ratio.allocationCounts.AI + ratio.allocationCounts.Books, 20);
assert.ok(ratio.allocationCounts.AI > ratio.allocationCounts.Books);

const reward = evaluateReward({
  impression: true, opened: true, dwellMs: 60_000, estimatedReadingMs: 60_000, scrollRatio: 1,
  liked: true, favorited: true, hidden: false, skipped: false, explicitNotInterested: false,
});
assert.equal(reward.reward, 1);
assert.equal(evaluateReward({
  impression: true, opened: false, dwellMs: 0, estimatedReadingMs: 0, scrollRatio: 0,
  liked: false, favorited: false, hidden: true, skipped: false, explicitNotInterested: true,
}).reward, -1);

console.log('PRODUCT_V1_RUNTIME_CONTRACTS=PASS');
