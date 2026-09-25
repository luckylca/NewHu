import { drainCooperatively, drainSync } from './cooperative';
import type { SearchSeedCompact } from './candidateAcquisition';
export interface TopicGraphBroadDomainV1 {
  nodeId: string;
  canonicalName: string;
  centroidRowIndex: number;
}

export interface TopicGraphLeafV1 {
  nodeId: string;
  canonicalName: string;
  broadDomain: string;
  crossLinkDomains: string[];
  centroidRowIndex: number;
}

export interface TopicGraphQueryV1 {
  queryId: string;
  seedId?: string | null;
  text: string;
  leafNodeId: string;
  leafName: string;
  broadDomain: string;
  crossLinkDomains: string[];
  rowIndex: number;
  provenance: string;
  enabled: boolean;
  stats?: Record<string, unknown>;
}

export interface SearchTopicGraphCompactV1 {
  version: number;
  schemaVersion?: number;
  embeddingDimension: number;
  embeddingDtype?: string;
  dequantScale: number;
  broadDomains: TopicGraphBroadDomainV1[];
  leafTopics: TopicGraphLeafV1[];
  queries: TopicGraphQueryV1[];
}

export interface TopicGraphRouteV1 {
  queryId: string;
  seedId?: string | null;
  text: string;
  leafNodeId: string;
  leafName: string;
  broadDomain: string;
  crossLinkDomains: string[];
  semanticScore: number;
  finalScore: number;
  provenance: string;
}

/**
 * Pick a usable Search seed for a known interest deficit.
 *
 * Topic Graph ranking intentionally remains soft-domain semantic ranking. The
 * acquisition layer, however, already knows the exact interest it is trying to
 * replenish. Prefer the highest-ranked usable seed in that target broad domain;
 * if none remains (for example because every family was used), preserve the
 * historical behavior by falling back to the first usable routed seed.
 */
export function selectTargetDomainTopicGraphSeed(
  routes: TopicGraphRouteV1[],
  seedById: ReadonlyMap<string, SearchSeedCompact>,
  targetDomain: string,
  isBlocked: (seed: SearchSeedCompact) => boolean = () => false,
): SearchSeedCompact | null {
  let firstUsable: SearchSeedCompact | null = null;
  for (const route of routes) {
    if (!route.seedId) continue;
    const seed = seedById.get(route.seedId);
    if (!seed || isBlocked(seed)) continue;
    if (!firstUsable) firstUsable = seed;
    if (seed.broadCategory === targetDomain) return seed;
  }
  return firstUsable;
}

export interface TopicGraphLeafRouteV1 {
  nodeId: string;
  canonicalName: string;
  broadDomain: string;
  crossLinkDomains: string[];
  centroidScore: number;
  queryEvidenceScore: number;
  branchScore: number;
  score: number;
}

const EXACT_DOMAIN_BONUS = 0.050;
const RELATED_DOMAIN_BONUS = 0.015;
const WRONG_DOMAIN_PENALTY = 0.030;

function unit(center: ArrayLike<number>) {
  let sum = 0;
  for (let index = 0; index < center.length; index += 1) sum += Number(center[index]) ** 2;
  const norm = Math.sqrt(sum);
  if (!(norm > 0)) throw new Error('center must be non-zero');
  const normalized = new Float32Array(center.length);
  for (let index = 0; index < normalized.length; index += 1) normalized[index] = Number(center[index]) / norm;
  return normalized;
}

function dotRow(center: Float32Array, embeddings: Int8Array, row: number, dimension: number, scale: number) {
  let score = 0;
  const base = row * dimension;
  for (let index = 0; index < dimension; index += 1) score += center[index] * embeddings[base + index] * scale;
  return score;
}

