import type { InterestCenterState, ProfileState, RewardSignal } from "./types";
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
export type SimilarityLookup = (articleA: string, articleB: string) => number;

export function createProfileState(): ProfileState { return { version: 1, centers: [], namedScores: {}, namedConfidence: {}, maxCenters: 12, maxExemplars: 6 }; }

function centerSimilarity(center: InterestCenterState, articleId: string, sim: SimilarityLookup): number {
  if (!center.exemplars.length) return 0;
  let numer = 0, denom2 = 0;
  for (const a of center.exemplars) numer += a.weight * sim(articleId, a.articleId);
  for (const a of center.exemplars) for (const b of center.exemplars) denom2 += a.weight * b.weight * sim(a.articleId, b.articleId);
  return numer / Math.sqrt(Math.max(denom2, 1e-12));
}

function updateNamed(state: ProfileState, categories: string[], effective: number, confidence: number): void {
  for (const c of categories) {
    if (c === "other" || c === "unknown") continue;
    state.namedScores[c] = clamp((state.namedScores[c] ?? 0) * 0.997 + 0.32 * effective, -1, 1);
    state.namedConfidence[c] = clamp((state.namedConfidence[c] ?? 0) * 0.995 + 0.08 * confidence, 0, 1);
  }
}

export function updateProfile(state: ProfileState, articleId: string, categories: string[], signal: RewardSignal, step: number, sim: SimilarityLookup): { action: string; matchedSimilarity?: number } {
  const clean = categories.filter(c => c !== "other" && c !== "unknown"); const effective = signal.reward * signal.confidence; updateNamed(state, clean, effective, signal.confidence);
  if (Math.abs(effective) < 0.045) return { action: "NOOP_LOW_CONFIDENCE" };
  if (!state.centers.length && effective > 0) { state.centers.push({ centerId: "c000", exemplars: [{ articleId, weight: Math.max(effective, 0.1) }], tags: [...clean], weight: 0.45, confidence: signal.confidence, lastActiveStep: step, positiveCount: 1, negativeCount: 0 }); return { action: "SPAWN_FIRST" }; }
  if (!state.centers.length) return { action: "NO_CENTER_FOR_NEGATIVE" };
  const sims = state.centers.map(c => centerSimilarity(c, articleId, sim)); let best = 0; for (let i = 1; i < sims.length; i++) if (sims[i] > sims[best]) best = i; const maxSim = sims[best];
  const represented = new Set(state.centers.flatMap(c => c.tags)); const newNamed = clean.some(c => !represented.has(c));
  if (effective > 0 && state.centers.length < state.maxCenters && (maxSim < 0.32 || newNamed)) { const id = `c${state.centers.length.toString().padStart(3, "0")}`; state.centers.push({ centerId: id, exemplars: [{ articleId, weight: Math.max(effective, 0.1) }], tags: [...clean], weight: 0.38, confidence: signal.confidence, lastActiveStep: step, positiveCount: 1, negativeCount: 0 }); return { action: "SPAWN" }; }
  const center = state.centers[best];
  if (effective > 0) {
    center.exemplars.forEach(e => e.weight *= 0.90); const ex = center.exemplars.find(e => e.articleId === articleId); if (ex) ex.weight += Math.max(effective, 0.06); else center.exemplars.push({ articleId, weight: Math.max(effective, 0.06) });
    center.exemplars.sort((a, b) => b.weight - a.weight || a.articleId.localeCompare(b.articleId)); center.exemplars = center.exemplars.slice(0, state.maxExemplars); center.tags = [...new Set([...center.tags, ...clean])];
    center.weight = clamp(center.weight + 0.10 * effective, 0.05, 1); center.confidence = clamp(center.confidence + 0.06 * signal.confidence, 0, 1); center.positiveCount += 1; center.lastActiveStep = step; return { action: "REINFORCE", matchedSimilarity: maxSim };
  }
  if (maxSim >= 0.24) { center.weight = clamp(center.weight - 0.13 * Math.abs(effective), 0.05, 1); center.confidence = clamp(center.confidence - 0.025 * Math.abs(effective), 0, 1); center.negativeCount += 1; center.lastActiveStep = step; return { action: "DECREASE_MATCHED_CENTER", matchedSimilarity: maxSim }; }
  return { action: "NEGATIVE_NOT_ATTRIBUTED", matchedSimilarity: maxSim };
}

export function topNamedInterests(state: ProfileState, limit = 9): Array<[string, number]> {
  return Object.entries(state.namedScores).filter(([, v]) => v > 0.04).map(([k, v]) => [k, Math.max(v, 0) * (0.55 + 0.45 * (state.namedConfidence[k] ?? 0))] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}
