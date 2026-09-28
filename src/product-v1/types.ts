import type { FeedItemInfo, FeedType } from '@/src/types/zhihu';
import type { CandidateArticle } from './core/candidateAcquisition';
import type { ExposureHistoryState, ProfileState, RewardStatsState } from './core/types';
import type { RatioControllerStateV2 } from './core/explicitInterestRatioV2';
import type { Native512GeometryMode, RecommendationBackendId } from '@/src/semantic-v2/recommendationBackend';

export type ProductV1Mode = 'live' | 'shadow';
export type RecommendationSourceMode = 'web' | 'android' | 'mixed';

export type ProductV1Settings = {
  schemaVersion: 1;
  productVersion: string;
  updatedAt: number;
  enabled: boolean;
  mode: ProductV1Mode;
  highQualityEnabled: boolean;
  bubbleBreakEnabled: boolean;
  recommendationSourceMode: RecommendationSourceMode;
  recommendationBackend: RecommendationBackendId;
  native512GeometryMode: Native512GeometryMode;
};

export type ProductV1RuntimeState = {
  profile: ProfileState;
  rewardStats: RewardStatsState;
  exposureHistory: ExposureHistoryState;
  ratio: RatioControllerStateV2;
  used: string[];
};

export type ProductV1CandidateRecord = {
  candidate: CandidateArticle;
  feed: FeedItemInfo;
};

export type ProductV1Trace = {
  cycleId: string;
  mode: ProductV1Mode;
  status: 'running' | 'complete' | 'aborted' | 'degraded';
  startedAt: number;
  completedAt?: number;
  recommendationCount: number;
  searchRequestCount: number;
  searchSeedIds: string[];
  searchUnitKeys?: string[];
  searchDisplayedCount?: number;
  searchDisplayedShare?: number;
  candidateSourceCounts?: Record<string, number>;
  sourceScoreDistribution?: Record<string, { count: number; mean: number; min: number; max: number }>;
  selectedSourceCounts?: Record<string, number>;
  sourceDedupCount?: number;
  autoSearchProactiveRequestCount?: number;
  bubbleBreakEnabled?: boolean;
  bubbleSearchRequestCount?: number;
  bubbleSeedIds?: string[];
  bubbleDisplayedCount?: number;
  recommendationBackend?: RecommendationBackendId;
  native512GeometryMode?: Native512GeometryMode;
  embeddingDimension?: number;
  reserveActivated: number;
  reserveInserted: number;
  desiredSupply: Record<string, number>;
  rawActiveSupply?: Record<string, number>;
  displayableSupply?: Record<string, number>;
  searchDisplayQuota?: Record<string, number>;
  deficits: Record<string, number>;
  activeCount: number;
  reserveCount: number;
  displayedOrder: string[];
  shadowOrder?: string[];
  ratioTarget: Record<string, number>;
  ratioAchieved: Record<string, number>;
  error?: string;
};

export type ProductV1FeedbackInput = {
  contentId: string;
  contentType: FeedType;
  opened?: boolean;
  dwellMs?: number;
  estimatedReadingMs?: number;
  scrollRatio?: number;
  liked?: boolean;
  favorited?: boolean;
  hidden?: boolean;
  skipped?: boolean;
  explicitNotInterested?: boolean;
  eventType: string;
};

export type ProductV1Health = {
  phase: 'idle' | 'initializing' | 'ready' | 'degraded' | 'running';
  encoderReady: boolean;
  encoderNorm: number | null;
  recommendationBackend: RecommendationBackendId;
  embeddingDimension: number;
  seedCount: number;
  activeCount: number;
  reserveCount: number;
  lastCycleId: string | null;
  lastCycleAt: number | null;
  lastError: string | null;
};
