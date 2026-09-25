import assert from 'node:assert/strict';
import test from 'node:test';

import type { CandidateArticle, SearchSeedCompact } from '../../src/product-v1/core/candidateAcquisition';
import {
  displayableSupplySnapshot,
  nextSearchOffset,
  pruneSearchUnitHistory,
  recordSearchUnit,
  reserveCapForDesiredSupply,
  SEARCH_MAX_REQUESTS_PER_CYCLE,
  SEARCH_UNIT_HISTORY_LIMIT,
  searchRequestBudget,
  selectSearchSeedUnit,
  type SearchUnitHistoryEntry,
} from '../../src/product-v1/core/searchAcquisitionV4';

function seed(seedId: string, text: string, parentText: string | null, rowIndex: number): SearchSeedCompact {
  return { seedId, text, parentText, rowIndex, enabled: true, broadCategory: 'Crypto' };
}

function candidate(id: string, source: 'recommendation' | 'search', seedId?: string, offset = 0): CandidateArticle {
  return {
    articleId: id,
    url: `https://example.test/${id}`,
    title: id,
    excerpt: '',
    source,
    sourceRank: 0,
    batchId: 'b',
    sessionId: 's',
    retrievedAt: new Date(0).toISOString(),
    rawMetadata: {
      targetInterest: 'Crypto',
      searchOffset: offset,
    },
    duplicateKey: id,
    encoderEmbedding: null,
    matchedInterestIds: ['Crypto'],
    matchedInterestScores: [0.8],
    bestMatchedInterest: 'Crypto',
    bestSemanticScore: 0.8,
    qualified: true,
    rejectionReason: null,
    seenBefore: false,
    sourceOrigins: [source],
    queries: seedId ? [seedId] : [],
    seedIds: seedId ? [seedId] : [],
    searchSeedId: seedId ?? null,
  };
}

test('search unit history advances 0 -> 20 -> 40 and expires by TTL', () => {
  const now = 1_000_000_000;
  let history: SearchUnitHistoryEntry[] = [];
  assert.equal(nextSearchOffset('seed-a', history, now), 0);
  history = recordSearchUnit(history, 'seed-a', 0, now);
  assert.equal(nextSearchOffset('seed-a', history, now), 20);
  history = recordSearchUnit(history, 'seed-a', 20, now);
  assert.equal(nextSearchOffset('seed-a', history, now), 40);
  history = recordSearchUnit(history, 'seed-a', 40, now);
  assert.equal(nextSearchOffset('seed-a', history, now), null);
  assert.equal(nextSearchOffset('seed-a', history, now + 24 * 60 * 60 * 1000 + 1), 0);
});

test('search unit history keeps at most the latest 100 exact seed-page units', () => {
  const now = 1_000_000_000;
  let history: SearchUnitHistoryEntry[] = [];
  for (let index = 0; index < 140; index += 1) {
    history = recordSearchUnit(history, `seed-${index}`, 0, now + index);
  }
  assert.equal(SEARCH_UNIT_HISTORY_LIMIT, 100);
  assert.equal(history.length, 100);
  assert.equal(pruneSearchUnitHistory(history, now + 140).length, 100);
  assert.equal(history[0]?.seedId, 'seed-40');
  assert.equal(history[99]?.seedId, 'seed-139');
});

test('seed selection prefers a new family but does not permanently block variants', () => {
  const seeds = [
    seed('a-root', '加密货币', null, 0),
    seed('a-variant', '加密货币 原理', '加密货币', 1),
    seed('b-root', '区块链', null, 2),
  ];
  const first = selectSearchSeedUnit(seeds, [], new Set(['加密货币']), 1_000);
  assert.equal(first?.seed.seedId, 'b-root');

  const onlySameFamily = selectSearchSeedUnit(seeds.slice(0, 2), [], new Set(['加密货币']), 1_000);
  assert.equal(onlySameFamily?.seed.seedId, 'a-root');
});

test('seed selection prefers unused page-0 units before page-20 of a higher-ranked seed', () => {
  const seeds = [
    seed('a-root', '加密货币', null, 0),
    seed('b-root', '区块链', null, 1),
  ];
  const history = recordSearchUnit([], 'a-root', 0, 1_000);
  const selected = selectSearchSeedUnit(seeds, history, new Set(), 1_001);
  assert.equal(selected?.seed.seedId, 'b-root');
  assert.equal(selected?.offset, 0);
});

test('displayable supply counts Search by seed-page quota rather than raw active count', () => {
  const rows = [
    candidate('r1', 'recommendation'),
    candidate('s1', 'search', 'seed-a'),
    candidate('s2', 'search', 'seed-a'),
    candidate('s3', 'search', 'seed-a'),
    candidate('s4', 'search', 'seed-a'),
  ];
  const highDeficit = displayableSupplySnapshot(rows, { Crypto: 8 }, true);
  assert.equal(highDeficit.recommendationCounts.Crypto, 1);
  assert.equal(highDeficit.searchQuotaByInterest.Crypto, 3);
  assert.equal(highDeficit.searchCounts.Crypto, 3);
  assert.equal(highDeficit.counts.Crypto, 4);

  const normal = displayableSupplySnapshot(rows, { Crypto: 6 }, true);
  assert.equal(normal.searchQuotaByInterest.Crypto, 2);
  assert.equal(normal.searchCounts.Crypto, 2);
});

test('V4 request and reserve bounds match the frozen Windows contract', () => {
  assert.equal(reserveCapForDesiredSupply(14), 56);
  assert.equal(reserveCapForDesiredSupply(5), 30);
  assert.equal(searchRequestBudget(13, 3), 8);
  assert.equal(searchRequestBudget(100, 2), SEARCH_MAX_REQUESTS_PER_CYCLE);
});
