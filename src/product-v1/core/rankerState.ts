import type { CandidateFeatures, RankerState, RankerUpdateAudit, RewardSignal } from "./types";

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export const RANKER_DEFAULTS = {
  semanticWeight: 0.22,
  profileWeight: 0.18,
  rewardHistoryWeight: 0.12,
  freshnessWeight: 0.06,
  noveltyWeight: 0.10,
  explorationWeight: 0.06,
  diversityWeight: 0.08,
  repetitionPenalty: 0.18,
  suppressionPenalty: 0.42,
} as const;

const BOUNDS: Record<keyof typeof RANKER_DEFAULTS, readonly [number, number]> = {
  semanticWeight: [0.10, 0.34], profileWeight: [0.08, 0.30], rewardHistoryWeight: [0.04, 0.24],
  freshnessWeight: [0.00, 0.14], noveltyWeight: [0.02, 0.20], explorationWeight: [0.00, 0.15],
  diversityWeight: [0.02, 0.16], repetitionPenalty: [0.08, 0.32], suppressionPenalty: [0.25, 0.65],
};

export function createDefaultRankerState(): RankerState {
  return { version: 1, ...RANKER_DEFAULTS, rewardBaseline: 0, updateCount: 0 };
}

export function cloneRankerState(s: RankerState): RankerState { return { ...s }; }

/** @deprecated Research-control baseline only. Product V1 uses scoreFrozenCandidate and never calls this updater. */
export function updateRankerState(state: RankerState, f: CandidateFeatures, signal: RewardSignal): RankerUpdateAudit {
  const before = cloneRankerState(state);
  const effectiveReward = clamp(signal.reward * signal.confidence, -1, 1);
  const centered = clamp(effectiveReward - state.rewardBaseline, -0.75, 0.75);
  state.rewardBaseline = 0.97 * state.rewardBaseline + 0.03 * effectiveReward;
  const lr = 0.018 * signal.confidence;
  const drives: Record<keyof typeof RANKER_DEFAULTS, number> = {
    semanticWeight: centered * (clamp(f.semantic, 0, 1) - 0.5),
    profileWeight: centered * (clamp(f.profileAffinity, 0, 1) - 0.5),
    rewardHistoryWeight: centered * Math.abs(clamp(f.rewardHistory, -1, 1)),
    freshnessWeight: centered * (clamp(f.freshness, 0, 1) - 0.5),
    noveltyWeight: centered * (clamp(f.novelty, 0, 1) - 0.5),
    explorationWeight: centered * clamp(f.exploration, 0, 1),
    diversityWeight: centered * (clamp(f.diversity, 0, 1) - 0.5),
    repetitionPenalty: -centered * clamp(f.repetition, 0, 1),
    suppressionPenalty: -centered * clamp(f.suppression, 0, 1),
  };
  const delta: Partial<RankerState> = {};
  for (const name of Object.keys(RANKER_DEFAULTS) as (keyof typeof RANKER_DEFAULTS)[]) {
    const current = state[name]; const [lo, hi] = BOUNDS[name];
    const updated = clamp(current + lr * drives[name] + 0.004 * (RANKER_DEFAULTS[name] - current), lo, hi);
    (state[name] as number) = updated; (delta[name] as number) = updated - current;
  }
  state.updateCount += 1;
  return { before, delta, after: cloneRankerState(state), effectiveReward };
}
