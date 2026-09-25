import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import broadHeadsJson from '@/assets/semantic-v2/broad_heads.json';
import policyJson from '@/assets/semantic-v2/policy.json';
import topicMetaJson from '@/assets/semantic-v2/product_topic_meta.json';
import { productV1DomainLabel } from '@/src/product-v1/domainLabels';
import type { ProductV1DomainMatch } from '@/src/product-v1/domainSelection';
import type { ProductV1NativeTopicSignal } from '@/src/product-v1/topicBadgeSelection';
import { loadSemanticV2FallbackPath, resetSemanticV2AssetCache } from './assets';
import { cosineSimilarity512, encodeSemanticV2Texts, resetSemanticV2Encoder } from './encoder';
import { semanticV2ArticleText } from './tokenizer';
import {
  decideSemanticV2LeafRefinement,
  type SemanticV2LeafRefinementPolicy,
} from './leafRefinement';

type BroadHeadsManifest = { domainOrder: string[] };
type TopicMeta = {
  broadDomains: { canonicalName: string; centroidRowIndex: number }[];
  leafTopics: {
    nodeId: string;
    canonicalName: string;
    broadDomain: string;
    crossLinkDomains: string[];
    centroidRowIndex: number;
  }[];
};
type BadgePolicy = {
  selector: {
    secondCapsule: { maxCapsules: number; scoreGapLt: number; secondCosineGte: number };
    metaTopicBlocklist?: string[];
  };
  leafRefinement: SemanticV2LeafRefinementPolicy;
};

const broadHeads = broadHeadsJson as BroadHeadsManifest;
const topicMeta = topicMetaJson as TopicMeta;
const policy = policyJson as BadgePolicy;
const FALLBACK_DIMENSION = 512;
const MAX_NATIVE_TOPIC_LENGTH = 24;

const explicitMetaTopicBlocklist = new Set([
  '调查类问题', '真实经历', '生活', '社会', '中年', '中年人',
  '综艺', '娱乐', '热门', '热点话题', '其他', '知乎', '问题', '话题', '杂谈',
  '学习', '工作', '经验', '故事', '图片', '照片', '客户', '诡异',
  '知乎许愿池', '脑洞类问题', '如何看待/评价TA', '如何评价', '如何看待',
]);

function normalizedMetaTopic(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

for (const value of policy.selector.metaTopicBlocklist ?? []) {
  if (value && !/^\?+$/.test(value)) explicitMetaTopicBlocklist.add(normalizedMetaTopic(value));
}

const leafDomainByName = new Map(
  topicMeta.leafTopics.map((leaf) => [normalizedMetaTopic(leaf.canonicalName), leaf.broadDomain] as const),
);

function usableNativeTopics(topics: ProductV1NativeTopicSignal[]) {
  const unique = new Map<string, ProductV1NativeTopicSignal>();
  for (const topic of topics) {
    const name = String(topic.name ?? '').trim();
    const normalized = normalizedMetaTopic(name);
    const length = Array.from(name).length;
    if (length < 2 || length > MAX_NATIVE_TOPIC_LENGTH || !normalized) continue;
    if (explicitMetaTopicBlocklist.has(normalized)) continue;
    if (!unique.has(normalized)) unique.set(normalized, { ...topic, name });
  }
  return [...unique.entries()].map(([normalized, topic]) => ({ normalized, topic }));
}

let fallbackSessionPromise: Promise<InferenceSession> | null = null;
let semanticRuntimeDisabled = false;
let warnedRuntimeFailure = false;

function getFallbackSession() {
  if (!fallbackSessionPromise) {
    fallbackSessionPromise = loadSemanticV2FallbackPath()
      .then((modelPath) => InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        executionMode: 'sequential',
        intraOpNumThreads: 1,
        interOpNumThreads: 1,
      }))
      .catch((error) => {
        fallbackSessionPromise = null;
        throw error;
      });
  }
  return fallbackSessionPromise;
}

function nativeDomain(normalized: string) {
  return leafDomainByName.get(normalized) ?? `semantic-native:${normalized}`;
}

async function nativeTopicBadges(
  articleEmbedding: Float32Array,
  topics: ReturnType<typeof usableNativeTopics>,
): Promise<ProductV1DomainMatch[]> {
  if (topics.length === 0) return [];
  const topicEmbeddings = await encodeSemanticV2Texts(topics.map(({ topic }) => topic.name));
  const ranked = topics.map((row, index) => ({
    ...row,
    score: cosineSimilarity512(articleEmbedding, topicEmbeddings[index]),
  })).sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name));

  const first = ranked[0];
  if (!first) return [];
  const selected = [first];
  const second = ranked[1];
  if (second
    && selected.length < policy.selector.secondCapsule.maxCapsules
    && first.score - second.score < policy.selector.secondCapsule.scoreGapLt
    && second.score >= policy.selector.secondCapsule.secondCosineGte) {
    selected.push(second);
  }

  return selected.map((row) => ({
    domain: nativeDomain(row.normalized),
    label: row.topic.name,
    score: row.score,
  }));
}

