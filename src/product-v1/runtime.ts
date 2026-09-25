import { yieldToUI } from './core/cooperative';
import type { FeedItemInfo } from '@/src/types/zhihu';
import { commitProductCycle, loadProductCandidates, loadProductState } from '@/src/db/repositories/productV1Repository';
import { CandidateInventoryV3, supplyInterestV3 } from './core/candidateInventoryV3';
import { candidateDuplicateKey, type CandidateArticle, type SearchSeedCompact } from './core/candidateAcquisition';
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
import { routeSearchSeedsV2Async, ROUTING_DOMAIN_SOFT_GATE } from './core/searchSeedRouterV2';
import { routeTopicGraphV1Async, topicGraphBroadDomainVector } from './core/searchTopicGraphV1';
import { highQualityEligibleV2 } from './core/highQualityAcquisitionV2';
import {
  AUTO_SEARCH_EXPLORATION_TARGET,
  AUTO_SEARCH_MAX_PROACTIVE_REQUESTS,
  displayableSupplySnapshot,
  nextSearchOffset,
  pruneSearchUnitHistory,
  recordSearchUnit,
  reserveCapForDesiredSupply,
  SEARCH_CANDIDATES_RETAINED_PER_REQUEST,
  SEARCH_MAX_REQUESTS_PER_CYCLE,
  searchDisplayQuota,
  searchRequestBudget,
  searchSeedFamily,
  searchUnitKey,
  selectSearchSeedUnit,
  type SearchPageOffset,
  type SearchUnitHistoryEntry,
} from './core/searchAcquisitionV4';
import { bubbleSlotCount, sampleDomainSeed } from './core/bubbleBreakPolicy';
import type { ExposureHistoryState, ProfileState, RewardStatsState, ScoreBreakdown } from './core/types';
import { fetchProductSearch } from './sourceAdapter';
import { loadProductV1Settings } from './settings';
import { PRODUCT_V1_SCHEMA, PRODUCT_V1_VERSION } from './constants';
import { updateProductV1Health } from './store';
import type { ProductV1CandidateRecord, ProductV1RuntimeState, ProductV1Trace } from './types';
import { buildProductV1RecommendationReason } from './recommendationReason';
import { semanticExcerpt, semanticTitle } from './semanticInput';
import {
  capAutoDesiredSupply,
  composeBubbleDisplayRecords,
  promoteAutoSearchExploration,
  selectDiverseDisplayRecords,
} from './displayPolicy';
import {
  resetRecommendationBackendRuntime,
  resolveRecommendationBackend,
  scopedRecommendationCandidateNamespace,
  scopedRecommendationState,
  type RecommendationBackend,
} from '@/src/semantic-v2/recommendationBackend';
import { cosineRecommendationVector, scoreInterestGeometries } from '@/src/semantic-v2/recommendationGeometry';

type RuntimeMemory = ProductV1RuntimeState & {
  backend: RecommendationBackend;
  inventory: CandidateInventoryV3;
  records: Map<string, ProductV1CandidateRecord>;
  searchUnitHistory: SearchUnitHistoryEntry[];
};

