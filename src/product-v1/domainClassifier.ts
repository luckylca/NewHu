import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRODUCT_V1_VERSION } from './constants';
import { loadProductV1TopicGraphAsync } from './assets';
import { bundledBadgeGraph } from './bundledBadgeGraph';
import {
  fuseProductV1TopicBadges,
  selectProductV1ContentBadges,
  selectProductV1NativeTopicBadges,
} from './topicBadgeSelection';
import {
  createProductV1DomainFingerprint,
  parseProductV1DomainCache,
  serializeProductV1DomainCache,
  type ProductV1DomainCacheValue,
} from './domainCache';
import type { ProductV1DomainMatch } from './domainSelection';

import {
  ProductV1DomainTaskQueue,
  type ProductV1DomainClassificationPriority,
} from './domainTaskQueue';
import {
  clearProductV1NativeTopicCache,
  getCachedProductV1NativeTopics,
  resolveProductV1NativeTopics,
} from './nativeTopicResolver';
import type { FeedType } from '@/src/types/zhihu';
import {
  getSemanticV2RuntimeAssetStatus,
} from '@/src/semantic-v2/runtimeAssets';
import {
  isSemanticV2RuntimeAvailable,
  resetSemanticV2Runtime,
  selectSemanticV2BadgesSafely,
} from '@/src/semantic-v2';

const MAX_CACHE_ENTRIES = 500;
const MAX_CLASSIFICATION_CODE_POINTS = 1200;
const PERSIST_DELAY_MS = 250;
const DOMAIN_CACHE_STORAGE_KEY = [
  'semantic-v2-domain-cache-v2',
  PRODUCT_V1_VERSION,
  'b64-512-native-topic-v43',
].join(':');

const cache = new Map<string, ProductV1DomainCacheValue>();
const classificationQueue = new ProductV1DomainTaskQueue();
let persistentCacheLoadPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function boundedText(value: string) {
  return Array.from(value ?? '').slice(0, MAX_CLASSIFICATION_CODE_POINTS).join('').trim();
}

function ensurePersistentCacheLoaded() {
  if (!persistentCacheLoadPromise) {
    persistentCacheLoadPromise = AsyncStorage.getItem(DOMAIN_CACHE_STORAGE_KEY)
      .then((raw) => {
        for (const [key, value] of parseProductV1DomainCache(raw, MAX_CACHE_ENTRIES)) {
          if (!cache.has(key)) cache.set(key, value);
        }
      })
      .catch(() => undefined);
  }
  return persistentCacheLoadPromise;
}

function schedulePersistentCacheWrite() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const payload = serializeProductV1DomainCache([...cache.entries()].slice(-MAX_CACHE_ENTRIES));
    void AsyncStorage.setItem(DOMAIN_CACHE_STORAGE_KEY, payload).catch(() => undefined);
  }, PERSIST_DELAY_MS);
}

function trimCache() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest == null) return;
    cache.delete(oldest);
  }
}

export function isProductV1DomainClassificationAvailable() {
  // The app bundle includes capsule topic names and broad-domain mappings, so
  // pills remain available even before optional runtime models are downloaded.
  return true;
}

