import type { FeedItemInfo } from '@/src/types/zhihu';
import { commitProductCycle, loadProductCandidates, loadProductState } from '@/src/db/repositories/productV1Repository';
import { CandidateInventoryV3, supplyInterestV3 } from './core/candidateInventoryV3';
import { candidateDuplicateKey, type CandidateArticle } from './core/candidateAcquisition';
import { computeCandidateDeficits, desiredSupplyFromExplicit, desiredSupplyFromProfile } from './core/candidateDeficit';
import { createExposureHistory, repetitionRate } from './core/exposureHistory';
import { createProfileState, topNamedInterests } from './core/profile';
import { createRewardStats, rewardHistoryValue } from './core/rewardStats';
import { scoreFrozenCandidate } from './core/ranker';
import {
  allocateKnownInterestSlotV2,
  createRatioControllerV2,
  resetRatioToAutoV2,
  targetMapV2,
  type RatioControllerStateV2,
} from './core/explicitInterestRatioV2';
import { routeSearchSeedsV2, ROUTING_DOMAIN_SOFT_GATE, selectDiverseSearchSeedsV2 } from './core/searchSeedRouterV2';
import { highQualityEligibleV2 } from './core/highQualityAcquisitionV2';
import { bubbleSlotCount, sampleDomainSeed } from './core/bubbleBreakPolicy';
import type { ExposureHistoryState, ProfileState, RewardStatsState, ScoreBreakdown } from './core/types';
import { cosineSimilarity, encodeArticle, resetProductV1Encoder, verifyProductV1Encoder } from './encoder';
import { loadProductV1SeedBank, loadProductV1SeedEmbeddings, resetProductV1AssetCache } from './assets';
import { fetchProductSearch } from './sourceAdapter';
import { loadProductV1Settings } from './settings';
import { PRODUCT_V1_SCHEMA, PRODUCT_V1_VERSION } from './constants';
import { updateProductV1Health } from './store';
import type { ProductV1CandidateRecord, ProductV1RuntimeState, ProductV1Trace } from './types';
import { ensureProductV1RuntimeAssets, type ProductV1AssetDownloadProgress } from './runtimeAssets';
import {
  capAutoDesiredSupply,
  composeBubbleDisplayRecords,
  MAX_SEARCH_CANDIDATES_PER_SEED,
  selectDiverseDisplayRecords,
} from './displayPolicy';

type RuntimeMemory = ProductV1RuntimeState & {
  inventory: CandidateInventoryV3;
  records: Map<string, ProductV1CandidateRecord>;
  recentSearchSeedIds: string[];
};