function argmax(values: ArrayLike<number>) {
  let bestIndex = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const value = Number(values[i]);
    if (value > bestValue) {
      bestValue = value;
      bestIndex = i;
    }
  }
  return { index: bestIndex, value: bestValue };
}

async function fallbackBadge(
  articleEmbedding: Float32Array,
  hasExcerpt: boolean,
): Promise<ProductV1DomainMatch[]> {
  const session = await getFallbackSession();
  const output = await session.run({
    embedding512: new Tensor('float32', articleEmbedding, [1, FALLBACK_DIMENSION]),
  });

  const broadData = (hasExcerpt ? output.excerpt_broad_logits : output.title_broad_logits)?.data;
  const leafData = output.leaf_scores?.data;
  if (!broadData || broadData.length !== broadHeads.domainOrder.length) {
    throw new Error('Semantic V2 broad fallback returned an invalid tensor');
  }
  if (!leafData || leafData.length !== topicMeta.leafTopics.length) {
    throw new Error('Semantic V2 leaf fallback returned an invalid tensor');
  }

  const broadWinner = argmax(broadData as ArrayLike<number>);
  const broadDomain = broadHeads.domainOrder[broadWinner.index];
  // Frozen research gate is deliberately global: first choose the best two
  // leaves across all 456 topics, then require the global winner's primary
  // broad domain to agree with the broad fallback. Filtering by broad first
  // would make the gate materially less conservative than the validated policy.
  const leafRows = topicMeta.leafTopics
    .map((leaf, index) => ({ leaf, score: Number((leafData as ArrayLike<number>)[index]) }))
    .sort((a, b) => b.score - a.score || a.leaf.canonicalName.localeCompare(b.leaf.canonicalName));

  const bestLeaf = leafRows[0];
  const secondLeaf = leafRows[1];
  const leafMargin = bestLeaf ? bestLeaf.score - (secondLeaf?.score ?? -Infinity) : -Infinity;
  if (bestLeaf) {
    const leafDecision = decideSemanticV2LeafRefinement(
      broadDomain,
      bestLeaf.leaf.broadDomain,
      bestLeaf.score,
      leafMargin,
      policy.leafRefinement,
    );
    if (leafDecision !== 'broad-fallback') {
      return [{
        domain: bestLeaf.leaf.broadDomain,
        label: bestLeaf.leaf.canonicalName,
        score: bestLeaf.score,
      }];
    }
  }

  return [{
    domain: broadDomain,
    label: productV1DomainLabel(broadDomain),
    score: broadWinner.value,
  }];
}

async function selectSemanticV2Badges(
  title: string,
  excerpt: string,
  nativeTopics: ProductV1NativeTopicSignal[],
) {
  const articleText = semanticV2ArticleText(title, excerpt);
  if (!articleText) return [];

  const filteredTopics = usableNativeTopics(nativeTopics);
  const articleEmbedding = (await encodeSemanticV2Texts([articleText]))[0];
  if (filteredTopics.length > 0) {
    const badges = await nativeTopicBadges(articleEmbedding, filteredTopics);
    if (badges.length > 0) return badges;
  }
  return fallbackBadge(articleEmbedding, excerpt.trim().length > 0);
}

export function isSemanticV2RuntimeAvailable() {
  return !semanticRuntimeDisabled;
}

export async function selectSemanticV2BadgesSafely(
  title: string,
  excerpt: string,
  nativeTopics: ProductV1NativeTopicSignal[],
): Promise<ProductV1DomainMatch[] | null> {
  if (semanticRuntimeDisabled) return null;
  try {
    return await selectSemanticV2Badges(title, excerpt, nativeTopics);
  } catch (error) {
    semanticRuntimeDisabled = true;
    if (!warnedRuntimeFailure) {
      warnedRuntimeFailure = true;
      console.warn('[SemanticV2] runtime disabled; falling back to Product V1 badges', error);
    }
    return null;
  }
}

export function resetSemanticV2Runtime() {
  semanticRuntimeDisabled = false;
  warnedRuntimeFailure = false;
  fallbackSessionPromise = null;
  resetSemanticV2Encoder();
  resetSemanticV2AssetCache();
}
