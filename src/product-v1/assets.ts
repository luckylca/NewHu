import type { CompactSeedBank } from './core/candidateAcquisition';
import { PRODUCT_V1_EMBEDDING_DIMENSION, PRODUCT_V1_SEED_COUNT } from './constants';
import {
  ensureProductV1RuntimeAssets,
  getProductV1SeedBankFile,
  getProductV1SeedEmbeddingsFile,
} from './runtimeAssets';

let seedBank: CompactSeedBank | null = null;

export async function loadProductV1ModelPath() {
  const { ensureProductV1ModelPath } = await import('./modelFile');
  return ensureProductV1ModelPath();
}

let seedEmbeddingsPromise: Promise<Int8Array> | null = null;

export function loadProductV1SeedBank() {
  if (!seedBank) {
    const file = getProductV1SeedBankFile();
    if (!file.exists) throw new Error('Search Seed Bank V2 未安装');
    seedBank = JSON.parse(file.textSync()) as CompactSeedBank;
  }
  if (seedBank.version !== 2
    || seedBank.seedCount !== PRODUCT_V1_SEED_COUNT
    || seedBank.embeddingDimension !== PRODUCT_V1_EMBEDDING_DIMENSION
    || seedBank.embeddingDtype !== 'int8'
    || seedBank.seeds.some((seed) => !Number.isInteger(seed.rowIndex) || !seed.broadCategory)) {
    throw new Error('Search Seed Bank V2 manifest validation failed');
  }
  return seedBank;
}

export function loadProductV1SeedEmbeddings() {
  if (!seedEmbeddingsPromise) {
    seedEmbeddingsPromise = ensureProductV1RuntimeAssets()
      .then(() => getProductV1SeedEmbeddingsFile().bytes())
      .then((bytes) => {
        const bank = loadProductV1SeedBank();
        const embeddings = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (embeddings.length !== bank.seedCount * bank.embeddingDimension) {
          throw new Error('Search Seed Bank V2 payload size mismatch');
        }
        return embeddings;
      });
  }
  return seedEmbeddingsPromise;
}

export function resetProductV1AssetCache() {
  seedBank = null;
  seedEmbeddingsPromise = null;
}
