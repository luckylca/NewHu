import type { CompactSeedBank } from './core/candidateAcquisition';
import type { SearchTopicGraphCompactV1 } from './core/searchTopicGraphV1';
import { PRODUCT_V1_EMBEDDING_DIMENSION, PRODUCT_V1_SEED_COUNT } from './constants';
import {
  ensureProductV1RuntimeAssets,
  getProductV1SeedBankFile,
  getProductV1SeedEmbeddingsFile,
  getProductV1TopicGraphEmbeddingsFile,
  getProductV1TopicGraphFile,
  PRODUCT_V1_SEED_BANK_SPEC,
  PRODUCT_V1_SEED_EMBEDDINGS_SPEC,
  PRODUCT_V1_TOPIC_GRAPH_SPEC,
  PRODUCT_V1_TOPIC_GRAPH_EMBEDDINGS_SPEC,
  validateProductV1AssetAsync,
} from './runtimeAssets';

let seedBank: CompactSeedBank | null = null;
let seedBankPromise: Promise<CompactSeedBank> | null = null;
let topicGraph: SearchTopicGraphCompactV1 | null = null;
let topicGraphPromise: Promise<SearchTopicGraphCompactV1 | null> | null = null;

export async function loadProductV1ModelPath() {
  const { ensureProductV1ModelPath } = await import('./modelFile');
  return ensureProductV1ModelPath();
}

let seedEmbeddingsPromise: Promise<Int8Array> | null = null;
let topicGraphEmbeddingsPromise: Promise<Int8Array | null> | null = null;

function validateSeedBank(bank: CompactSeedBank) {
  if (bank.version !== 2
    || bank.seedCount !== PRODUCT_V1_SEED_COUNT
    || bank.embeddingDimension !== PRODUCT_V1_EMBEDDING_DIMENSION
    || bank.embeddingDtype !== 'int8'
    || bank.seeds.some((seed) => !Number.isInteger(seed.rowIndex) || !seed.broadCategory)) {
    throw new Error('Search Seed Bank V2 manifest validation failed');
  }
  return bank;
}

export function loadProductV1SeedBank() {
  if (!seedBank) {
    const file = getProductV1SeedBankFile();
    if (!file.exists) throw new Error('Search Seed Bank V2 未安装');
    seedBank = JSON.parse(file.textSync()) as CompactSeedBank;
  }
  return validateSeedBank(seedBank);
}

export function loadProductV1SeedBankAsync() {
  if (seedBank) return Promise.resolve(seedBank);
  if (!seedBankPromise) {
    seedBankPromise = Promise.resolve().then(async () => {
      const file = getProductV1SeedBankFile();
      if (!file.exists) throw new Error('Search Seed Bank V2 未安装');
      if (!(await validateProductV1AssetAsync(file, PRODUCT_V1_SEED_BANK_SPEC))) throw new Error('Search Seed Bank V2 校验失败');
      seedBank = validateSeedBank(JSON.parse(await file.text()) as CompactSeedBank);
      return seedBank;
    }).catch((error) => {
      seedBankPromise = null;
      throw error;
    });
  }
  return seedBankPromise;
}

export function loadProductV1SeedEmbeddings() {
  if (!seedEmbeddingsPromise) {
    seedEmbeddingsPromise = ensureProductV1RuntimeAssets()
      .then(async () => {
        const file = getProductV1SeedEmbeddingsFile();
        if (!(await validateProductV1AssetAsync(file, PRODUCT_V1_SEED_EMBEDDINGS_SPEC))) throw new Error('Search Seed Bank V2 向量文件校验失败');
        const [bytes, bank] = await Promise.all([file.bytes(), loadProductV1SeedBankAsync()]);
        const embeddings = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (embeddings.length !== bank.seedCount * bank.embeddingDimension) {
          throw new Error('Search Seed Bank V2 payload size mismatch');
        }
        return embeddings;
      });
  }
  return seedEmbeddingsPromise;
}

function topicGraphEmbeddingRowCount(graph: SearchTopicGraphCompactV1) {
  const rows = [
    ...graph.broadDomains.map((node) => node.centroidRowIndex),
    ...graph.leafTopics.map((node) => node.centroidRowIndex),
    ...graph.queries.map((query) => query.rowIndex),
  ];
  return rows.length ? Math.max(...rows) + 1 : 0;
}

function validateTopicGraph(graph: SearchTopicGraphCompactV1) {
  const activeQueryCount = graph.queries.filter((query) => query.enabled).length;
  if (graph.version !== 1
    || graph.embeddingDimension !== PRODUCT_V1_EMBEDDING_DIMENSION
    || graph.broadDomains.length !== 51
    || graph.leafTopics.length !== 456
    || graph.queries.length !== 2711
    || activeQueryCount !== PRODUCT_V1_SEED_COUNT) {
    throw new Error('Search Topic Graph V1 manifest validation failed');
  }
  return graph;
}

export function loadProductV1TopicGraph() {
  const file = getProductV1TopicGraphFile();
  if (!file.exists) return null;
  if (!topicGraph) topicGraph = JSON.parse(file.textSync()) as SearchTopicGraphCompactV1;
  return validateTopicGraph(topicGraph);
}

export function loadProductV1TopicGraphAsync() {
  if (topicGraph) return Promise.resolve(topicGraph);
  if (!topicGraphPromise) {
    topicGraphPromise = Promise.resolve().then(async () => {
      const file = getProductV1TopicGraphFile();
      if (!file.exists) return null;
      if (!(await validateProductV1AssetAsync(file, PRODUCT_V1_TOPIC_GRAPH_SPEC))) throw new Error('Search Topic Graph V1 文件校验失败');
      topicGraph = validateTopicGraph(JSON.parse(await file.text()) as SearchTopicGraphCompactV1);
      return topicGraph;
    }).catch((error) => {
      topicGraphPromise = null;
      throw error;
    });
  }
  return topicGraphPromise;
}

export function loadProductV1TopicGraphEmbeddings() {
  if (!topicGraphEmbeddingsPromise) {
    topicGraphEmbeddingsPromise = Promise.resolve().then(async () => {
      const graph = await loadProductV1TopicGraphAsync();
      const file = getProductV1TopicGraphEmbeddingsFile();
      if (!graph || !file.exists) return null;
      if (!(await validateProductV1AssetAsync(file, PRODUCT_V1_TOPIC_GRAPH_EMBEDDINGS_SPEC))) throw new Error('Search Topic Graph V1 向量文件校验失败');
      const bytes = await file.bytes();
      const embeddings = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const expectedLength = topicGraphEmbeddingRowCount(graph) * graph.embeddingDimension;
      if (embeddings.length !== expectedLength) {
        throw new Error('Search Topic Graph V1 payload size mismatch');
      }
      return embeddings;
    });
  }
  return topicGraphEmbeddingsPromise;
}

export function resetProductV1AssetCache() {
  seedBank = null;
  seedBankPromise = null;
  seedEmbeddingsPromise = null;
  topicGraph = null;
  topicGraphPromise = null;
  topicGraphEmbeddingsPromise = null;
}