export function topicGraphBroadDomainVector(
  graph: SearchTopicGraphCompactV1,
  embeddings: Int8Array,
  broadDomain: string,
): Float32Array | null {
  const node = graph.broadDomains.find((row) => row.canonicalName === broadDomain);
  if (!node) return null;
  const dimension = graph.embeddingDimension;
  if (dimension <= 0 || embeddings.length % dimension !== 0) throw new Error('graph embedding dimension mismatch');
  const base = node.centroidRowIndex * dimension;
  if (base < 0 || base + dimension > embeddings.length) throw new Error('graph broad-domain centroid row out of range');
  const vector = new Float32Array(dimension);
  for (let index = 0; index < dimension; index += 1) vector[index] = embeddings[base + index] * graph.dequantScale;
  return unit(vector);
}

function domainTerm(primary: string, crossLinks: string[], hints: Set<string>) {
  if (!hints.size) return 0;
  if (hints.has(primary)) return EXACT_DOMAIN_BONUS;
  if (crossLinks.some((domain) => hints.has(domain))) return RELATED_DOMAIN_BONUS;
  return -WRONG_DOMAIN_PENALTY;
}

function clip01(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(1, numeric));
}

function* routeTopicGraphSteps(
  center: ArrayLike<number>,
  graph: SearchTopicGraphCompactV1,
  embeddings: Int8Array,
  options: {
    hintDomains?: Iterable<string>;
    topKQueries?: number;
    topBranchK?: number;
    topLeafK?: number;
  } = {},
): Generator<void, TopicGraphRouteV1[], void> {
  const normalized = unit(center);
  const dimension = graph.embeddingDimension;
  const scale = graph.dequantScale;
  if (embeddings.length % dimension !== 0) throw new Error('graph embedding dimension mismatch');
  const hints = new Set(options.hintDomains ?? []);

  const broad = graph.broadDomains
    .map((node) => ({
      node,
      score: dotRow(normalized, embeddings, node.centroidRowIndex, dimension, scale)
        + (hints.has(node.canonicalName) ? EXACT_DOMAIN_BONUS : 0),
    }))
    .sort((a, b) => b.score - a.score || a.node.nodeId.localeCompare(b.node.nodeId));

  const branchLimit = Math.max(1, Math.trunc(options.topBranchK ?? 10));
  const branchIds = new Set(broad.slice(0, branchLimit).map(({ node }) => node.nodeId));
  for (const { node } of broad) if (hints.has(node.canonicalName)) branchIds.add(node.nodeId);
  const domainByNodeId = new Map(graph.broadDomains.map((node) => [node.nodeId, node.canonicalName]));
  const branchNames = new Set([...branchIds].map((nodeId) => domainByNodeId.get(nodeId)!).filter(Boolean));

  const leaves = graph.leafTopics
    .filter((node) => branchNames.has(node.broadDomain) || node.crossLinkDomains.some((domain) => branchNames.has(domain)))
    .map((node) => ({
      node,
      score: dotRow(normalized, embeddings, node.centroidRowIndex, dimension, scale)
        + domainTerm(node.broadDomain, node.crossLinkDomains, hints),
    }))
    .sort((a, b) => b.score - a.score || a.node.nodeId.localeCompare(b.node.nodeId));

  const leafLimit = Math.max(1, Math.trunc(options.topLeafK ?? 60));
  const keptLeafIds = new Set(leaves.slice(0, leafLimit).map(({ node }) => node.nodeId));
  const rows: TopicGraphRouteV1[] = [];
  let processed = 0;
  for (const query of graph.queries) {
    if (++processed % 16 === 0) yield;
    if (!query.enabled || !keptLeafIds.has(query.leafNodeId)) continue;
    const semanticScore = dotRow(normalized, embeddings, query.rowIndex, dimension, scale);
    let finalScore = semanticScore + domainTerm(query.broadDomain, query.crossLinkDomains, hints);
    const stats = query.stats ?? {};
    const observations = Number(stats.searchCount ?? stats.observations ?? 0);
    if (observations > 0) {
      const qualifiedRate = clip01(stats.qualifiedRate);
      const duplicateRate = clip01(stats.duplicateRate);
      if (qualifiedRate != null) finalScore += 0.01 * qualifiedRate;
      if (duplicateRate != null) finalScore -= 0.005 * duplicateRate;
    }
    rows.push({
      queryId: query.queryId,
      seedId: query.seedId,
      text: query.text,
      leafNodeId: query.leafNodeId,
      leafName: query.leafName,
      broadDomain: query.broadDomain,
      crossLinkDomains: query.crossLinkDomains,
      semanticScore,
      finalScore,
      provenance: query.provenance,
    });
  }

  rows.sort((a, b) => b.finalScore - a.finalScore
    || b.semanticScore - a.semanticScore
    || a.queryId.localeCompare(b.queryId));
  return rows.slice(0, Math.max(0, Math.trunc(options.topKQueries ?? 10)));
}

