import type { CompactSeedBank, SearchSeedCompact } from "./candidateAcquisition";

export const ROUTING_GLOBAL_COSINE = "GLOBAL_COSINE" as const;
export const ROUTING_DOMAIN_CONSTRAINED = "DOMAIN_CONSTRAINED_COSINE" as const;
export const ROUTING_DOMAIN_SOFT_GATE = "DOMAIN_SOFT_GATED_COSINE" as const;
export const ROUTING_DOMAIN_YIELD = "DOMAIN_YIELD" as const;
export const ROUTING_DOMAIN_YIELD_FRESHNESS = "DOMAIN_YIELD_FRESHNESS" as const;

export type SearchSeedRoutingVariant =
  | typeof ROUTING_GLOBAL_COSINE
  | typeof ROUTING_DOMAIN_CONSTRAINED
  | typeof ROUTING_DOMAIN_SOFT_GATE
  | typeof ROUTING_DOMAIN_YIELD
  | typeof ROUTING_DOMAIN_YIELD_FRESHNESS;

export interface RouterWeights {
  exactDomainBonus: number;
  relatedDomainBonus: number;
  unrelatedDomainPenalty: number;
  yieldWeight: number;
  freshnessWeight: number;
  duplicateWeight: number;
  identityWeight: number;
}

export const DEFAULT_ROUTER_WEIGHTS: RouterWeights = {
  exactDomainBonus: 0.050,
  relatedDomainBonus: 0.015,
  unrelatedDomainPenalty: 0.030,
  yieldWeight: 0.020,
  freshnessWeight: 0.010,
  duplicateWeight: 0.010,
  identityWeight: 0.005,
};

export interface SeedObservedStatsV2 {
  observations?: number;
  searchCount?: number;
  requestPages?: number;
  qualifiedRate?: number | null;
  uniqueQualifiedYield?: number | null;
  uniqueQualifiedPerRequest?: number | null;
  duplicateRate?: number | null;
  semanticPrecision?: number | null;
  meanSemanticMatch?: number | null;
  freshnessScore?: number | null;
  depthDecay?: number | null;
}

export interface SeedProvenanceV2 { provenance?: string; source?: string; }

export interface SearchSeedRoutingScoreV2 {
  seedId: string;
  text: string;
  broadDomain: string;
  semanticScore: number;
  domainCompatibility: number;
  domainScore: number;
  yieldScore: number;
  freshnessScore: number;
  duplicateCost: number;
  identityConfidence: number;
  finalScore: number;
  observed: boolean;
  parentText?: string | null;
}

export interface RoutedSearchSeedV2 { seed: SearchSeedCompact; score: SearchSeedRoutingScoreV2; }

function clip01(value: number | null | undefined, defaultValue = 0.5): number {
  if (value == null || !Number.isFinite(value)) return defaultValue;
  return Math.min(1, Math.max(0, value));
}

export function domainCompatibilityV2(seedDomain: string, primaryDomains: Iterable<string>, relatedDomains: Iterable<string> = []): number {
  const primary = new Set(primaryDomains);
  const related = new Set([...relatedDomains].filter((x) => !primary.has(x)));
  if (primary.has(seedDomain)) return 1;
  if (related.has(seedDomain)) return 0.4;
  return -1;
}

function domainTerm(compatibility: number, weights: RouterWeights): number {
  if (compatibility >= 1) return weights.exactDomainBonus;
  if (compatibility > 0) return weights.relatedDomainBonus;
  return -weights.unrelatedDomainPenalty;
}

function observationCount(stats?: SeedObservedStatsV2): number {
  if (!stats) return 0;
  return Math.max(0, Math.trunc(stats.observations ?? stats.searchCount ?? stats.requestPages ?? 0));
}

function normalizedUniqueYield(stats?: SeedObservedStatsV2): number | null {
  if (!stats) return null;
  const raw = stats.uniqueQualifiedYield ?? stats.uniqueQualifiedPerRequest;
  if (raw == null || !Number.isFinite(raw)) return null;
  return clip01(raw / 20, 0);
}

function yieldScore(stats?: SeedObservedStatsV2): number {
  if (!stats || observationCount(stats) <= 0) return 0;
  const parts: number[] = [];
  if (stats.qualifiedRate != null) parts.push(clip01(stats.qualifiedRate));
  const uq = normalizedUniqueYield(stats); if (uq != null) parts.push(uq);
  const semantic = stats.semanticPrecision ?? stats.meanSemanticMatch;
  if (semantic != null) parts.push(clip01((semantic - 0.20) / 0.30));
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
}