let memoryPromise: Promise<RuntimeMemory> | null = null;
let runtimeQueue: Promise<unknown> = Promise.resolve();
let initialized = false;

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function enqueue<T>(task: () => Promise<T>) {
  const run = runtimeQueue.then(task, task);
  runtimeQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function loadMemory(mode: 'live' | 'shadow'): Promise<RuntimeMemory> {
  const profile = await loadProductState<ProfileState>('profile') ?? createProfileState();
  const rewardStats = await loadProductState<RewardStatsState>('rewardStats') ?? createRewardStats();
  const exposureHistory = await loadProductState<ExposureHistoryState>('exposureHistory') ?? createExposureHistory();
  const used = await loadProductState<string[]>('used') ?? [];
  const recentSearchSeedIds = await loadProductState<string[]>('recentSearchSeedIds') ?? [];
  let ratio = await loadProductState<RatioControllerStateV2>('ratio');
  if (!ratio || ratio.version !== 2) ratio = createRatioControllerV2([], 'AUTO');
  const namespaces = mode === 'shadow' ? ['shadow_active', 'shadow_reserve'] : ['active', 'reserve'];
  const stored = await loadProductCandidates(namespaces);
  const inventory = new CandidateInventoryV3();
  const records = new Map<string, ProductV1CandidateRecord>();
  for (const key of used) inventory.used.add(key);
  for (const record of stored[namespaces[0]] ?? []) {
    records.set(record.candidate.duplicateKey, record);
    if (!inventory.used.has(record.candidate.duplicateKey)) inventory.active.set(record.candidate.duplicateKey, record.candidate);
  }
  for (const record of stored[namespaces[1]] ?? []) {
    records.set(record.candidate.duplicateKey, record);
    if (!inventory.used.has(record.candidate.duplicateKey)) inventory.reserve.set(record.candidate.duplicateKey, record.candidate);
  }
  inventory.pruneReserve();
  return { profile, rewardStats, exposureHistory, ratio, used, inventory, records, recentSearchSeedIds };
}

async function initializeProductV1(onProgress?: (progress: ProductV1AssetDownloadProgress) => void) {
  if (initialized) return;
  updateProductV1Health({ phase: 'initializing', lastError: null });
  try {
    await ensureProductV1RuntimeAssets(onProgress);
    const seedBank = loadProductV1SeedBank();
    await loadProductV1SeedEmbeddings();
    const norm = await verifyProductV1Encoder();
    initialized = true;
    updateProductV1Health({ phase: 'ready', encoderReady: true, encoderNorm: norm, seedCount: seedBank.seedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateProductV1Health({ phase: 'degraded', encoderReady: false, lastError: message });
    throw error;
  }
}

export function warmProductV1Runtime(onProgress?: (progress: ProductV1AssetDownloadProgress) => void) {
  return enqueue(() => initializeProductV1(onProgress));
}

export function resetProductV1Runtime() {
  initialized = false;
  resetProductV1AssetCache();
  resetProductV1Encoder();
  updateProductV1Health({ phase: 'idle', encoderReady: false, encoderNorm: null, lastError: null });
}

function toCandidate(feed: FeedItemInfo, source: 'recommendation' | 'search', cycleId: string, rank: number): CandidateArticle {
  const articleId = `${feed.feedType}:${feed.item.id}`;
  const url = feed.feedType === 'article'
    ? `https://zhuanlan.zhihu.com/p/${feed.item.id}`
    : `https://www.zhihu.com/question/${feed.item.questionId}/answer/${feed.item.id}`;
  return {
    articleId,
    url,
    title: feed.item.title || feed.item.questionTitle,
    excerpt: feed.item.excerpt,
    authorId: feed.item.authorUrlToken,
    authorName: feed.item.authorName,
    publishedAt: feed.item.updatedTime,
    updatedAt: feed.item.updatedTime,
    source,
    sourceRank: rank,
    batchId: cycleId,
    sessionId: cycleId,
    retrievedAt: new Date().toISOString(),
    rawMetadata: {
      voteupCount: feed.item.voteCount,
      favoriteCount: feed.item.favoriteCount || undefined,
      commentCount: feed.item.commentCount,
      feedType: feed.feedType,
    },
    duplicateKey: candidateDuplicateKey(articleId, url, feed.item.title),
    encoderEmbedding: null,
    matchedInterestIds: [],
    matchedInterestScores: [],
    bestMatchedInterest: null,
    bestSemanticScore: null,
    qualified: false,
    rejectionReason: null,
    seenBefore: false,
    sourceOrigins: [source],
    queries: [],
    seedIds: [],
  };
}

function interestVectors(memory: RuntimeMemory) {
  const output: Record<string, Float32Array> = {};
  const weights: Record<string, number> = {};
  for (const center of memory.profile.centers) {
    for (const exemplar of center.exemplars) {
      const record = [...memory.records.values()].find((item) => item.candidate.articleId === exemplar.articleId);
      const embedding = record?.candidate.encoderEmbedding;
      if (!embedding) continue;
      for (const tag of center.tags) {
        output[tag] ??= new Float32Array(embedding.length);
        weights[tag] = (weights[tag] ?? 0) + exemplar.weight;
        embedding.forEach((value, index) => { output[tag][index] += value * exemplar.weight; });
      }
    }
  }
  for (const [tag, vector] of Object.entries(output)) {
    const weight = Math.max(weights[tag], 1e-12);
    vector.forEach((value, index) => { vector[index] = value / weight; });
  }
  return output;
}

async function enrichCandidate(candidate: CandidateArticle, memory: RuntimeMemory, targetInterest?: string) {
  const embedding = await encodeArticle(candidate);
  candidate.encoderEmbedding = Array.from(embedding);
  const centers = interestVectors(memory);
  const matches = Object.entries(centers)
    .map(([interest, center]) => [interest, cosineSimilarity(embedding, center)] as const)
    .sort((a, b) => b[1] - a[1]);

  if (!targetInterest) {
    const bank = loadProductV1SeedBank();
    const seedEmbeddings = await loadProductV1SeedEmbeddings();
    const routed = routeSearchSeedsV2(embedding, bank, seedEmbeddings, {
      primaryDomains: [],
      variant: 'GLOBAL_COSINE',
      topK: 12,
    });
    const broadDomains = new Map<string, number>();
    for (const row of routed) {
      broadDomains.set(row.score.broadDomain, Math.max(
        broadDomains.get(row.score.broadDomain) ?? -1,
        row.score.semanticScore,
      ));
    }
    for (const [domain, score] of broadDomains) {
      const existing = matches.findIndex(([interest]) => interest === domain);
      if (existing >= 0) matches[existing] = [domain, Math.max(matches[existing][1], score)];
      else matches.push([domain, score]);
    }
    matches.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  candidate.matchedInterestIds = matches.map(([interest]) => interest);
  candidate.matchedInterestScores = matches.map(([, score]) => score);
  candidate.bestMatchedInterest = matches[0]?.[0] ?? null;
  candidate.bestSemanticScore = matches[0]?.[1] ?? 0;
  candidate.qualified = targetInterest
    ? (matches.find(([interest]) => interest === targetInterest)?.[1] ?? cosineSimilarity(embedding, centers[targetInterest] ?? embedding)) >= 0.24
    : candidate.bestSemanticScore >= 0.18;
  candidate.rejectionReason = candidate.qualified ? null : 'SEMANTIC_BELOW_THRESHOLD';
  if (targetInterest) {
    candidate.rawMetadata.targetInterest = targetInterest;
    candidate.rawMetadata.TARGET_INTEREST_SCORE = matches.find(([interest]) => interest === targetInterest)?.[1] ?? candidate.bestSemanticScore;
  }
}

function autoProfileTargets(profile: ProfileState) {
  return Object.fromEntries(topNamedInterests(profile, 9));
}

function rankActive(memory: RuntimeMemory): { records: ProductV1CandidateRecord[]; scores: Record<string, ScoreBreakdown> } {
  const rows = [...memory.inventory.active.values()]
    .filter((candidate) => !memory.inventory.used.has(candidate.duplicateKey) && memory.records.has(candidate.duplicateKey));
  const scores: Record<string, ScoreBreakdown> = {};
  const now = Date.now();
  for (const candidate of rows) {
    const updated = typeof candidate.updatedAt === 'number' ? candidate.updatedAt * (candidate.updatedAt < 1e12 ? 1000 : 1) : Date.parse(String(candidate.updatedAt));
    const ageDays = Number.isFinite(updated) ? Math.max(0, (now - updated) / 86_400_000) : 30;
    const interest = supplyInterestV3(candidate);
    scores[candidate.duplicateKey] = scoreFrozenCandidate({
      articleId: candidate.articleId,
      matchedInterestId: interest,
      retrievalScore: Math.max(0, 1 - candidate.sourceRank / 30),
      semantic: candidate.bestSemanticScore ?? 0,
      profileAffinity: interest ? Math.max(0, memory.profile.namedScores[interest] ?? 0) : 0,
      rewardHistory: rewardHistoryValue(memory.rewardStats, interest),
      freshness: Math.exp(-ageDays / 45),
      novelty: candidate.seenBefore ? 0 : 1,
      exploration: interest ? 0 : 0.5,
      diversity: interest ? 1 - repetitionRate(memory.exposureHistory, interest) : 0.5,
      repetition: repetitionRate(memory.exposureHistory, interest),
      suppression: interest && (memory.profile.namedScores[interest] ?? 0) < 0 ? Math.abs(memory.profile.namedScores[interest]) : 0,
      interestRatioDeficit: 0,
    });
  }

  const queues = new Map<string, CandidateArticle[]>();
  for (const candidate of rows) {
    const interest = supplyInterestV3(candidate);
    if (!interest) continue;
    const queue = queues.get(interest) ?? [];
    queue.push(candidate);
    queues.set(interest, queue);
  }
  for (const queue of queues.values()) queue.sort((a, b) => scores[b.duplicateKey].finalScore - scores[a.duplicateKey].finalScore);

  const ordered: CandidateArticle[] = [];
  while (ordered.length < rows.length && queues.size) {
    const heads = [...queues.entries()].filter(([, queue]) => queue.length).map(([interestId, queue]) => ({
      interestId,
      baseScore: scores[queue[0].duplicateKey].finalScore,
      candidateId: queue[0].duplicateKey,
    }));
    const decision = allocateKnownInterestSlotV2(memory.ratio, heads);
    if (!decision.interestId) break;
    const candidate = queues.get(decision.interestId)?.shift();
    if (candidate) ordered.push(candidate);
    if (!queues.get(decision.interestId)?.length) queues.delete(decision.interestId);
  }
  const selected = new Set(ordered.map((candidate) => candidate.duplicateKey));
  ordered.push(...rows.filter((candidate) => !selected.has(candidate.duplicateKey))
    .sort((a, b) => scores[b.duplicateKey].finalScore - scores[a.duplicateKey].finalScore));
  return { records: ordered.map((candidate) => memory.records.get(candidate.duplicateKey)!), scores };
}

function seedFamily(seed: { text: string; parentText?: string | null }) {
  return (seed.parentText ?? seed.text).trim().toLocaleLowerCase();
}

async function acquireSearch(
  memory: RuntimeMemory,
  desiredSupply: Record<string, number>,
  trace: ProductV1Trace,
  highQualityEnabled: boolean,
) {
  const seedBank = loadProductV1SeedBank();
  const seedEmbeddings = await loadProductV1SeedEmbeddings();
  const seedById = new Map(seedBank.seeds.map((seed) => [seed.seedId, seed]));
  const usedSeeds = new Set<string>();
  const usedFamilies = new Set<string>();
  for (const seedId of memory.recentSearchSeedIds) {
    usedSeeds.add(seedId);
    const seed = seedById.get(seedId);
    if (seed) usedFamilies.add(seedFamily(seed));
  }
  for (const record of memory.records.values()) {
    const ids = [...record.candidate.seedIds, ...(record.candidate.searchSeedId ? [record.candidate.searchSeedId] : [])];
    for (const seedId of ids) {
      usedSeeds.add(seedId);
      const seed = seedById.get(seedId);
      if (seed) usedFamilies.add(seedFamily(seed));
    }
  }
  let requestCount = 0;
  while (requestCount < 6) {
    const deficits = computeCandidateDeficits(desiredSupply, memory.inventory.activeCounts())
      .filter((deficit) => deficit.deficit > 0)
      .sort((a, b) => b.normalizedDeficit - a.normalizedDeficit);
    const target = deficits[0];
    if (!target) break;
    const moved = memory.inventory.activateReserve(target.interestId, target.desiredSupply);
    trace.reserveActivated += moved;
    if (moved > 0) continue;
    const center = interestVectors(memory)[target.interestId];
    if (!center) break;
    const routedSeeds = routeSearchSeedsV2(center, seedBank, seedEmbeddings, {
      primaryDomains: [target.interestId],
      variant: ROUTING_DOMAIN_SOFT_GATE,
      topK: 60,
    });
    const seeds = selectDiverseSearchSeedsV2(routedSeeds, 20);
    const next = seeds.find((row) => !usedSeeds.has(row.seed.seedId) && !usedFamilies.has(seedFamily(row.seed)));
    if (!next) break;
    usedSeeds.add(next.seed.seedId);
    usedFamilies.add(seedFamily(next.seed));
    memory.recentSearchSeedIds = [...memory.recentSearchSeedIds, next.seed.seedId].slice(-60);
    if (requestCount > 0) await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 300));
    const feeds = await fetchProductSearch(next.seed.text, 0, highQualityEnabled);
    requestCount += 1;
    trace.searchRequestCount = requestCount;
    trace.searchSeedIds.push(next.seed.seedId);
    const candidates: CandidateArticle[] = [];
    for (const [index, feed] of feeds.entries()) {
      const candidate = toCandidate(feed, 'search', trace.cycleId, index);
      candidate.sourceQuery = next.seed.text;
      candidate.searchSeedId = next.seed.seedId;
      candidate.queries = [next.seed.text];
      candidate.seedIds = [next.seed.seedId];
      await enrichCandidate(candidate, memory, target.interestId);
      memory.records.set(candidate.duplicateKey, { candidate, feed });
      candidates.push(candidate);
    }
    const eligibleCandidates = highQualityEnabled ? candidates.filter(highQualityEligibleV2) : candidates;
    const accepted = memory.inventory.acceptSearchBatch(
      eligibleCandidates.slice(0, MAX_SEARCH_CANDIDATES_PER_SEED),
      target.interestId,
      target.desiredSupply,
      1,
      'freshness_first',
    );
    trace.reserveInserted += accepted.reserveInserted;
    if (accepted.targetQualifiedUnique < 2 && requestCount >= 2) break;
  }
}

async function acquireBubble(
  memory: RuntimeMemory,
  trace: ProductV1Trace,
  enabled: boolean,
  highQualityEnabled: boolean,
) {
  const required = bubbleSlotCount(20, enabled, 'low');
  if (required === 0) return [];
  const seedBank = loadProductV1SeedBank();
  const profileDomains = new Set(topNamedInterests(memory.profile, 9).map(([interest]) => interest));
  const blockedSeedIds = new Set(memory.recentSearchSeedIds);
  const blockedFamilies = new Set<string>();
  for (const seedId of blockedSeedIds) {
    const seed = seedBank.seeds.find((row) => row.seedId === seedId);
    if (seed) blockedFamilies.add(seedFamily(seed));
  }
  const available = seedBank.seeds
    .filter((seed) => seed.enabled
      && Boolean(seed.broadCategory)
      && !profileDomains.has(seed.broadCategory!)
      && !blockedSeedIds.has(seed.seedId)
      && !blockedFamilies.has(seedFamily(seed)))
    .map((seed) => ({ ...seed, broadDomain: seed.broadCategory! }));
  const sampled = sampleDomainSeed(available, trace.cycleId, 0);
  const selected = sampled ? seedBank.seeds.find((seed) => seed.seedId === sampled.seedId) : null;
  if (!selected?.broadCategory) return [];

  if (trace.searchRequestCount > 0) await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 300));
  const feeds = await fetchProductSearch(selected.text, 0, highQualityEnabled);
  trace.searchRequestCount += 1;
  trace.bubbleSearchRequestCount = (trace.bubbleSearchRequestCount ?? 0) + 1;
  trace.bubbleSeedIds = [...(trace.bubbleSeedIds ?? []), selected.seedId];
  memory.recentSearchSeedIds = [...memory.recentSearchSeedIds, selected.seedId].slice(-60);

  const records: ProductV1CandidateRecord[] = [];
  for (const [index, feed] of feeds.entries()) {
    const candidate = toCandidate(feed, 'search', trace.cycleId, index);
    if (memory.inventory.used.has(candidate.duplicateKey) || memory.records.has(candidate.duplicateKey)) continue;
    candidate.sourceQuery = selected.text;
    candidate.searchSeedId = selected.seedId;
    candidate.queries = [selected.text];
    candidate.seedIds = [selected.seedId];
    candidate.rawMetadata.sourcePolicy = 'bubble_break';
    candidate.rawMetadata.wasSerendipity = true;
    candidate.rawMetadata.bubbleDomain = selected.broadCategory;
    await enrichCandidate(candidate, memory);
    const domainIndex = candidate.matchedInterestIds.indexOf(selected.broadCategory);
    const domainScore = domainIndex >= 0 ? candidate.matchedInterestScores[domainIndex] : 0;
    candidate.qualified = domainScore >= 0.18;
    candidate.rejectionReason = candidate.qualified ? null : 'BUBBLE_DOMAIN_BELOW_THRESHOLD';
    candidate.rawMetadata.bubbleDomainScore = domainScore;
    if (!candidate.qualified || (highQualityEnabled && !highQualityEligibleV2(candidate))) continue;
    const record = { candidate, feed };
    memory.records.set(candidate.duplicateKey, record);
    records.push(record);
  }
  return records
    .sort((a, b) => Number(b.candidate.rawMetadata.bubbleDomainScore ?? 0)
      - Number(a.candidate.rawMetadata.bubbleDomainScore ?? 0)
      || a.candidate.sourceRank - b.candidate.sourceRank)
    .slice(0, required);
}

