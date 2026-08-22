export interface CandidateDeficitConfig {
  horizon: number;
  tolerance: number;
  perCycleSearchRequests: number;
  perInterestSearchRequests: number;
  perSessionSearchRequests: number;
  minMarginalUniqueQualified: number;
  lowYieldStreakToStop: number;
  recommendationRefreshLimit: number;
}

export const DEFAULT_CANDIDATE_DEFICIT_CONFIG: CandidateDeficitConfig = {
  horizon: 20,
  tolerance: 1,
  perCycleSearchRequests: 6,
  perInterestSearchRequests: 3,
  perSessionSearchRequests: 20,
  minMarginalUniqueQualified: 2,
  lowYieldStreakToStop: 2,
  recommendationRefreshLimit: 1,
};

export interface InterestDeficit {
  interestId: string;
  targetWeight: number;
  desiredSupply: number;
  availableQualifiedSupply: number;
  deficit: number;
  normalizedDeficit: number;
}

function largestRemainder(weights: Record<string, number>, slots: number): Record<string, number> {
  const positive = Object.entries(weights)
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (slots <= 0 || positive.length === 0) return Object.fromEntries(positive.map(([k]) => [k, 0]));
  const exact = new Map(positive.map(([k, v]) => [k, slots * v]));
  const out: Record<string, number> = Object.fromEntries(positive.map(([k]) => [k, Math.floor(exact.get(k)!)]));
  let remaining = Math.max(0, slots - Object.values(out).reduce((a, b) => a + b, 0));
  const order = positive.map(([k]) => k).sort((a, b) => (exact.get(b)! - out[b]) - (exact.get(a)! - out[a]) || a.localeCompare(b));
  for (const key of order) { if (remaining <= 0) break; out[key] += 1; remaining -= 1; }
  return out;
}

export function desiredSupplyFromExplicit(targets: Record<string, number>, horizon = 20): Record<string, number> {
  if (!(horizon > 0) || !Number.isInteger(horizon)) throw new Error("horizon must be a positive integer");
  let positive = Object.fromEntries(Object.entries(targets).filter(([, v]) => Number.isFinite(v) && v > 0).map(([k, v]) => [k, Math.max(0, v)]));
  let total = Object.values(positive).reduce((a, b) => a + b, 0);
  if (total > 1.000001) { positive = Object.fromEntries(Object.entries(positive).map(([k, v]) => [k, v / total])); total = 1; }
  const knownSlots = Math.round(horizon * Math.min(1, total));
  if (knownSlots <= 0 || total <= 0) return Object.fromEntries(Object.keys(positive).map((k) => [k, 0]));
  const normalized = Object.fromEntries(Object.entries(positive).map(([k, v]) => [k, v / total]));
  return largestRemainder(normalized, knownSlots);
}

export function desiredSupplyFromProfile(profileWeights: Record<string, number>, horizon = 20): Record<string, number> {
  const positive = Object.fromEntries(Object.entries(profileWeights).filter(([, v]) => Number.isFinite(v) && v > 0).map(([k, v]) => [k, Math.max(0, v)]));
  const total = Object.values(positive).reduce((a, b) => a + b, 0);
  if (total <= 0) return {};
  const normalized = Object.fromEntries(Object.entries(positive).map(([k, v]) => [k, v / total]));
  return largestRemainder(normalized, horizon);
}

export function computeCandidateDeficits(desiredSupply: Record<string, number>, availableSupply: Record<string, number>, tolerance = 1): InterestDeficit[] {
  if (tolerance < 0) throw new Error("tolerance must be non-negative");
  const totalDesired = Math.max(1, Object.values(desiredSupply).reduce((a, b) => a + Math.max(0, Math.trunc(b)), 0));
  return Object.keys(desiredSupply).sort().map((interestId) => {
    const desired = Math.max(0, Math.trunc(desiredSupply[interestId]));
    const available = Math.max(0, Math.trunc(availableSupply[interestId] ?? 0));
    const rawDeficit = Math.max(0, desired - available);
    const deficit = rawDeficit <= tolerance ? 0 : rawDeficit;
    return { interestId, targetWeight: desired / totalDesired, desiredSupply: desired, availableQualifiedSupply: available,
      deficit, normalizedDeficit: desired > 0 ? deficit / desired : 0 };
  });
}

export function prioritizeDeficits(deficits: InterestDeficit[], expectedSearchYield: Record<string, number> = {}): Array<{ deficit: InterestDeficit; priority: number }> {
  const rows = deficits.filter((d) => d.deficit > 0).map((d) => {
    const scarcity = 1 - Math.min(1, d.availableQualifiedSupply / Math.max(1, d.desiredSupply));
    const expected = Math.min(1, Math.max(0, expectedSearchYield[d.interestId] ?? 0.5));
    const priority = 0.55 * d.normalizedDeficit + 0.20 * d.targetWeight + 0.15 * scarcity + 0.10 * expected;
    return { deficit: d, priority };
  });
  rows.sort((a, b) => b.priority - a.priority || b.deficit.deficit - a.deficit.deficit || a.deficit.interestId.localeCompare(b.deficit.interestId));
  return rows;
}