function freshnessScore(stats?: SeedObservedStatsV2): number {
  if (!stats || observationCount(stats) <= 0 || stats.freshnessScore == null) return 0;
  return clip01(stats.freshnessScore);
}

function identityConfidence(seed: SearchSeedCompact, provenance?: Record<string, SeedProvenanceV2>): number {
  const row = provenance?.[seed.seedId];
  if (!row) return 0.5;
  const status = String(row.provenance ?? row.source ?? "UNKNOWN").toUpperCase();
  return status === "UNKNOWN" ? 0.25 : 1;
}

function centerNorm(center: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < center.length; i += 1) sum += Number(center[i]) ** 2;
  return Math.sqrt(sum);
}

export function routeSearchSeedsV2(
  center: ArrayLike<number>, bank: CompactSeedBank, embeddings: Int8Array,
  options: {
    primaryDomains: Iterable<string>;
    relatedDomains?: Iterable<string>;
    observedStats?: Record<string, SeedObservedStatsV2>;
    provenance?: Record<string, SeedProvenanceV2>;
    variant?: SearchSeedRoutingVariant;
    topK?: number;
    weights?: RouterWeights;
  },
): RoutedSearchSeedV2[] {
  if (center.length !== bank.embeddingDimension) throw new Error("center/seed embedding dimension mismatch");
  if (embeddings.length !== bank.seedCount * bank.embeddingDimension) throw new Error("invalid compact embedding payload size");
  const norm = centerNorm(center); if (!(norm > 0)) throw new Error("center must be non-zero");
  const primary = [...options.primaryDomains];
  const related = [...(options.relatedDomains ?? [])];
  const variant = options.variant ?? ROUTING_DOMAIN_SOFT_GATE;
  const weights = options.weights ?? DEFAULT_ROUTER_WEIGHTS;
  const topK = Math.max(0, Math.trunc(options.topK ?? 10));
  const rows: RoutedSearchSeedV2[] = [];
  for (const seed of bank.seeds) {
    if (!seed.enabled) continue;
    const broadDomain = seed.broadCategory ?? "UNKNOWN";
    const compat = domainCompatibilityV2(broadDomain, primary, related);
    if (variant === ROUTING_DOMAIN_CONSTRAINED && compat < 0) continue;
    const base = seed.rowIndex * bank.embeddingDimension;
    let semantic = 0;
    for (let j = 0; j < bank.embeddingDimension; j += 1) semantic += (Number(center[j]) / norm) * embeddings[base + j] * bank.dequantScale;
    const domainScore = variant === ROUTING_GLOBAL_COSINE ? 0 : domainTerm(compat, weights);
    const stats = options.observedStats?.[seed.seedId];
    const observed = observationCount(stats) > 0;
    const y = variant === ROUTING_DOMAIN_YIELD || variant === ROUTING_DOMAIN_YIELD_FRESHNESS ? yieldScore(stats) : 0;
    const fresh = variant === ROUTING_DOMAIN_YIELD_FRESHNESS ? freshnessScore(stats) : 0;
    const duplicate = observed ? clip01(stats?.duplicateRate, 0) : 0;
    const identity = identityConfidence(seed, options.provenance);
    let finalScore = semantic + domainScore;
    if (variant === ROUTING_DOMAIN_YIELD || variant === ROUTING_DOMAIN_YIELD_FRESHNESS) {
      finalScore += weights.yieldWeight * y - weights.duplicateWeight * duplicate + weights.identityWeight * (identity - 0.5);
    }
    if (variant === ROUTING_DOMAIN_YIELD_FRESHNESS) finalScore += weights.freshnessWeight * fresh;
    rows.push({ seed, score: { seedId: seed.seedId, text: seed.text, broadDomain, semanticScore: semantic,
      domainCompatibility: compat, domainScore, yieldScore: y, freshnessScore: fresh, duplicateCost: duplicate,
      identityConfidence: identity, finalScore, observed, parentText: seed.parentText } });
  }
  rows.sort((a, b) => b.score.finalScore - a.score.finalScore || b.score.semanticScore - a.score.semanticScore || a.seed.seedId.localeCompare(b.seed.seedId));
  return rows.slice(0, topK);
}

export function selectDiverseSearchSeedsV2(rows: RoutedSearchSeedV2[], limit = 3): RoutedSearchSeedV2[] {
  const out: RoutedSearchSeedV2[] = []; const families = new Set<string>();
  for (const row of rows) {
    const family = (row.seed.parentText ?? row.seed.text).trim().toLocaleLowerCase();
    if (families.has(family)) continue;
    families.add(family); out.push(row);
    if (out.length >= Math.max(0, Math.trunc(limit))) break;
  }
  return out;
}
