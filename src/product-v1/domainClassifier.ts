import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadProductV1SeedBank, loadProductV1SeedEmbeddings } from './assets';
import { PRODUCT_V1_VERSION } from './constants';
import {
  createProductV1DomainFingerprint,
  parseProductV1DomainCache,
  serializeProductV1DomainCache,
  type ProductV1DomainCacheValue,
} from './domainCache';
import { encodeArticle } from './encoder';
import { productV1DomainLabel } from './domainLabels';
import { selectProductV1DomainMatches, type ProductV1DomainMatch } from './domainSelection';
import {
  ProductV1DomainTaskQueue,
  type ProductV1DomainClassificationPriority,
} from './domainTaskQueue';
import { routeSearchSeedsV2 } from './core/searchSeedRouterV2';
import {
  getProductV1RuntimeAssetStatus,
  PRODUCT_V1_ASSET_VERSION,
  PRODUCT_V1_MODEL_SPEC,
  PRODUCT_V1_SEED_BANK_SPEC,
  PRODUCT_V1_SEED_EMBEDDINGS_SPEC,
} from './runtimeAssets';

const MAX_CACHE_ENTRIES = 500;
const MAX_CLASSIFICATION_CODE_POINTS = 1200;
const PERSIST_DELAY_MS = 250;
const DOMAIN_CACHE_STORAGE_KEY = [
  'product-v1-domain-cache-v1',
  PRODUCT_V1_VERSION,
  PRODUCT_V1_ASSET_VERSION,
  PRODUCT_V1_MODEL_SPEC.sha256.slice(0, 12),
  PRODUCT_V1_SEED_BANK_SPEC.sha256.slice(0, 12),
  PRODUCT_V1_SEED_EMBEDDINGS_SPEC.sha256.slice(0, 12),
  'min018-gap008-max3',
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
  return getProductV1RuntimeAssetStatus().installed;
}

export async function classifyProductV1Domains(
  contentKey: string,
  title: string,
  excerpt: string,
  options: {
    priority?: ProductV1DomainClassificationPriority;
    signal?: AbortSignal;
  } = {},
): Promise<ProductV1DomainMatch[]> {
  if (!isProductV1DomainClassificationAvailable()) return [];

  const normalizedTitle = boundedText(title);
  const normalizedExcerpt = boundedText(excerpt);
  const fingerprint = createProductV1DomainFingerprint(normalizedTitle, normalizedExcerpt);

  await ensurePersistentCacheLoaded();
  const cached = cache.get(contentKey);
  if (cached?.fingerprint === fingerprint) {
    cache.delete(contentKey);
    cache.set(contentKey, cached);
    return cached.matches;
  }

  const pendingKey = `${contentKey}\u0000${fingerprint}`;
  return classificationQueue.enqueue(pendingKey, options.priority ?? 'normal', async () => {
    // Do not let the classifier itself trigger a Product V1 resource download.
    if (!isProductV1DomainClassificationAvailable()) return [];

    const embedding = await encodeArticle({
      title: normalizedTitle,
      excerpt: normalizedExcerpt,
    });
    const bank = loadProductV1SeedBank();
    const seedEmbeddings = await loadProductV1SeedEmbeddings();
    const routed = routeSearchSeedsV2(embedding, bank, seedEmbeddings, {
      primaryDomains: [],
      variant: 'GLOBAL_COSINE',
      topK: 24,
    });

    const matches = selectProductV1DomainMatches(
      routed.map((row) => ({
        domain: row.score.broadDomain,
        score: row.score.semanticScore,
      })),
      {
        minScore: 0.18,
        maxGapFromBest: 0.08,
        maxDomains: 3,
        labelForDomain: productV1DomainLabel,
      },
    );

    cache.set(contentKey, { fingerprint, matches });
    trimCache();
    schedulePersistentCacheWrite();
    return matches;
  }, options.signal);
}

export function clearProductV1DomainClassificationCache() {
  cache.clear();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistentCacheLoadPromise = AsyncStorage.removeItem(DOMAIN_CACHE_STORAGE_KEY)
    .then(() => undefined)
    .catch(() => undefined);
}