function recordsFor(memory: RuntimeMemory, source: Map<string, CandidateArticle>) {
  return [...source.keys()].map((key) => memory.records.get(key)).filter((record): record is ProductV1CandidateRecord => Boolean(record));
}

async function runCycle(items: FeedItemInfo[]) {
  const settings = await loadProductV1Settings();
  if (!settings.enabled) return items;
  await initializeProductV1();
  const cycleId = id('cycle');
  const trace: ProductV1Trace = {
    cycleId,
    mode: settings.mode,
    status: 'running',
    startedAt: Date.now(),
    recommendationCount: items.length,
    searchRequestCount: 0,
    searchSeedIds: [],
    bubbleBreakEnabled: settings.bubbleBreakEnabled,
    bubbleSearchRequestCount: 0,
    bubbleSeedIds: [],
    bubbleDisplayedCount: 0,
    reserveActivated: 0,
    reserveInserted: 0,
    desiredSupply: {},
    deficits: {},
    activeCount: 0,
    reserveCount: 0,
    displayedOrder: items.map((item) => `${item.feedType}:${item.item.id}`),
    ratioTarget: {},
    ratioAchieved: {},
  };
  updateProductV1Health({ phase: 'running', lastCycleId: cycleId });
  const memory = await loadMemory(settings.mode);
  memoryPromise = Promise.resolve(memory);
  try {
    for (const [index, feed] of items.entries()) {
      const candidate = toCandidate(feed, 'recommendation', cycleId, index);
      if (memory.inventory.used.has(candidate.duplicateKey)) continue;
      await enrichCandidate(candidate, memory);
      memory.records.set(candidate.duplicateKey, { candidate, feed });
      if (!settings.highQualityEnabled || highQualityEligibleV2(candidate)) {
        memory.inventory.addRecommendation([candidate]);
      }
    }
    const profileTargets = autoProfileTargets(memory.profile);
    if (memory.ratio.mode === 'AUTO') resetRatioToAutoV2(memory.ratio, profileTargets);
    const targets = targetMapV2(memory.ratio);
    const desired = memory.ratio.mode === 'EXPLICIT'
      ? desiredSupplyFromExplicit(targets)
      : capAutoDesiredSupply(desiredSupplyFromProfile(targets));
    trace.desiredSupply = desired;
    trace.ratioTarget = targets;
    await acquireSearch(memory, desired, trace, settings.highQualityEnabled);
    const bubbleRecords = await acquireBubble(memory, trace, settings.bubbleBreakEnabled, settings.highQualityEnabled);
    trace.deficits = Object.fromEntries(computeCandidateDeficits(desired, memory.inventory.activeCounts()).map((row) => [row.interestId, row.deficit]));
    const ranked = rankActive(memory);
    const qualityEligible = settings.highQualityEnabled
      ? ranked.records.filter((record) => highQualityEligibleV2(record.candidate))
      : ranked.records;
    const knownOrder = selectDiverseDisplayRecords(qualityEligible).slice(0, 80);
    const liveOrder = composeBubbleDisplayRecords(knownOrder, bubbleRecords, settings.bubbleBreakEnabled).slice(0, 80);
    trace.bubbleDisplayedCount = liveOrder.filter((record) => record.candidate.rawMetadata.sourcePolicy === 'bubble_break').length;
    const achieved: Record<string, number> = {};
    const knownHorizon = liveOrder
      .filter((record) => record.candidate.rawMetadata.sourcePolicy !== 'bubble_break')
      .slice(0, 20);
    for (const record of knownHorizon) {
      const interest = supplyInterestV3(record.candidate);
      if (interest) achieved[interest] = (achieved[interest] ?? 0) + 1;
    }
    trace.ratioAchieved = Object.fromEntries(Object.entries(achieved).map(([key, count]) => [key, count / Math.max(1, knownHorizon.length)]));
    trace.activeCount = memory.inventory.active.size;
    trace.reserveCount = memory.inventory.reserve.size;
    trace.status = 'complete';
    trace.completedAt = Date.now();
    if (settings.mode === 'shadow') trace.shadowOrder = liveOrder.map((record) => record.candidate.articleId);
    else trace.displayedOrder = liveOrder.map((record) => record.candidate.articleId);
    await commitProductCycle({
      trace,
      active: recordsFor(memory, memory.inventory.active),
      reserve: recordsFor(memory, memory.inventory.reserve),
      states: [
        { component: 'profile', schemaVersion: PRODUCT_V1_SCHEMA.profile, payload: memory.profile },
        { component: 'rewardStats', schemaVersion: PRODUCT_V1_SCHEMA.rewardStats, payload: memory.rewardStats },
        { component: 'exposureHistory', schemaVersion: PRODUCT_V1_SCHEMA.exposureHistory, payload: memory.exposureHistory },
        { component: 'ratio', schemaVersion: 2, payload: memory.ratio },
        { component: 'used', schemaVersion: 1, payload: [...memory.inventory.used] },
        { component: 'recentSearchSeedIds', schemaVersion: 1, payload: memory.recentSearchSeedIds },
      ],
    });
    updateProductV1Health({
      phase: 'ready', activeCount: trace.activeCount, reserveCount: trace.reserveCount,
      lastCycleId: cycleId, lastCycleAt: trace.completedAt, lastError: null,
    });
    return settings.mode === 'shadow' ? items : liveOrder.map((record) => record.feed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trace.status = 'aborted';
    trace.completedAt = Date.now();
    trace.error = message;
    updateProductV1Health({ phase: 'degraded', lastError: message, lastCycleId: cycleId, lastCycleAt: trace.completedAt });
    return items;
  }
}

export function processProductV1Feed(items: FeedItemInfo[]) {
  return enqueue(() => runCycle(items)).catch((error) => {
    updateProductV1Health({ phase: 'degraded', lastError: error instanceof Error ? error.message : String(error) });
    return items;
  });
}

export function getProductV1Memory() {
  return memoryPromise;
}

export function ensureProductV1Memory() {
  if (!memoryPromise) memoryPromise = loadMemory('live');
  return memoryPromise;
}

export const PRODUCT_RUNTIME_VERSION = PRODUCT_V1_VERSION;
