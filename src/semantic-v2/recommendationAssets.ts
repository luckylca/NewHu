import type { CompactSeedBank } from '@/src/product-v1/core/candidateAcquisition';
import type { SearchTopicGraphCompactV1 } from '@/src/product-v1/core/searchTopicGraphV1';
import { getSemanticV2AssetFile, type SemanticV2AssetKey } from './runtimeAssets';

const bytePromises = new Map<SemanticV2AssetKey, Promise<Uint8Array>>();
let seedBankPromise: Promise<CompactSeedBank> | null = null;
let topicGraphPromise: Promise<SearchTopicGraphCompactV1> | null = null;

async function downloadedBytes(key: SemanticV2AssetKey) {
  const existing = bytePromises.get(key);
  if (existing) return existing;
  const promise = getSemanticV2AssetFile(key)
    .then((file) => file.bytes())
    .catch((error) => {
      bytePromises.delete(key);
      throw error;
    });
  bytePromises.set(key, promise);
  return promise;
}

function asInt8(bytes: Uint8Array) {
  return new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export const loadSeedEmbeddings512 = async () => asInt8(await downloadedBytes('seedEmbeddings'));
export const loadTopicGraphEmbeddings512 = async () => asInt8(await downloadedBytes('topicGraphEmbeddings'));

export async function loadSeedBank512() {
  if (!seedBankPromise) {
    seedBankPromise = getSemanticV2AssetFile('seedBank')
      .then((file) => JSON.parse(file.textSync()) as CompactSeedBank)
      .catch((error) => {
        seedBankPromise = null;
        throw error;
      });
  }
  return seedBankPromise;
}

export async function loadTopicGraph512() {
  if (!topicGraphPromise) {
    topicGraphPromise = getSemanticV2AssetFile('topicGraph')
      .then((file) => JSON.parse(file.textSync()) as SearchTopicGraphCompactV1)
      .catch((error) => {
        topicGraphPromise = null;
        throw error;
      });
  }
  return topicGraphPromise;
}

export function resetSemanticV2RecommendationAssetCache() {
  bytePromises.clear();
  seedBankPromise = null;
  topicGraphPromise = null;
}
