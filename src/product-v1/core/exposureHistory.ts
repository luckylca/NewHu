import type { ExposureHistoryState } from "./types";
export function createExposureHistory(maxRecent = 120): ExposureHistoryState { return { version: 1, byInterest: {}, recentArticleIds: [], recentInterestIds: [], maxRecent }; }
export function observeExposure(state: ExposureHistoryState, articleId: string, interestId: string | null): void {
  state.recentArticleIds.push(articleId); state.recentInterestIds.push(interestId ?? "__none__");
  if (interestId) state.byInterest[interestId] = (state.byInterest[interestId] ?? 0) + 1;
  if (state.recentArticleIds.length > state.maxRecent) state.recentArticleIds = state.recentArticleIds.slice(-state.maxRecent);
  if (state.recentInterestIds.length > state.maxRecent) state.recentInterestIds = state.recentInterestIds.slice(-state.maxRecent);
}
export function repetitionRate(state: ExposureHistoryState, interestId: string | null, window = 24): number {
  if (!interestId) return 0; const h=state.recentInterestIds.slice(-window); return h.length ? h.filter(x=>x===interestId).length/h.length : 0;
}
