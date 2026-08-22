import type { FeedType } from '@/src/types/zhihu';
import { commitProductFeedback } from '@/src/db/repositories/productV1Repository';
import { evaluateReward } from './core/reward';
import { observeExposure } from './core/exposureHistory';
import { updateProfile } from './core/profile';
import { updateRewardStats } from './core/rewardStats';
import { cosineSimilarity } from './encoder';
import { ensureProductV1Memory } from './runtime';
import { PRODUCT_V1_SCHEMA } from './constants';
import { useProductV1HealthStore } from './store';
import type { BehaviorEvent } from './core/types';
import type { ProductV1FeedbackInput } from './types';

const exposureIds = new Map<string, string>();

function eventId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function articleId(contentType: FeedType, contentId: string) {
  return `${contentType}:${contentId}`;
}

function findRecord(memory: Awaited<ReturnType<typeof ensureProductV1Memory>>, id: string) {
  return [...memory.records.values()].find((record) => record.candidate.articleId === id);
}

function similarity(memory: Awaited<ReturnType<typeof ensureProductV1Memory>>, left: string, right: string) {
  const a = findRecord(memory, left)?.candidate.encoderEmbedding;
  const b = findRecord(memory, right)?.candidate.encoderEmbedding;
  return a && b ? cosineSimilarity(a, b) : 0;
}

async function persistFeedback(
  input: ProductV1FeedbackInput,
  behavior: BehaviorEvent,
  applyReward: boolean,
) {
  const memory = await ensureProductV1Memory();
  const fullArticleId = articleId(input.contentType, input.contentId);
  const record = findRecord(memory, fullArticleId);
  if (!record) return;
  const exposureId = exposureIds.get(fullArticleId) ?? eventId('exposure');
  exposureIds.set(fullArticleId, exposureId);
  const health = useProductV1HealthStore.getState();
  const feedSessionId = health.lastCycleId ?? 'restored-session';
  const interestIds = record.candidate.matchedInterestIds.slice(0, 3);
  const signal = evaluateReward(behavior);
  const sourcePolicy = record.candidate.rawMetadata.sourcePolicy === 'bubble_break' ? 'bubble_break' : 'normal';
  const wasSerendipity = sourcePolicy === 'bubble_break' || record.candidate.rawMetadata.wasSerendipity === true;
  if (applyReward) {
    updateProfile(memory.profile, fullArticleId, interestIds, signal, Date.now(), (a, b) => similarity(memory, a, b));
    updateRewardStats(memory.rewardStats, record.candidate.bestMatchedInterest ?? null, signal);
    if (behavior.hidden || behavior.explicitNotInterested) {
      memory.inventory.markUsed([record.candidate.duplicateKey]);
      memory.used = [...memory.inventory.used];
    }
  }
  const envelope = {
    eventId: eventId('feedback'),
    articleId: fullArticleId,
    feedSessionId,
    exposureId,
    timestamp: new Date().toISOString(),
    eventType: input.eventType,
    sourcePolicy,
    wasSerendipity,
    interestIds,
    behavior,
    reward: signal,
  };
  await commitProductFeedback({
    event: {
      eventId: envelope.eventId,
      articleId: fullArticleId,
      feedSessionId,
      exposureId,
      eventType: input.eventType,
      payload: envelope,
    },
    states: [
      { component: 'profile', schemaVersion: PRODUCT_V1_SCHEMA.profile, payload: memory.profile },
      { component: 'rewardStats', schemaVersion: PRODUCT_V1_SCHEMA.rewardStats, payload: memory.rewardStats },
      { component: 'exposureHistory', schemaVersion: PRODUCT_V1_SCHEMA.exposureHistory, payload: memory.exposureHistory },
      { component: 'used', schemaVersion: 1, payload: memory.used },
    ],
  });
}

export async function recordProductV1Exposure(contentId: string, contentType: FeedType) {
  const memory = await ensureProductV1Memory();
  const fullArticleId = articleId(contentType, contentId);
  const record = findRecord(memory, fullArticleId);
  if (!record || exposureIds.has(fullArticleId)) return;
  exposureIds.set(fullArticleId, eventId('exposure'));
  observeExposure(memory.exposureHistory, fullArticleId, record.candidate.bestMatchedInterest ?? null);
  memory.inventory.markUsed([record.candidate.duplicateKey]);
  memory.used = [...memory.inventory.used];
  await persistFeedback({ contentId, contentType, eventType: 'impression' }, {
    impression: true, opened: false, dwellMs: 0, estimatedReadingMs: 0, scrollRatio: 0,
    liked: false, favorited: false, hidden: false, skipped: false, explicitNotInterested: false,
  }, false);
}

export async function recordProductV1Feedback(input: ProductV1FeedbackInput) {
  const behavior: BehaviorEvent = {
    impression: true,
    opened: Boolean(input.opened),
    dwellMs: Math.max(0, input.dwellMs ?? 0),
    estimatedReadingMs: Math.max(0, input.estimatedReadingMs ?? 0),
    scrollRatio: Math.min(1, Math.max(0, input.scrollRatio ?? 0)),
    liked: Boolean(input.liked),
    favorited: Boolean(input.favorited),
    hidden: Boolean(input.hidden),
    skipped: Boolean(input.skipped),
    explicitNotInterested: Boolean(input.explicitNotInterested),
  };
  await persistFeedback(input, behavior, true);
}
