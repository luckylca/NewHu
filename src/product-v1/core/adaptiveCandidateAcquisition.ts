import {
  DEFAULT_CANDIDATE_DEFICIT_CONFIG,
  prioritizeDeficits,
  type CandidateDeficitConfig,
  type InterestDeficit,
} from "./candidateDeficit";

export type AcquisitionAction = "NONE" | "RECOMMENDATION_REFRESH" | "SEARCH_INTEREST";
export type SearchStopReason =
  | "NO_DEFICIT"
  | "DEFICIT_RESOLVED"
  | "LOW_MARGINAL_YIELD"
  | "REQUEST_BUDGET_EXHAUSTED"
  | "SEED_EXHAUSTED"
  | "QUALITY_TOO_LOW"
  | "FRESHNESS_TOO_LOW"
  | "RATE_LIMITED"
  | "API_FAILURE";

export interface SearchProgress {
  sessionRequests: number;
  cycleRequests: number;
  perInterestRequests: Record<string, number>;
  marginalUniqueQualified: Record<string, number[]>;
}

export function createSearchProgress(): SearchProgress {
  return { sessionRequests: 0, cycleRequests: 0, perInterestRequests: {}, marginalUniqueQualified: {} };
}

export function recordSearchProgress(progress: SearchProgress, interestId: string, uniqueQualifiedGain: number): SearchProgress {
  return {
    sessionRequests: progress.sessionRequests + 1,
    cycleRequests: progress.cycleRequests + 1,
    perInterestRequests: { ...progress.perInterestRequests, [interestId]: (progress.perInterestRequests[interestId] ?? 0) + 1 },
    marginalUniqueQualified: {
      ...progress.marginalUniqueQualified,
      [interestId]: [...(progress.marginalUniqueQualified[interestId] ?? []), Math.max(0, Math.trunc(uniqueQualifiedGain))],
    },
  };
}

export function evaluateSearchStop(
  interest: InterestDeficit,
  progress: SearchProgress,
  config: CandidateDeficitConfig = DEFAULT_CANDIDATE_DEFICIT_CONFIG,
  state: { seedsRemaining?: boolean; qualityOk?: boolean; freshnessOk?: boolean; rateLimited?: boolean; apiFailed?: boolean } = {},
): SearchStopReason | null {
  if (state.apiFailed) return "API_FAILURE";
  if (state.rateLimited) return "RATE_LIMITED";
  if (interest.deficit <= 0) return "DEFICIT_RESOLVED";
  if (progress.sessionRequests >= config.perSessionSearchRequests || progress.cycleRequests >= config.perCycleSearchRequests) return "REQUEST_BUDGET_EXHAUSTED";
  if ((progress.perInterestRequests[interest.interestId] ?? 0) >= config.perInterestSearchRequests) return "REQUEST_BUDGET_EXHAUSTED";
  if (state.seedsRemaining === false) return "SEED_EXHAUSTED";
  if (state.qualityOk === false) return "QUALITY_TOO_LOW";
  if (state.freshnessOk === false) return "FRESHNESS_TOO_LOW";
  const history = progress.marginalUniqueQualified[interest.interestId] ?? [];
  if (history.length >= config.lowYieldStreakToStop) {
    const recent = history.slice(-config.lowYieldStreakToStop);
    if (recent.every((v) => v < config.minMarginalUniqueQualified)) return "LOW_MARGINAL_YIELD";
  }
  return null;
}

export function decideAcquisitionAction(
  deficits: InterestDeficit[],
  progress: SearchProgress,
  options: {
    config?: CandidateDeficitConfig;
    recommendationRefreshes?: number;
    allowRecommendationRefresh?: boolean;
    expectedSearchYield?: Record<string, number>;
  } = {},
): { action: AcquisitionAction; interestId: string | null; stopReason: SearchStopReason | null } {
  const config = options.config ?? DEFAULT_CANDIDATE_DEFICIT_CONFIG;
  const active = deficits.filter((d) => d.deficit > 0);
  if (active.length === 0) return { action: "NONE", interestId: null, stopReason: "NO_DEFICIT" };
  if (options.allowRecommendationRefresh && (options.recommendationRefreshes ?? 0) < config.recommendationRefreshLimit) {
    return { action: "RECOMMENDATION_REFRESH", interestId: null, stopReason: null };
  }
  const ranked = prioritizeDeficits(active, options.expectedSearchYield ?? {});
  if (ranked.length === 0) return { action: "NONE", interestId: null, stopReason: "NO_DEFICIT" };
  const target = ranked[0].deficit;
  const stopReason = evaluateSearchStop(target, progress, config);
  if (stopReason) return { action: "NONE", interestId: target.interestId, stopReason };
  return { action: "SEARCH_INTEREST", interestId: target.interestId, stopReason: null };
}
