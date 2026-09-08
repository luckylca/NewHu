import assert from 'node:assert/strict';
import test from 'node:test';
import type { CandidateArticle } from '../../src/product-v1/core/candidateAcquisition';
import { buildProductV1RecommendationReason } from '../../src/product-v1/recommendationReason';
import { parseProductV1RecommendationReason } from '../../src/types/recommendation';

function candidate(overrides: Partial<CandidateArticle> = {}): CandidateArticle {
  return {
    articleId: 'answer:1',
    url: 'https://www.zhihu.com/question/1/answer/1',
    title: '测试内容',
    excerpt: '测试摘要',
    source: 'recommendation',
    sourceRank: 0,
    batchId: 'cycle-1',
    sessionId: 'cycle-1',
    retrievedAt: new Date(0).toISOString(),
    rawMetadata: {},
    duplicateKey: 'answer:1',
    encoderEmbedding: null,
    matchedInterestIds: ['AI'],
    matchedInterestScores: [0.42],
    bestMatchedInterest: 'AI',
    bestSemanticScore: 0.42,
    qualified: true,
    rejectionReason: null,
    seenBefore: false,
    sourceOrigins: ['recommendation'],
    queries: [],
    seedIds: [],
    ...overrides,
  };
}

test('recommendation reason explains profile interest, semantic match and quality', () => {
  const reason = buildProductV1RecommendationReason(candidate({
    rawMetadata: { voteupCount: 700, favoriteCount: 20, commentCount: 10 },
  }), { profileAffinity: 0.8 });

  assert.ok(reason);
  assert.equal(reason.interestLabel, '人工智能');
  assert.equal(reason.semanticScore, 0.42);
  assert.equal(reason.qualitySignal, 'popular');
  assert.equal(reason.bubbleBreak, false);
  assert.equal(reason.summary, '因为你常看：人工智能 · 语义匹配 42% · 高互动');
});

test('recommendation reason prioritizes bubble-break domain and save quality', () => {
  const reason = buildProductV1RecommendationReason(candidate({
    source: 'search',
    sourceOrigins: ['search'],
    matchedInterestIds: ['Robotics'],
    matchedInterestScores: [0.36],
    bestMatchedInterest: 'Robotics',
    bestSemanticScore: 0.36,
    rawMetadata: {
      sourcePolicy: 'bubble_break',
      wasSerendipity: true,
      bubbleDomain: 'Robotics',
      bubbleDomainScore: 0.36,
      voteupCount: 70,
      favoriteCount: 100,
      commentCount: 5,
    },
  }));

  assert.ok(reason);
  assert.equal(reason.bubbleBreak, true);
  assert.equal(reason.bubbleDomainLabel, '机器人');
  assert.equal(reason.qualitySignal, 'ultra_high');
  assert.equal(reason.summary, '破圈推荐：机器人 · 语义匹配 36% · 高收藏价值');
});

test('recommendation reason parser round-trips valid reasons and rejects malformed data', () => {
  const reason = buildProductV1RecommendationReason(candidate(), { profileAffinity: 0.2 });
  assert.ok(reason);
  assert.deepEqual(parseProductV1RecommendationReason(JSON.stringify(reason)), reason);
  assert.equal(parseProductV1RecommendationReason('{"version":2}'), undefined);
  assert.equal(parseProductV1RecommendationReason('{broken'), undefined);
});
