import type { FeedItemInfo, FeedType } from '@/src/types/zhihu';
import type { CandidateArticle } from './core/candidateAcquisition';
import type { ExposureHistoryState, ProfileState, RewardStatsState } from './core/types';
import type { RatioControllerStateV2 } from './core/explicitInterestRatioV2';

export type ProductV1Mode = 'live' | 'shadow';

export type ProductV1Settings = {
  schemaVersion: 1;
  productVersion: string;
  updatedAt: number;
  enabled: boolean;
  mode: ProductV1Mode;
  highQualityEnabled: boolean;
  bubbleBreakEnabled: boolean;
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
  bubbleBreakEnabled?: boolean;
  bubbleSearchRequestCount?: number;
  bubbleSeedIds?: string[];
  bubbleDisplayedCount?: number;
  reserveActivated: number;
  reserveInserted: number;
  desiredSupply: Record<string, number>;
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
  seedCount: number;
  activeCount: number;
  reserveCount: number;
  lastCycleId: string | null;
  lastCycleAt: number | null;
  lastError: string | null;
};
