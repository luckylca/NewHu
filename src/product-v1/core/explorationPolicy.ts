import type { CandidateFeatures } from "./types";

// Separate fixed exploration policy. Acceptance/exposure statistics are stored
// independently; ordinary reward never mutates this coefficient.
export const EXPLORATION_POLICY_V1_BONUS = 0.06;

export function explorationPolicyContribution(f: CandidateFeatures): number {
  return EXPLORATION_POLICY_V1_BONUS * Math.min(Math.max(f.exploration, 0), 1);
}
