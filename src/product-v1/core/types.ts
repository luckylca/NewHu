export interface BehaviorEvent {
  impression: boolean;
  opened: boolean;
  dwellMs: number;
  estimatedReadingMs: number;
  scrollRatio: number;
  liked: boolean;
  favorited: boolean;
  hidden: boolean;
  skipped: boolean;
  explicitNotInterested: boolean;
}

export interface RewardSignal {
  reward: number;
  confidence: number;
  dwellRatio: number;
  completionRatio: number;
  components: Record<string, number>;
}

export interface CandidateFeatures {
  articleId: string;
  matchedInterestId: string | null;
  retrievalScore: number;
  semantic: number;
  profileAffinity: number;
  rewardHistory: number;
  freshness: number;
  novelty: number;
  exploration: number;
  diversity: number;
  repetition: number;
  suppression: number;
  interestRatioDeficit: number;
}

export interface ScoreBreakdown {
  articleId: string;
  finalScore: number;
  matchedInterestId: string | null;
  retrievalScore: number;
  semanticContribution: number;
  profileContribution: number;
  interestRatioContribution: number;
  rewardHistoryContribution: number;
  freshnessContribution: number;
  noveltyContribution: number;
  explorationContribution: number;
  diversityContribution: number;
  repetitionPenalty: number;
  suppressionPenalty: number;
  contributionClasses?: Record<string, string>;
}

export interface RankerState {
  version: 1;
  semanticWeight: number;
  profileWeight: number;
  rewardHistoryWeight: number;
  freshnessWeight: number;
  noveltyWeight: number;
  explorationWeight: number;
  diversityWeight: number;
  repetitionPenalty: number;
  suppressionPenalty: number;
  rewardBaseline: number;
  updateCount: number;
}

export interface RankerUpdateAudit {
  before: RankerState;
  delta: Partial<RankerState>;
  after: RankerState;
  effectiveReward: number;
}

export interface InterestRatioEntry {
  interestId: string;
  targetRatio: number;
  locked: boolean;
}

export interface ExplicitInterestRatioState {
  entries: InterestRatioEntry[];
  explicitOverride: boolean;
  maxLength: 9;
}

export interface ProfileExemplar {
  articleId: string;
  weight: number;
}

export interface InterestCenterState {
  centerId: string;
  exemplars: ProfileExemplar[];
  tags: string[];
  weight: number;
  confidence: number;
  lastActiveStep: number;
  positiveCount: number;
  negativeCount: number;
}

export interface ProfileState {
  version: 1;
  centers: InterestCenterState[];
  namedScores: Record<string, number>;
  namedConfidence: Record<string, number>;
  maxCenters: number;
  maxExemplars: number;
}

export interface RewardHistoryState {
  emaReward: number;
  emaConfidence: number;
  exposures: number;
  positives: number;
  negatives: number;
}

export interface RewardStatsState {
  version: 1;
  byInterest: Record<string, RewardHistoryState>;
}

export interface ExposureHistoryState {
  version: 1;
  byInterest: Record<string, number>;
  recentArticleIds: string[];
  recentInterestIds: string[];
  maxRecent: number;
}


export interface StyleParameterState {
  learnedDelta: number;
  confidence: number;
  evidenceCount: number;
  evidenceMean: number;
}

export interface ConservativeRankerState {
  version: 2;
  noveltyPreference: StyleParameterState;
  freshnessPreference: StyleParameterState;
  repetitionSensitivity: StyleParameterState;
  updateCount: number;
}

export interface StyleObservation {
  matchedInterestId: string | null;
  relevance: number;
  outcome: number;
  novelty: number;
  freshness: number;
  repetition: number;
}

export interface StyleDimensionEvidenceAudit {
  pairCount: number;
  meanEffect: number;
  updated: boolean;
  evidenceCount?: number;
  evidenceMean?: number;
  confidence?: number;
  learnedDelta?: number;
  effectiveMultiplier?: number;
}

export interface ConservativeStyleUpdateAudit {
  before: ConservativeRankerState;
  dimensions: Record<string, StyleDimensionEvidenceAudit>;
  after: ConservativeRankerState;
  updated: boolean;
}
