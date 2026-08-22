export const CANDIDATE_SOURCE_BASELINE = "RECOMMENDATION_30_SEARCH_70" as const;
export const CANDIDATE_SOURCE_BASELINE_STATUS = "RESEARCH_BASELINE" as const;

export type CandidateSource = "recommendation" | "search";

export interface CandidateArticle {
  articleId: string;
  url: string;
  title: string;
  excerpt: string;
  authorId?: string | null;
  authorName?: string | null;
  publishedAt?: number | string | null;
  updatedAt?: number | string | null;
  source: CandidateSource;
  sourceQuery?: string | null;
  searchSeedId?: string | null;
  sourceRank: number;
  batchId: string;
  sessionId: string;
  retrievedAt: string;
  rawMetadata: Record<string, unknown>;
  duplicateKey: string;
  encoderEmbedding?: number[] | null;
  matchedInterestIds: string[];
  matchedInterestScores: number[];
  bestMatchedInterest?: string | null;
  bestSemanticScore?: number | null;
  qualified: boolean;
  rejectionReason?: string | null;
  seenBefore: boolean;
  sourceOrigins: CandidateSource[];
  queries: string[];
  seedIds: string[];
}

export interface SearchSeedCompact {
  seedId: string;
  text: string;
  broadCategory?: string | null;
  source?: string;
  enabled: boolean;
  parentText?: string | null;
  rowIndex: number;
}

export interface CompactSeedBank {
  version: number;
  seedCount: number;
  embeddingDimension: number;
  embeddingDtype: "int8";
  dequantScale: number;
  encoderVersion: string;
  seeds: SearchSeedCompact[];
}

export interface AcquisitionBudget { total: number; recommendation: number; search: number; }

export function splitAcquisitionBudget(total: number, recommendationShare = 0.30): AcquisitionBudget {
  if (!Number.isInteger(total) || total < 0) throw new Error("total must be a non-negative integer");
  if (recommendationShare < 0 || recommendationShare > 1) throw new Error("recommendationShare must be in [0,1]");
  const recommendation = Math.min(total, Math.max(0, Math.round(total * recommendationShare)));
  return { total, recommendation, search: total - recommendation };
}

export function allocateSearchBudget(total: number, weights: Record<string, number>): Record<string, number> {
  if (!Number.isInteger(total) || total < 0) throw new Error("total must be a non-negative integer");
  const positive = Object.entries(weights).filter(([, v]) => Number.isFinite(v) && v > 0).sort(([a], [b]) => a.localeCompare(b));
  if (positive.length === 0 || total === 0) return Object.fromEntries(positive.map(([k]) => [k, 0]));
  const sum = positive.reduce((acc, [, v]) => acc + v, 0);
  const exact = new Map(positive.map(([k, v]) => [k, total * v / sum]));
  const out: Record<string, number> = {};
  for (const [k] of positive) out[k] = Math.floor(exact.get(k)!);
  let remaining = total - Object.values(out).reduce((a, b) => a + b, 0);
  const order = positive.map(([k]) => k).sort((a, b) => (exact.get(b)! - out[b]) - (exact.get(a)! - out[a]) || a.localeCompare(b));
  for (const k of order) { if (remaining <= 0) break; out[k] += 1; remaining -= 1; }
  return out;
}

function normalizeTitle(value: string): string { return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " "); }
function canonicalUrl(value: string): string {
  if (!value) return "";
  try { const u = new URL(value); u.hash = ""; u.search = ""; u.pathname = u.pathname.replace(/\/+$/, "") || "/"; return u.toString(); }
  catch { return value.trim(); }
}
export function candidateDuplicateKey(articleId: string | null | undefined, url: string, title: string): string {
  if (articleId) return `id:${articleId}`;
  const c = canonicalUrl(url); if (c) return `url:${c}`;
  return `title:${normalizeTitle(title)}`;
}

export function mergeCandidateSources(candidates: CandidateArticle[]): { candidates: CandidateArticle[]; duplicateCount: number } {
  const merged = new Map<string, CandidateArticle>(); let duplicateCount = 0;
  for (const candidate of candidates) {
    const key = candidate.duplicateKey || candidateDuplicateKey(candidate.articleId, candidate.url, candidate.title);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...candidate, duplicateKey: key,
        sourceOrigins: [...new Set(candidate.sourceOrigins.length ? candidate.sourceOrigins : [candidate.source])],
        queries: [...new Set([...candidate.queries, ...(candidate.sourceQuery ? [candidate.sourceQuery] : [])])],
        seedIds: [...new Set([...candidate.seedIds, ...(candidate.searchSeedId ? [candidate.searchSeedId] : [])])] });
      continue;
    }
    duplicateCount += 1;
    current.sourceOrigins = [...new Set([...current.sourceOrigins, candidate.source])];
    current.queries = [...new Set([...current.queries, ...candidate.queries, ...(candidate.sourceQuery ? [candidate.sourceQuery] : [])])];
    current.seedIds = [...new Set([...current.seedIds, ...candidate.seedIds, ...(candidate.searchSeedId ? [candidate.searchSeedId] : [])])];
    current.seenBefore ||= candidate.seenBefore;
    if ((candidate.bestSemanticScore ?? Number.NEGATIVE_INFINITY) > (current.bestSemanticScore ?? Number.NEGATIVE_INFINITY)) {
      current.encoderEmbedding = candidate.encoderEmbedding; current.matchedInterestIds = [...candidate.matchedInterestIds];
      current.matchedInterestScores = [...candidate.matchedInterestScores]; current.bestMatchedInterest = candidate.bestMatchedInterest;
      current.bestSemanticScore = candidate.bestSemanticScore; current.qualified = candidate.qualified; current.rejectionReason = candidate.rejectionReason;
    }
  }
  return { candidates: [...merged.values()], duplicateCount };
}

export interface SeedMatch { seed: SearchSeedCompact; similarity: number; }
export function retrieveCompactSeeds(center: ArrayLike<number>, bank: CompactSeedBank, embeddings: Int8Array, topK = 10, minSimilarity?: number): SeedMatch[] {
  if (center.length !== bank.embeddingDimension) throw new Error("center/seed embedding dimension mismatch");
  if (embeddings.length !== bank.seedCount * bank.embeddingDimension) throw new Error("invalid compact embedding payload size");
  let norm = 0; for (let i = 0; i < center.length; i += 1) norm += Number(center[i]) ** 2; norm = Math.sqrt(norm);
  if (!(norm > 0)) throw new Error("center must be non-zero");
  const scored: SeedMatch[] = [];
  for (const seed of bank.seeds) {
    if (!seed.enabled) continue;
    let dot = 0; const base = seed.rowIndex * bank.embeddingDimension;
    for (let j = 0; j < bank.embeddingDimension; j += 1) dot += (Number(center[j]) / norm) * embeddings[base + j] * bank.dequantScale;
    if (minSimilarity === undefined || dot >= minSimilarity) scored.push({ seed, similarity: dot });
  }
  scored.sort((a, b) => b.similarity - a.similarity || a.seed.seedId.localeCompare(b.seed.seedId));
  return scored.slice(0, Math.max(0, Math.trunc(topK)));
}