export async function classifyProductV1Domains(
  contentKey: string,
  title: string,
  excerpt: string,
  options: {
    feedType?: FeedType;
    contentId?: string;
    questionId?: string;
    questionTopicIds?: string[];
    priority?: ProductV1DomainClassificationPriority;
    signal?: AbortSignal;
  } = {},
): Promise<ProductV1DomainMatch[]> {
  if (!isProductV1DomainClassificationAvailable()) return [];

  const normalizedTitle = boundedText(title);
  const normalizedExcerpt = boundedText(excerpt);
  const priority = options.priority ?? 'normal';
  const separator = contentKey.indexOf(':');
  const keyType = separator > 0 ? contentKey.slice(0, separator) : '';
  const keyId = separator > 0 ? contentKey.slice(separator + 1) : '';
  const inferredFeedType: FeedType | undefined = keyType === 'answer' || keyType === 'article'
    ? keyType
    : undefined;
  const feedType = options.feedType ?? inferredFeedType;
  const contentId = String(options.contentId ?? keyId).trim();
  const questionId = String(options.questionId ?? '').trim();
  const canUseNative = Boolean(feedType && contentId && (feedType !== 'answer' || questionId));
  const cachedNativeTopics = canUseNative
    ? await getCachedProductV1NativeTopics({ feedType: feedType!, contentId, questionId })
    : [];
  const nativeFingerprint = cachedNativeTopics
    .map((topic) => `${topic.id}:${topic.topicId ?? ''}:${topic.name}:${topic.category ?? ''}`)
    .join('|');
  const nativeRequested = priority === 'high' && canUseNative;
  // A visible badge intentionally performs a fast local pass before the native
  // enrichment pass. Those two passes must never share one cache slot: otherwise
  // the high-priority pass would hit the local result and skip the topic request.
  const cacheKey = `${contentKey}\u0001${nativeRequested ? 'native' : 'local'}`;
  const fingerprint = createProductV1DomainFingerprint(
    normalizedTitle,
    `${normalizedExcerpt}\u0000${nativeRequested ? questionId || contentId : ''}\u0000${nativeFingerprint}`,
  );

  await ensurePersistentCacheLoaded();
  const cached = cache.get(cacheKey);
  if (cached?.fingerprint === fingerprint) {
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return cached.matches;
  }

  const pendingKey = `${cacheKey}\u0000${fingerprint}\u0000${priority}`;
  return classificationQueue.enqueue(pendingKey, priority, async () => {
    if (!isProductV1DomainClassificationAvailable()) return [];

    let nativeTopics = cachedNativeTopics;
    let cacheable = true;
    // Off-screen/low-priority cards never create network traffic. Visible cards
    // resolve Zhihu topics once; the resolver deduplicates and persists results.
    if (priority === 'high' && canUseNative) {
      const resolved = await resolveProductV1NativeTopics({
        feedType: feedType!,
        contentId,
        questionId,
        questionTopicIds: options.questionTopicIds,
        signal: options.signal,
      });
      if (resolved === null) cacheable = false;
      else nativeTopics = resolved;
    }

    let matches: ProductV1DomainMatch[] | null = null;
    const semanticAssetsInstalled = getSemanticV2RuntimeAssetStatus().installed;
    if (semanticAssetsInstalled && isSemanticV2RuntimeAvailable() && !options.signal?.aborted) {
      matches = await selectSemanticV2BadgesSafely(
        normalizedTitle,
        normalizedExcerpt,
        nativeTopics,
      );
    }

    // If Semantic V2 has not been downloaded (or its runtime failed), reuse the
    // local Topic Graph already used by capsule classification before Native512.
    // This keeps labels available without starting a multi-file model download
    // just because a recommendation card scrolled into view.
    if (!matches?.length && !options.signal?.aborted) {
      const graph = await loadProductV1TopicGraphAsync().catch(() => null) ?? bundledBadgeGraph;
      const textMatches = selectProductV1ContentBadges(normalizedTitle, normalizedExcerpt, graph, 2);
      const nativeMatches = selectProductV1NativeTopicBadges(
        nativeTopics,
        normalizedTitle,
        normalizedExcerpt,
        graph,
        2,
      );
      matches = fuseProductV1TopicBadges(textMatches, nativeMatches, 2);
    }

    matches ??= [];
    if (cacheable && !options.signal?.aborted) {
      const enrichedFingerprint = createProductV1DomainFingerprint(
        normalizedTitle,
        `${normalizedExcerpt}\u0000${nativeRequested ? questionId || contentId : ''}\u0000${nativeTopics
          .map((topic) => `${topic.id}:${topic.topicId ?? ''}:${topic.name}:${topic.category ?? ''}`)
          .join('|')}`,
      );
      cache.set(cacheKey, { fingerprint: enrichedFingerprint, matches });
      trimCache();
      schedulePersistentCacheWrite();
    }
    return matches;
  }, options.signal);
}

export function clearProductV1DomainClassificationCache() {
  cache.clear();
  clearProductV1NativeTopicCache();
  resetSemanticV2Runtime();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistentCacheLoadPromise = AsyncStorage.removeItem(DOMAIN_CACHE_STORAGE_KEY)
    .then(() => undefined)
    .catch(() => undefined);
}
