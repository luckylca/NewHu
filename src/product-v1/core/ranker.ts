import type { CandidateFeatures, RankerState, ScoreBreakdown } from "./types";
import { explorationPolicyContribution } from "./explorationPolicy";
import { RANKER_DEFAULTS } from "./rankerState";
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export function scoreCandidate(f: CandidateFeatures, s: RankerState, ratioBonus = 0): ScoreBreakdown {
  const semanticContribution = s.semanticWeight * clamp(f.semantic, 0, 1);
  const profileContribution = s.profileWeight * clamp(f.profileAffinity, 0, 1);
  const rewardHistoryContribution = s.rewardHistoryWeight * clamp(f.rewardHistory, -1, 1);
  const freshnessContribution = s.freshnessWeight * clamp(f.freshness, 0, 1);
  const noveltyContribution = s.noveltyWeight * clamp(f.novelty, 0, 1);
  const explorationContribution = s.explorationWeight * clamp(f.exploration, 0, 1);
  const diversityContribution = s.diversityWeight * clamp(f.diversity, 0, 1);
  const repetitionPenalty = s.repetitionPenalty * clamp(f.repetition, 0, 1);
  const suppressionPenalty = s.suppressionPenalty * clamp(f.suppression, 0, 1);
  const interestRatioContribution = clamp(ratioBonus, -0.20, 0.20);
  const finalScore = semanticContribution + profileContribution + rewardHistoryContribution + freshnessContribution + noveltyContribution + explorationContribution + diversityContribution + interestRatioContribution - repetitionPenalty - suppressionPenalty;
  return { articleId: f.articleId, finalScore, matchedInterestId: f.matchedInterestId, retrievalScore: f.retrievalScore, semanticContribution, profileContribution, interestRatioContribution, rewardHistoryContribution, freshnessContribution, noveltyContribution, explorationContribution, diversityContribution, repetitionPenalty, suppressionPenalty };
}


export function queryPercentile(values: number[]): number[] {
  if (values.length <= 1) return values.map(() => 1);
  const order = values.map((value, index) => ({ value, index })).sort((a,b) => a.value-b.value || a.index-b.index);
  const out = new Array<number>(values.length); order.forEach((x, rank) => { out[x.index] = rank / (values.length - 1); }); return out;
}


/**
 * Final product V1 ranker. No per-user RankerState is accepted.
 * Exploration is supplied by a separate policy module; diversity/repetition
 * remain fixed list-organization terms.
 */
export function scoreFrozenCandidate(f: CandidateFeatures, ratioBonus = 0): ScoreBreakdown {
  const semanticContribution = RANKER_DEFAULTS.semanticWeight * clamp(f.semantic, 0, 1);
  const profileContribution = RANKER_DEFAULTS.profileWeight * clamp(f.profileAffinity, 0, 1);
  const rewardHistoryContribution = RANKER_DEFAULTS.rewardHistoryWeight * clamp(f.rewardHistory, -1, 1);
  const freshnessContribution = RANKER_DEFAULTS.freshnessWeight * clamp(f.freshness, 0, 1);
  const noveltyContribution = RANKER_DEFAULTS.noveltyWeight * clamp(f.novelty, 0, 1);
  const explorationContribution = explorationPolicyContribution(f);
  const diversityContribution = RANKER_DEFAULTS.diversityWeight * clamp(f.diversity, 0, 1);
  const repetitionPenalty = RANKER_DEFAULTS.repetitionPenalty * clamp(f.repetition, 0, 1);
  const suppressionPenalty = RANKER_DEFAULTS.suppressionPenalty * clamp(f.suppression, 0, 1);
  const interestRatioContribution = clamp(ratioBonus, -0.20, 0.20);
  const finalScore = semanticContribution + profileContribution + rewardHistoryContribution + freshnessContribution + noveltyContribution + explorationContribution + diversityContribution + interestRatioContribution - repetitionPenalty - suppressionPenalty;
  return {
    articleId: f.articleId,
    finalScore,
    matchedInterestId: f.matchedInterestId,
    retrievalScore: f.retrievalScore,
    semanticContribution,
    profileContribution,
    interestRatioContribution,
    rewardHistoryContribution,
    freshnessContribution,
    noveltyContribution,
    explorationContribution,
    diversityContribution,
    repetitionPenalty,
    suppressionPenalty,
    contributionClasses: {
      semanticContribution: "USER_PROFILE",
      profileContribution: "USER_PROFILE",
      rewardHistoryContribution: "HISTORY",
      freshnessContribution: "SYSTEM_POLICY",
      noveltyContribution: "SYSTEM_POLICY",
      explorationContribution: "SEPARATE_EXPLORATION_POLICY",
      diversityContribution: "SYSTEM_POLICY_RE_RANK",
      repetitionPenalty: "SYSTEM_POLICY_RE_RANK",
      suppressionPenalty: "USER_PROFILE",
      interestRatioContribution: "EXPLICIT",
    },
  };
}
