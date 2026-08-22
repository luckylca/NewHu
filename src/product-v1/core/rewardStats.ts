import type { RewardHistoryState, RewardSignal, RewardStatsState } from "./types";
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
export function createRewardStats(): RewardStatsState { return { version: 1, byInterest: {} }; }
export function rewardHistoryValue(state: RewardStatsState, interestId: string | null): number {
  if (!interestId) return 0; return clamp(state.byInterest[interestId]?.emaReward ?? 0, -1, 1);
}
export function updateRewardStats(state: RewardStatsState, interestId: string | null, signal: RewardSignal, alpha = 0.14): void {
  if (!interestId) return;
  const h: RewardHistoryState = state.byInterest[interestId] ?? { emaReward: 0, emaConfidence: 0, exposures: 0, positives: 0, negatives: 0 };
  const effective = signal.reward * signal.confidence;
  h.exposures += 1; h.emaReward = (1-alpha)*h.emaReward + alpha*effective; h.emaConfidence=(1-alpha)*h.emaConfidence+alpha*signal.confidence;
  h.positives += effective >= 0.15 ? 1 : 0; h.negatives += effective <= -0.15 ? 1 : 0; state.byInterest[interestId] = h;
}