let memoryPromise: Promise<RuntimeMemory> | null = null;
let runtimeQueue: Promise<unknown> = Promise.resolve();
let initializedBackendScope: string | null = null;

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function enqueue<T>(task: () => Promise<T>) {
  const run = runtimeQueue.then(task, task);
  runtimeQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function loadMemory(mode: 'live' | 'shadow', backend: RecommendationBackend): Promise<RuntimeMemory> {
  const state = (component: string) => scopedRecommendationState(backend.stateScope, component);
  const profile = await loadProductState<ProfileState>(state('profile')) ?? createProfileState();
  const rewardStats = await loadProductState<RewardStatsState>(state('rewardStats')) ?? createRewardStats();
  const exposureHistory = await loadProductState<ExposureHistoryState>(state('exposureHistory')) ?? createExposureHistory();
  const used = await loadProductState<string[]>(state('used')) ?? [];
  const searchUnitHistory = pruneSearchUnitHistory(
    await loadProductState<SearchUnitHistoryEntry[]>(state('searchUnitHistory')) ?? [],
  );
  let ratio = await loadProductState<RatioControllerStateV2>(state('ratio'));
  if (!ratio || ratio.version !== 2) ratio = createRatioControllerV2([], 'AUTO');
  const namespaces = [
    scopedRecommendationCandidateNamespace(backend.stateScope, mode, 'active'),
    scopedRecommendationCandidateNamespace(backend.stateScope, mode, 'reserve'),
  ];
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
  return { backend, profile, rewardStats, exposureHistory, ratio, used, inventory, records, searchUnitHistory };
}

function backendFromSettings(settings: Awaited<ReturnType<typeof loadProductV1Settings>>) {
  return resolveRecommendationBackend(settings.recommendationBackend, settings.native512GeometryMode);
}

async function initializeProductV1(selectedBackend?: RecommendationBackend) {
  const backend = selectedBackend ?? backendFromSettings(await loadProductV1Settings());
  const backendScope = `${backend.id}:${backend.stateScope}`;
  if (initializedBackendScope === backendScope) return;
  updateProductV1Health({
    phase: 'initializing',
    lastError: null,
    recommendationBackend: backend.id,
    embeddingDimension: backend.embeddingDimension,
  });
  try {
    const seedBank = await backend.loadSeedBank();
    await backend.loadSeedEmbeddings();
    const graph = await backend.loadTopicGraph();
    if (graph) await backend.loadTopicGraphEmbeddings();
    const norm = await backend.verify();
    initializedBackendScope = backendScope;
    updateProductV1Health({
      phase: 'ready',
      encoderReady: true,
      encoderNorm: norm,
      seedCount: seedBank.seedCount,
      recommendationBackend: backend.id,
      embeddingDimension: backend.embeddingDimension,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateProductV1Health({ phase: 'degraded', encoderReady: false, lastError: message });
    throw error;
  }
}

export function warmProductV1Runtime() {
  return enqueue(() => initializeProductV1());
}

export function resetProductV1Runtime() {
  initializedBackendScope = null;
  memoryPromise = null;
  resetRecommendationBackendRuntime();
  updateProductV1Health({ phase: 'idle', encoderReady: false, encoderNorm: null, lastError: null });
}

export function runProductV1Maintenance<T>(task: () => Promise<T>) {
  return enqueue(task);
}

function toCandidate(feed: FeedItemInfo, source: 'recommendation' | 'search', cycleId: string, rank: number): CandidateArticle {
  const articleId = `${feed.feedType}:${feed.item.id}`;
  const url = feed.feedType === 'article'
    ? `https://zhuanlan.zhihu.com/p/${feed.item.id}`
    : `https://www.zhihu.com/question/${feed.item.questionId}/answer/${feed.item.id}`;
  return {
    articleId,
    url,
    // 回答的语义输入必须包含问题上下文：标题取问题标题，
    // 摘要由问题描述（接口返回时）与回答正文拼接而成。
    title: semanticTitle(feed.feedType, feed.item),
    excerpt: semanticExcerpt(feed.feedType, feed.item),
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

type InterestGeometry = 'profile' | 'routing' | 'semantic' | 'assignment';

function interestVectors(memory: RuntimeMemory, geometry: InterestGeometry = 'profile') {
  const output: Record<string, Float32Array> = {};
  const weights: Record<string, number> = {};
  for (const center of memory.profile.centers) {
    for (const exemplar of center.exemplars) {
      const record = [...memory.records.values()].find((item) => item.candidate.articleId === exemplar.articleId);
      const embedding = record?.candidate.encoderEmbedding;
      if (!embedding || !record) continue;
      const scoringEmbedding = geometry === 'profile'
        ? memory.backend.profileEmbedding(embedding, record.candidate.source)
        : geometry === 'routing'
          ? memory.backend.routingCenterEmbedding(embedding, record.candidate.source)
          : geometry === 'semantic'
            ? memory.backend.semanticEmbedding(embedding, record.candidate.source)
            : memory.backend.assignmentEmbedding(embedding, record.candidate.source);
      for (const tag of center.tags) {
        output[tag] ??= new Float32Array(scoringEmbedding.length);
        weights[tag] = (weights[tag] ?? 0) + exemplar.weight;
        scoringEmbedding.forEach((value, index) => { output[tag][index] += value * exemplar.weight; });
      }
    }
  }
  for (const [tag, vector] of Object.entries(output)) {
    const weight = Math.max(weights[tag], 1e-12);
    vector.forEach((value, index) => { vector[index] = value / weight; });
  }
  return output;
}

async function enrichCandidate(
  candidate: CandidateArticle,
  memory: RuntimeMemory,
  targetInterest?: string,
  targetCenterOverride?: ArrayLike<number>,
) {
  await yieldToUI();
  const embedding = await memory.backend.encodeArticle(candidate);
  candidate.encoderEmbedding = Array.from(embedding);
  candidate.rawMetadata.demoGeometry = memory.backend.geometryVersion;
  candidate.rawMetadata.recommendationBackend = memory.backend.id;
  const semanticEmbedding = memory.backend.semanticEmbedding(embedding, candidate.source);
  const assignmentEmbedding = memory.backend.assignmentEmbedding(embedding, candidate.source);
  const semanticCenters = interestVectors(memory, 'semantic');
  const assignmentCenters = interestVectors(memory, 'assignment');
  const { semanticScores, assignmentMatches, bestSemanticScore } = scoreInterestGeometries(
    semanticEmbedding,
    assignmentEmbedding,
    semanticCenters,
    assignmentCenters,
  );

  // Product V1 / A preserve the established seed-domain fusion. Native512 follows the
  // final research contract: assignment geometry chooses the interest, while raw512
  // remains the relevance geometry. Seed routing is only a cold-start fallback for B.
  if (!targetInterest && (memory.backend.id !== 'native512' || assignmentMatches.length === 0)) {
    const bank = await memory.backend.loadSeedBank();
    const seedEmbeddings = await memory.backend.loadSeedEmbeddings();
    const routed = await routeSearchSeedsV2Async(memory.backend.candidateRoutingEmbedding(embedding), bank, seedEmbeddings, {
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
      semanticScores.set(domain, Math.max(semanticScores.get(domain) ?? -1, score));
      const existing = assignmentMatches.findIndex(([interest]) => interest === domain);
      if (existing >= 0) assignmentMatches[existing] = [domain, Math.max(assignmentMatches[existing][1], score)];
      else assignmentMatches.push([domain, score]);
    }
    assignmentMatches.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  const finalBestSemanticScore = semanticScores.size ? Math.max(...semanticScores.values()) : bestSemanticScore;
  candidate.matchedInterestIds = assignmentMatches.map(([interest]) => interest);
  candidate.matchedInterestScores = assignmentMatches.map(([interest]) => semanticScores.get(interest) ?? 0);
  candidate.bestMatchedInterest = assignmentMatches[0]?.[0] ?? null;
  candidate.bestSemanticScore = finalBestSemanticScore;
  candidate.rawMetadata.assignmentScore = assignmentMatches[0]?.[1] ?? 0;
  const targetCenter = targetInterest ? (semanticCenters[targetInterest] ?? targetCenterOverride) : undefined;
  const targetSemanticScore = targetInterest
    ? (semanticScores.get(targetInterest) ?? (targetCenter ? cosineRecommendationVector(semanticEmbedding, targetCenter) : 0))
    : candidate.bestSemanticScore;
  candidate.qualified = targetInterest ? targetSemanticScore >= 0.24 : candidate.bestSemanticScore >= 0.18;
  candidate.rejectionReason = candidate.qualified ? null : 'SEMANTIC_BELOW_THRESHOLD';
  if (targetInterest) {
    candidate.rawMetadata.targetInterest = targetInterest;
    candidate.rawMetadata.TARGET_INTEREST_SCORE = targetSemanticScore;
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

function activeSupplyCandidates(memory: RuntimeMemory, highQualityEnabled: boolean) {
  return [...memory.inventory.active.values()].filter((candidate) => (
    !memory.inventory.used.has(candidate.duplicateKey)
    && candidate.qualified
    && (!highQualityEnabled || highQualityEligibleV2(candidate))
  ));
}

function selectTargetSearchSeedUnit(
  seeds: Iterable<SearchSeedCompact>,
  targetInterest: string,
  history: SearchUnitHistoryEntry[],
  usedFamiliesThisCycle: ReadonlySet<string>,
) {
  const rows = [...seeds];
  const targetRows = rows.filter((seed) => seed.broadCategory === targetInterest);
  return selectSearchSeedUnit(targetRows, history, usedFamiliesThisCycle)
    ?? selectSearchSeedUnit(rows, history, usedFamiliesThisCycle);
}

async function routeSearchUnitForTarget(
  memory: RuntimeMemory,
  targetInterest: string,
  center: ArrayLike<number>,
  seedBank: Awaited<ReturnType<RecommendationBackend['loadSeedBank']>>,
  seedEmbeddings: Int8Array,
  topicGraph: Awaited<ReturnType<RecommendationBackend['loadTopicGraph']>>,
  topicGraphEmbeddings: Int8Array | null,
  usedFamiliesThisCycle: ReadonlySet<string>,
) {
  const seedById = new Map(seedBank.seeds.map((seed) => [seed.seedId, seed]));
  if (topicGraph && topicGraphEmbeddings) {
    const routedQueries = await routeTopicGraphV1Async(center, topicGraph, topicGraphEmbeddings, {
      hintDomains: [targetInterest],
      topKQueries: 60,
    });
    const routedSeeds = routedQueries
      .map((route) => route.seedId ? seedById.get(route.seedId) ?? null : null)
      .filter((seed): seed is SearchSeedCompact => Boolean(seed));
    const selected = selectTargetSearchSeedUnit(
      routedSeeds,
      targetInterest,
      memory.searchUnitHistory,
      usedFamiliesThisCycle,
    );
    if (selected) return { ...selected, routingArchitecture: 'HIERARCHICAL_TOPIC_GRAPH_V1' };
  }

  const routedSeeds = await routeSearchSeedsV2Async(center, seedBank, seedEmbeddings, {
    primaryDomains: [targetInterest],
    variant: ROUTING_DOMAIN_SOFT_GATE,
    topK: 60,
  });
  const selected = selectTargetSearchSeedUnit(
    routedSeeds.map((row) => row.seed),
    targetInterest,
    memory.searchUnitHistory,
    usedFamiliesThisCycle,
  );
  return selected ? { ...selected, routingArchitecture: 'SEED_ROUTER_V2' } : null;
}

async function fetchSearchUnit(
  memory: RuntimeMemory,
  targetInterest: string,
  center: ArrayLike<number>,
  seed: SearchSeedCompact,
  offset: SearchPageOffset,
  routingArchitecture: string,
  activeAcceptLimit: number,
  displayDeficit: number,
  trace: ProductV1Trace,
  highQualityEnabled: boolean,
) {
  if (trace.searchRequestCount > 0) {
    await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 300));
  }
  const feeds = await fetchProductSearch(seed.text, offset, highQualityEnabled);
  memory.searchUnitHistory = recordSearchUnit(memory.searchUnitHistory, seed.seedId, offset);
  trace.searchRequestCount += 1;
  trace.searchSeedIds.push(seed.seedId);
  trace.searchUnitKeys = [...(trace.searchUnitKeys ?? []), searchUnitKey(seed.seedId, offset)];

  const records = new Map<string, ProductV1CandidateRecord>();
  const candidates: CandidateArticle[] = [];
  for (const [index, feed] of feeds.entries()) {
    const candidate = toCandidate(feed, 'search', trace.cycleId, index);
    if (memory.inventory.used.has(candidate.duplicateKey) || memory.records.has(candidate.duplicateKey) || records.has(candidate.duplicateKey)) continue;
    candidate.sourceQuery = seed.text;
    candidate.searchSeedId = seed.seedId;
    candidate.queries = [seed.text];
    candidate.seedIds = [seed.seedId];
    candidate.rawMetadata.searchRouting = routingArchitecture;
    candidate.rawMetadata.searchOffset = offset;
    candidate.rawMetadata.searchUnitKey = searchUnitKey(seed.seedId, offset);
    await enrichCandidate(candidate, memory, targetInterest, center);
    const record = { candidate, feed };
    records.set(candidate.duplicateKey, record);
    candidates.push(candidate);
  }

  const eligibleCandidates = highQualityEnabled ? candidates.filter(highQualityEligibleV2) : candidates;
  const accepted = memory.inventory.acceptSearchBatchV4(
    eligibleCandidates,
    targetInterest,
    activeAcceptLimit,
    SEARCH_CANDIDATES_RETAINED_PER_REQUEST,
    'freshness_first',
    Date.now(),
    displayDeficit,
  );
  trace.reserveInserted += accepted.reserveInserted;
  for (const candidate of eligibleCandidates) {
    if (memory.inventory.active.has(candidate.duplicateKey) || memory.inventory.reserve.has(candidate.duplicateKey)) {
      const record = records.get(candidate.duplicateKey);
      if (record) memory.records.set(candidate.duplicateKey, record);
    }
  }
  return accepted;
}

async function acquireSearch(
  memory: RuntimeMemory,
  desiredSupply: Record<string, number>,
  trace: ProductV1Trace,
  highQualityEnabled: boolean,
  explicit: boolean,
) {
  const seedBank = await memory.backend.loadSeedBank();
  const seedEmbeddings = await memory.backend.loadSeedEmbeddings();
  const topicGraph = await memory.backend.loadTopicGraph();
  const topicGraphEmbeddings = topicGraph ? await memory.backend.loadTopicGraphEmbeddings() : null;
  const usedFamiliesThisCycle = new Set<string>();
  const requestsByInterest = new Map<string, number>();
  const exhaustedInterests = new Set<string>();
  const tolerance = explicit ? 0 : 1;

  for (const [interest, desired] of Object.entries(desiredSupply)) {
    memory.inventory.setReserveCap(interest, reserveCapForDesiredSupply(desired));
  }

  while (trace.searchRequestCount < SEARCH_MAX_REQUESTS_PER_CYCLE) {
    const snapshot = displayableSupplySnapshot(activeSupplyCandidates(memory, highQualityEnabled), desiredSupply, explicit);
    const deficits = computeCandidateDeficits(desiredSupply, snapshot.counts, tolerance)
      .filter((deficit) => deficit.deficit > 0 && !exhaustedInterests.has(deficit.interestId))
      .sort((a, b) => b.normalizedDeficit - a.normalizedDeficit || b.deficit - a.deficit);
    const target = deficits[0];
    if (!target) break;

    const quota = searchDisplayQuota(target.deficit, explicit);
    const moved = memory.inventory.activateReserveDisplaySlots(target.interestId, target.deficit, quota);
    trace.reserveActivated += moved;
    if (moved > 0) continue;

    const perInterestBudget = searchRequestBudget(target.deficit, quota);
    const alreadyRequested = requestsByInterest.get(target.interestId) ?? 0;
    if (alreadyRequested >= perInterestBudget) {
      exhaustedInterests.add(target.interestId);
      continue;
    }

    const center = interestVectors(memory, 'routing')[target.interestId]
      ?? (topicGraph && topicGraphEmbeddings
        ? topicGraphBroadDomainVector(topicGraph, topicGraphEmbeddings, target.interestId)
        : null);
    if (!center) {
      exhaustedInterests.add(target.interestId);
      continue;
    }

    const selected = await routeSearchUnitForTarget(
      memory,
      target.interestId,
      center,
      seedBank,
      seedEmbeddings,
      topicGraph,
      topicGraphEmbeddings,
      usedFamiliesThisCycle,
    );
    if (!selected) {
      exhaustedInterests.add(target.interestId);
      continue;
    }

    usedFamiliesThisCycle.add(searchSeedFamily(selected.seed));
    requestsByInterest.set(target.interestId, alreadyRequested + 1);
    const activeAcceptLimit = Math.min(target.deficit, quota);
    await fetchSearchUnit(
      memory,
      target.interestId,
      center,
      selected.seed,
      selected.offset,
      selected.routingArchitecture,
      activeAcceptLimit,
      target.deficit,
      trace,
      highQualityEnabled,
    );
  }

  // AUTO keeps Search as a small, quality-guarded source of incremental content
  // even when Recommendation inventory already satisfies the interest ratios.
  if (!explicit && trace.searchRequestCount === 0 && AUTO_SEARCH_MAX_PROACTIVE_REQUESTS > 0) {
    let snapshot = displayableSupplySnapshot(activeSupplyCandidates(memory, highQualityEnabled), desiredSupply, false);
    let missingSearchSlots = Math.max(0, AUTO_SEARCH_EXPLORATION_TARGET - snapshot.totalDisplayableSearch);
    if (missingSearchSlots > 0) {
      const interests = Object.entries(desiredSupply)
        .filter(([, desired]) => desired > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      for (const [interest] of interests) {
        if (missingSearchSlots <= 0) break;
        const quota = searchDisplayQuota(0, false);
        const moved = memory.inventory.activateReserveDisplaySlots(interest, missingSearchSlots, quota);
        trace.reserveActivated += moved;
        if (moved > 0) {
          snapshot = displayableSupplySnapshot(activeSupplyCandidates(memory, highQualityEnabled), desiredSupply, false);
          missingSearchSlots = Math.max(0, AUTO_SEARCH_EXPLORATION_TARGET - snapshot.totalDisplayableSearch);
        }
      }
    }

    if (missingSearchSlots > 0) {
      const interestSearchCounts = snapshot.searchCounts;
      const target = Object.entries(desiredSupply)
        .filter(([, desired]) => desired > 0)
        .sort((a, b) => {
          const aCoverage = (interestSearchCounts[a[0]] ?? 0) / Math.max(1, a[1]);
          const bCoverage = (interestSearchCounts[b[0]] ?? 0) / Math.max(1, b[1]);
          return aCoverage - bCoverage || b[1] - a[1] || a[0].localeCompare(b[0]);
        })[0];
      if (target) {
        const [targetInterest] = target;
        const center = interestVectors(memory, 'routing')[targetInterest]
          ?? (topicGraph && topicGraphEmbeddings
            ? topicGraphBroadDomainVector(topicGraph, topicGraphEmbeddings, targetInterest)
            : null);
        if (center) {
          const selected = await routeSearchUnitForTarget(
            memory,
            targetInterest,
            center,
            seedBank,
            seedEmbeddings,
            topicGraph,
            topicGraphEmbeddings,
            usedFamiliesThisCycle,
          );
          if (selected) {
            usedFamiliesThisCycle.add(searchSeedFamily(selected.seed));
            const quota = searchDisplayQuota(0, false);
            await fetchSearchUnit(
              memory,
              targetInterest,
              center,
              selected.seed,
              selected.offset,
              selected.routingArchitecture,
              Math.min(missingSearchSlots, quota),
              missingSearchSlots,
              trace,
              highQualityEnabled,
            );
            trace.autoSearchProactiveRequestCount = (trace.autoSearchProactiveRequestCount ?? 0) + 1;
          }
        }
      }
    }
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
  const seedBank = await memory.backend.loadSeedBank();
  const topicGraph = await memory.backend.loadTopicGraph();
  const topicGraphEmbeddings = topicGraph ? await memory.backend.loadTopicGraphEmbeddings() : null;
  const profileDomains = new Set(topNamedInterests(memory.profile, 9).map(([interest]) => interest));
  const available = seedBank.seeds
    .filter((seed) => seed.enabled
      && Boolean(seed.broadCategory)
      && !profileDomains.has(seed.broadCategory!)
      && nextSearchOffset(seed.seedId, memory.searchUnitHistory) != null)
    .map((seed) => ({ ...seed, broadDomain: seed.broadCategory! }));
  const sampled = sampleDomainSeed(available, trace.cycleId, 0);
  const selected = sampled ? seedBank.seeds.find((seed) => seed.seedId === sampled.seedId) : null;
  const offset = selected ? nextSearchOffset(selected.seedId, memory.searchUnitHistory) : null;
  if (!selected?.broadCategory || offset == null) return [];

  if (trace.searchRequestCount > 0) await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 300));
  const feeds = await fetchProductSearch(selected.text, offset, highQualityEnabled);
  memory.searchUnitHistory = recordSearchUnit(memory.searchUnitHistory, selected.seedId, offset);
  trace.searchRequestCount += 1;
  trace.bubbleSearchRequestCount = (trace.bubbleSearchRequestCount ?? 0) + 1;
  trace.bubbleSeedIds = [...(trace.bubbleSeedIds ?? []), selected.seedId];
  trace.searchUnitKeys = [...(trace.searchUnitKeys ?? []), searchUnitKey(selected.seedId, offset)];

  const records: ProductV1CandidateRecord[] = [];
  for (const [index, feed] of feeds.entries()) {
    const candidate = toCandidate(feed, 'search', trace.cycleId, index);
    if (memory.inventory.used.has(candidate.duplicateKey) || memory.records.has(candidate.duplicateKey)) continue;
    candidate.sourceQuery = selected.text;
    candidate.searchSeedId = selected.seedId;
    candidate.queries = [selected.text];
    candidate.seedIds = [selected.seedId];
    candidate.rawMetadata.searchOffset = offset;
    candidate.rawMetadata.searchUnitKey = searchUnitKey(selected.seedId, offset);
    candidate.rawMetadata.sourcePolicy = 'bubble_break';
    candidate.rawMetadata.wasSerendipity = true;
    candidate.rawMetadata.bubbleDomain = selected.broadCategory;
    const bubbleCenter = topicGraph && topicGraphEmbeddings
      ? topicGraphBroadDomainVector(topicGraph, topicGraphEmbeddings, selected.broadCategory)
      : null;
    await enrichCandidate(candidate, memory, selected.broadCategory, bubbleCenter ?? undefined);
    const domainScore = Number(candidate.rawMetadata.TARGET_INTEREST_SCORE ?? 0);
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

function profileExemplarRecords(memory: RuntimeMemory) {
  const exemplarArticleIds = new Set(memory.profile.centers.flatMap((center) => center.exemplars.map((exemplar) => exemplar.articleId)));
  if (!exemplarArticleIds.size) return [];
  return [...memory.records.values()].filter((record) => exemplarArticleIds.has(record.candidate.articleId));
}

function mergePersistenceRecords(...groups: ProductV1CandidateRecord[][]) {
  const byDuplicateKey = new Map<string, ProductV1CandidateRecord>();
  for (const group of groups) {
    for (const record of group) byDuplicateKey.set(record.candidate.duplicateKey, record);
  }
  return [...byDuplicateKey.values()];
}

async function runCycle(items: FeedItemInfo[]) {
  const settings = await loadProductV1Settings();
  if (!settings.enabled) return items;
  const backend = backendFromSettings(settings);
  await initializeProductV1(backend);
  const cycleId = id(`cycle-${backend.id}`);
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
    recommendationBackend: backend.id,
    native512GeometryMode: settings.native512GeometryMode,
    embeddingDimension: backend.embeddingDimension,
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
  updateProductV1Health({
    phase: 'running',
    lastCycleId: cycleId,
    recommendationBackend: backend.id,
    embeddingDimension: backend.embeddingDimension,
  });
  const memory = await loadMemory(settings.mode, backend);
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
    const explicit = memory.ratio.mode === 'EXPLICIT';
    await acquireSearch(memory, desired, trace, settings.highQualityEnabled, explicit);
    const bubbleRecords = await acquireBubble(memory, trace, settings.bubbleBreakEnabled, settings.highQualityEnabled);
    const supplySnapshot = displayableSupplySnapshot(
      activeSupplyCandidates(memory, settings.highQualityEnabled),
      desired,
      explicit,
    );
    trace.rawActiveSupply = memory.inventory.activeCounts();
    trace.displayableSupply = supplySnapshot.counts;
    trace.searchDisplayQuota = supplySnapshot.searchQuotaByInterest;
    trace.deficits = Object.fromEntries(computeCandidateDeficits(
      desired,
      supplySnapshot.counts,
      explicit ? 0 : 1,
    ).map((row) => [row.interestId, row.deficit]));
    const ranked = rankActive(memory);
    const qualityEligible = settings.highQualityEnabled
      ? ranked.records.filter((record) => highQualityEligibleV2(record.candidate))
      : ranked.records;
    const diverseOrder = selectDiverseDisplayRecords(qualityEligible, {
      searchQuotaByInterest: supplySnapshot.searchQuotaByInterest,
    }).slice(0, 80);
    const knownOrder = explicit
      ? diverseOrder
      : promoteAutoSearchExploration(
          diverseOrder,
          ranked.scores,
          AUTO_SEARCH_EXPLORATION_TARGET,
          20,
        ).slice(0, 80);
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
    trace.searchDisplayedCount = knownHorizon.filter((record) => record.candidate.source === 'search').length;
    trace.searchDisplayedShare = trace.searchDisplayedCount / Math.max(1, knownHorizon.length);
    trace.ratioAchieved = Object.fromEntries(Object.entries(achieved).map(([key, count]) => [key, count / Math.max(1, knownHorizon.length)]));
    trace.activeCount = memory.inventory.active.size;
    trace.reserveCount = memory.inventory.reserve.size;
    trace.status = 'complete';
    trace.completedAt = Date.now();
    if (settings.mode === 'shadow') trace.shadowOrder = liveOrder.map((record) => record.candidate.articleId);
    else trace.displayedOrder = liveOrder.map((record) => record.candidate.articleId);
    await commitProductCycle({
      trace,
      // Keep profile exemplars persisted even after they are marked used. loadMemory()
      // restores their records/embeddings but the `used` set prevents them from
      // re-entering the active feed. This keeps 512D profile centers reconstructible
      // across cycles and app restarts without resurfacing consumed content.
      active: mergePersistenceRecords(
        recordsFor(memory, memory.inventory.active),
        profileExemplarRecords(memory),
      ),
      reserve: recordsFor(memory, memory.inventory.reserve),
      states: [
        { component: scopedRecommendationState(backend.stateScope, 'profile'), schemaVersion: PRODUCT_V1_SCHEMA.profile, payload: memory.profile },
        { component: scopedRecommendationState(backend.stateScope, 'rewardStats'), schemaVersion: PRODUCT_V1_SCHEMA.rewardStats, payload: memory.rewardStats },
        { component: scopedRecommendationState(backend.stateScope, 'exposureHistory'), schemaVersion: PRODUCT_V1_SCHEMA.exposureHistory, payload: memory.exposureHistory },
        { component: scopedRecommendationState(backend.stateScope, 'ratio'), schemaVersion: 2, payload: memory.ratio },
        { component: scopedRecommendationState(backend.stateScope, 'used'), schemaVersion: 1, payload: [...memory.inventory.used] },
        { component: scopedRecommendationState(backend.stateScope, 'searchUnitHistory'), schemaVersion: 1, payload: pruneSearchUnitHistory(memory.searchUnitHistory) },
      ],
      activeNamespace: scopedRecommendationCandidateNamespace(backend.stateScope, settings.mode, 'active'),
      reserveNamespace: scopedRecommendationCandidateNamespace(backend.stateScope, settings.mode, 'reserve'),
    });
    updateProductV1Health({
      phase: 'ready', activeCount: trace.activeCount, reserveCount: trace.reserveCount,
      lastCycleId: cycleId, lastCycleAt: trace.completedAt, lastError: null,
      recommendationBackend: backend.id, embeddingDimension: backend.embeddingDimension,
    });
    if (settings.mode === 'shadow') return items;
    return liveOrder.map((record) => {
      const interest = supplyInterestV3(record.candidate);
      const recommendationReason = buildProductV1RecommendationReason(record.candidate, {
        profileAffinity: interest ? memory.profile.namedScores[interest] ?? 0 : 0,
      });
      return recommendationReason
        ? { ...record.feed, item: { ...record.feed.item, recommendationReason } }
        : record.feed;
    });
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

export async function ensureProductV1Memory() {
  if (!memoryPromise) {
    const settings = await loadProductV1Settings();
    const backend = backendFromSettings(settings);
    memoryPromise = loadMemory('live', backend);
  }
  return memoryPromise;
}

export const PRODUCT_RUNTIME_VERSION = PRODUCT_V1_VERSION;
