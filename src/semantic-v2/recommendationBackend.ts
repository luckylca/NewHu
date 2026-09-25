import type { CandidateSource, CompactSeedBank } from '@/src/product-v1/core/candidateAcquisition';
import type { SearchTopicGraphCompactV1 } from '@/src/product-v1/core/searchTopicGraphV1';
import { encodeSemanticV2Texts, resetSemanticV2Encoder } from './encoder';
import { semanticV2ArticleText } from './tokenizer';
import { normalizeRecommendationVector } from './recommendationGeometry';
import { resetSemanticV2AssetCache } from './assets';
import {
  loadSeedBank512,
  loadSeedEmbeddings512,
  loadTopicGraph512,
  loadTopicGraphEmbeddings512,
  resetSemanticV2RecommendationAssetCache,
} from './recommendationAssets';

export type RecommendationBackendId = 'product_v1' | 'compat128' | 'native512';
export type Native512GeometryMode = 'relevanceMax' | 'microBalanced';

export type RecommendationBackend = {
  id: RecommendationBackendId;
  label: string;
  embeddingDimension: number;
  geometryVersion: string;
  stateScope: string;
  encodeArticle: (article: { title: string; excerpt: string }) => Promise<Float32Array>;
  semanticEmbedding: (embedding: ArrayLike<number>, source: CandidateSource) => Float32Array;
  assignmentEmbedding: (embedding: ArrayLike<number>, source: CandidateSource) => Float32Array;
  profileEmbedding: (embedding: ArrayLike<number>, source: CandidateSource) => Float32Array;
  routingCenterEmbedding: (embedding: ArrayLike<number>, source: CandidateSource) => Float32Array;
  candidateRoutingEmbedding: (embedding: ArrayLike<number>) => Float32Array;
  loadSeedBank: () => Promise<CompactSeedBank>;
  loadSeedEmbeddings: () => Promise<Int8Array>;
  loadTopicGraph: () => Promise<SearchTopicGraphCompactV1 | null>;
  loadTopicGraphEmbeddings: () => Promise<Int8Array | null>;
  verify: () => Promise<number>;
};

export const ACTIVE_RECOMMENDATION_BACKEND_ID: RecommendationBackendId = 'native512';
export const ACTIVE_NATIVE512_GEOMETRY_MODE: Native512GeometryMode = 'relevanceMax';

const UNIT_SCALE = 1 / 127;
const normalized = normalizeRecommendationVector;

async function downloadedSeedBank(): Promise<CompactSeedBank> {
  const raw = await loadSeedBank512();
  return {
    ...raw,
    embeddingDimension: 512,
    dequantScale: UNIT_SCALE,
    encoderVersion: 'SEMANTIC_V2_B64_512',
  };
}

async function downloadedTopicGraph(): Promise<SearchTopicGraphCompactV1> {
  const raw = await loadTopicGraph512();
  return {
    ...raw,
    embeddingDimension: 512,
    dequantScale: UNIT_SCALE,
  };
}

function validateRouteAssets(bank: CompactSeedBank, seedEmbeddings: Int8Array, graph: SearchTopicGraphCompactV1, graphEmbeddings: Int8Array) {
  if (!Number.isSafeInteger(bank.seedCount) || bank.seedCount <= 0 || bank.seeds.length !== bank.seedCount) {
    throw new Error('Semantic V2 seed bank row count mismatch');
  }
  if (seedEmbeddings.length !== bank.seedCount * bank.embeddingDimension) throw new Error('Semantic V2 seed embedding size mismatch');
  const rows = [
    ...graph.broadDomains.map((node) => node.centroidRowIndex),
    ...graph.leafTopics.map((node) => node.centroidRowIndex),
    ...graph.queries.map((query) => query.rowIndex),
  ];
  const rowCount = rows.length ? Math.max(...rows) + 1 : 0;
  if (graphEmbeddings.length !== rowCount * graph.embeddingDimension) throw new Error('Semantic V2 topic graph embedding size mismatch');
}

async function encodeSemanticArticle(article: { title: string; excerpt: string }) {
  const text = semanticV2ArticleText(article.title, article.excerpt);
  return (await encodeSemanticV2Texts([text]))[0];
}

function unitCopy(values: ArrayLike<number>) {
  return normalized(values);
}

function nativeBackend(): RecommendationBackend {
  return {
    id: ACTIVE_RECOMMENDATION_BACKEND_ID,
    label: 'Native512 · RelevanceMax',
    embeddingDimension: 512,
    geometryVersion: 'SEMANTIC_V2_NATIVE512_RELEVANCE_MAX',
    stateScope: 'semantic_b_native512_relevanceMax',
    encodeArticle: encodeSemanticArticle,
    semanticEmbedding: (embedding) => unitCopy(embedding),
    assignmentEmbedding: (embedding) => unitCopy(embedding),
    profileEmbedding: (embedding) => unitCopy(embedding),
    routingCenterEmbedding: (embedding) => unitCopy(embedding),
    candidateRoutingEmbedding: unitCopy,
    loadSeedBank: downloadedSeedBank,
    loadSeedEmbeddings: async () => {
      const [bank, embeddings, graph, graphEmbeddings] = await Promise.all([
        downloadedSeedBank(),
        loadSeedEmbeddings512(),
        downloadedTopicGraph(),
        loadTopicGraphEmbeddings512(),
      ]);
      validateRouteAssets(bank, embeddings, graph, graphEmbeddings);
      return embeddings;
    },
    loadTopicGraph: downloadedTopicGraph,
    loadTopicGraphEmbeddings: async () => loadTopicGraphEmbeddings512(),
    verify: async () => {
      const embedding = await encodeSemanticArticle({ title: '机器人控制 VLA', excerpt: '' });
      return Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
    },
  };
}

/**
 * Product recommendation is permanently upgraded to Native512/RelevanceMax.
 * The parameters remain accepted so older persisted settings/traces can be read
 * without a destructive database migration; they no longer select a runtime backend.
 */
export function resolveRecommendationBackend(
  _id: RecommendationBackendId = ACTIVE_RECOMMENDATION_BACKEND_ID,
  _nativeMode: Native512GeometryMode = ACTIVE_NATIVE512_GEOMETRY_MODE,
) {
  return nativeBackend();
}

export function scopedRecommendationState(scope: string, component: string) {
  return scope ? `${scope}:${component}` : component;
}

export function scopedRecommendationCandidateNamespace(scope: string, mode: 'live' | 'shadow', kind: 'active' | 'reserve') {
  const base = mode === 'shadow' ? `shadow_${kind}` : kind;
  return scope ? `${scope}:${base}` : base;
}

export function resetRecommendationBackendRuntime() {
  resetSemanticV2Encoder();
  resetSemanticV2AssetCache();
  resetSemanticV2RecommendationAssetCache();
}
