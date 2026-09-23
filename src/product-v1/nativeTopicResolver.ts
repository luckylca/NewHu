import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiInstance } from '@/src/api/ZhihuApi';
import type { FeedType } from '@/src/types/zhihu';

export type ProductV1NativeTopic = {
  id: string;
  topicId?: string;
  name: string;
  category?: string;
};

type NativeTopicCacheEntry = {
  fetchedAt: number;
  topics: ProductV1NativeTopic[];
};

const STORAGE_KEY = 'product-v1-native-content-topics-v2';
const MAX_CACHE_ENTRIES = 1200;
const POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMPTY_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 450;
const PERSIST_DELAY_MS = 300;

const cache = new Map<string, NativeTopicCacheEntry>();
const inFlight = new Map<string, Promise<ProductV1NativeTopic[] | null>>();
let loadPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastRequestAt = 0;

function validTopic(value: unknown): ProductV1NativeTopic | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = String(row.id ?? row.topic_id ?? '').trim();
  const topicId = row.topic_id == null ? '' : String(row.topic_id).trim();
  const name = String(row.name ?? '').trim();
  const category = row.category == null ? '' : String(row.category).trim();
  if (!name) return null;
  return {
    id: id || `name:${name}`,
    topicId: topicId || undefined,
    name,
    category: category || undefined,
  };
}

function contentKey(feedType: FeedType, contentId: string, questionId?: string) {
  return feedType === 'answer' && questionId ? `question:${questionId}` : `${feedType}:${contentId}`;
}

function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as { entries?: unknown };
        if (!Array.isArray(parsed.entries)) return;
        for (const entry of parsed.entries.slice(-MAX_CACHE_ENTRIES)) {
          if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') continue;
          const value = entry[1];
          if (!value || typeof value !== 'object') continue;
          const candidate = value as Record<string, unknown>;
          const fetchedAt = Number(candidate.fetchedAt ?? 0);
          if (!Number.isFinite(fetchedAt) || !Array.isArray(candidate.topics)) continue;
          const topics = candidate.topics.map(validTopic).filter((topic): topic is ProductV1NativeTopic => topic !== null);
          cache.set(entry[0], { fetchedAt, topics });
        }
      })
      .catch(() => undefined);
  }
  return loadPromise;
}

function trimCache() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest == null) return;
    cache.delete(oldest);
  }
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const entries = [...cache.entries()].slice(-MAX_CACHE_ENTRIES);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries })).catch(() => undefined);
  }, PERSIST_DELAY_MS);
}

function fresh(entry: NativeTopicCacheEntry, now: number) {
  const ttl = entry.topics.length > 0 ? POSITIVE_TTL_MS : EMPTY_TTL_MS;
  return now - entry.fetchedAt <= ttl;
}

function setCached(key: string, topics: ProductV1NativeTopic[]) {
  cache.delete(key);
  cache.set(key, { fetchedAt: Date.now(), topics });
  trimCache();
  schedulePersist();
}

export async function getCachedProductV1NativeTopics(options: {
  feedType: FeedType;
  contentId: string;
  questionId?: string;
}) {
  await ensureLoaded();
  const entry = cache.get(contentKey(options.feedType, options.contentId, options.questionId));
  return entry && fresh(entry, Date.now()) ? entry.topics : [];
}

async function throttle(signal?: AbortSignal) {
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs <= 0) return !signal?.aborted;
  await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  return !signal?.aborted;
}

/**
 * Resolve Zhihu's own semantic topics. Answers are keyed by question because
 * every answer to one question shares the same topic set; articles use their
 * article id. `null` means enrichment failed/could not run, while [] means a
 * successful lookup with no usable topics. Concurrent duplicate lookups share
 * one promise so multiple card layouts cannot stampede the API.
 */
export async function resolveProductV1NativeTopics(options: {
  feedType: FeedType;
  contentId: string;
  questionId?: string;
  questionTopicIds?: string[];
  signal?: AbortSignal;
}): Promise<ProductV1NativeTopic[] | null> {
  const id = String(options.contentId ?? '').trim();
  const questionId = String(options.questionId ?? '').trim();
  if (!id) return [];
  if (options.feedType === 'answer' && !questionId) return [];

  await ensureLoaded();
  const key = contentKey(options.feedType, id, questionId);
  const cached = cache.get(key);
  if (cached && fresh(cached, Date.now())) {
    cache.delete(key);
    cache.set(key, cached);
    return cached.topics;
  }

  // bound_topic_ids are legacy ids and are not directly resolvable through
  // /topics/{id}. An explicit empty list still reliably lets us skip a detail
  // request for a question with no bound topics.
  if (options.feedType === 'answer'
    && Array.isArray(options.questionTopicIds)
    && options.questionTopicIds.length === 0) {
    setCached(key, []);
    return [];
  }

  const current = inFlight.get(key);
  if (current) return current;

  const task = (async () => {
    if (options.signal?.aborted || !(await throttle(options.signal))) return null;
    try {
      lastRequestAt = Date.now();
      const api = getApiInstance();
      const response = options.feedType === 'answer'
        ? await api.getQuestion(questionId)
        : await api.getArticle(id);
      if (options.signal?.aborted) return null;
      const rawTopics: unknown[] = Array.isArray(response?.topics) ? response.topics : [];
      const topics = rawTopics
        .map(validTopic)
        .filter((topic): topic is ProductV1NativeTopic => topic !== null);
      const deduped: ProductV1NativeTopic[] = [
        ...new Map(topics.map((topic) => [topic.id || topic.name, topic] as const)).values(),
      ];
      setCached(key, deduped);
      return deduped;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, task);
  return task;
}

export function resolveProductV1QuestionTopics(questionId: string, signal?: AbortSignal) {
  return resolveProductV1NativeTopics({
    feedType: 'answer',
    contentId: questionId,
    questionId,
    signal,
  });
}

export function clearProductV1NativeTopicCache() {
  cache.clear();
  inFlight.clear();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  loadPromise = AsyncStorage.removeItem(STORAGE_KEY).then(() => undefined).catch(() => undefined);
}