export function routeTopicLeavesV1(
  center: ArrayLike<number>,
  graph: SearchTopicGraphCompactV1,
  embeddings: Int8Array,
  topK = 16,
): TopicGraphLeafRouteV1[] {
  const normalized = unit(center);
  const dimension = graph.embeddingDimension;
  const scale = graph.dequantScale;
  if (embeddings.length % dimension !== 0) throw new Error('graph embedding dimension mismatch');

  // UI classification fuses the frozen tree instead of stopping at 51 broad
  // domains: leaf centroid is the main topic identity, query/seed rows provide
  // fine evidence, and the broad-domain centroid acts as a small stabilizer.
  const branchScores = new Map<string, number>();
  for (const node of graph.broadDomains) {
    branchScores.set(
      node.canonicalName,
      dotRow(normalized, embeddings, node.centroidRowIndex, dimension, scale),
    );
  }

  const queryEvidence = new Map<string, number>();
  for (const query of graph.queries) {
    if (!query.enabled) continue;
    const score = dotRow(normalized, embeddings, query.rowIndex, dimension, scale);
    const current = queryEvidence.get(query.leafNodeId);
    if (current == null || score > current) queryEvidence.set(query.leafNodeId, score);
  }

  const rows = graph.leafTopics.map((node) => {
    const centroidScore = dotRow(normalized, embeddings, node.centroidRowIndex, dimension, scale);
    const primaryBranchScore = branchScores.get(node.broadDomain) ?? centroidScore;
    const crossBranchScore = node.crossLinkDomains.reduce(
      (best, domain) => Math.max(best, branchScores.get(domain) ?? Number.NEGATIVE_INFINITY),
      Number.NEGATIVE_INFINITY,
    );
    const branchScore = Math.max(primaryBranchScore, crossBranchScore);
    const queryEvidenceScore = queryEvidence.get(node.nodeId) ?? centroidScore;
    const score = 0.70 * centroidScore + 0.20 * queryEvidenceScore + 0.10 * branchScore;
    return {
      nodeId: node.nodeId,
      canonicalName: node.canonicalName,
      broadDomain: node.broadDomain,
      crossLinkDomains: node.crossLinkDomains,
      centroidScore,
      queryEvidenceScore,
      branchScore,
      score,
    };
  });

  rows.sort((a, b) => b.score - a.score
    || b.centroidScore - a.centroidScore
    || a.nodeId.localeCompare(b.nodeId));
  return rows.slice(0, Math.max(0, Math.trunc(topK)));
}

export function routeTopicBranchesV1(
  center: ArrayLike<number>,
  graph: SearchTopicGraphCompactV1,
  embeddings: Int8Array,
  topK = 5,
) {
  const normalized = unit(center);
  const dimension = graph.embeddingDimension;
  const scale = graph.dequantScale;
  return graph.broadDomains
    .map((node) => ({
      nodeId: node.nodeId,
      canonicalName: node.canonicalName,
      score: dotRow(normalized, embeddings, node.centroidRowIndex, dimension, scale),
    }))
    .sort((a, b) => b.score - a.score || a.nodeId.localeCompare(b.nodeId))
    .slice(0, Math.max(0, Math.trunc(topK)));
}

export function routeTopicGraphV1(...args: Parameters<typeof routeTopicGraphSteps>) {
  return drainSync(routeTopicGraphSteps(...args));
}

export function routeTopicGraphV1Async(...args: Parameters<typeof routeTopicGraphSteps>) {
  return drainCooperatively(routeTopicGraphSteps(...args));
}
