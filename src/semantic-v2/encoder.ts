import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { loadSemanticV2SelectorPath } from './assets';
import { SEMANTIC_V2_MAX_LENGTH, tokenizeSemanticV2 } from './tokenizer';

export const SEMANTIC_V2_EMBEDDING_DIMENSION = 512;
const MAX_CACHE_ENTRIES = 768;
const MAX_BATCH_SIZE = 8;

let sessionPromise: Promise<InferenceSession> | null = null;
const embeddingCache = new Map<string, Float32Array>();

function getSession() {
  if (!sessionPromise) {
    sessionPromise = loadSemanticV2SelectorPath()
      .then((modelPath) => InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        executionMode: 'sequential',
        intraOpNumThreads: 1,
        interOpNumThreads: 1,
      }))
      .catch((error) => {
        sessionPromise = null;
        throw error;
      });
  }
  return sessionPromise;
}

function rememberEmbedding(text: string, embedding: Float32Array) {
  if (embeddingCache.has(text)) embeddingCache.delete(text);
  embeddingCache.set(text, embedding);
  while (embeddingCache.size > MAX_CACHE_ENTRIES) {
    const oldest = embeddingCache.keys().next().value;
    if (oldest == null) break;
    embeddingCache.delete(oldest);
  }
}

function normalizedRow(data: ArrayLike<number>, offset: number) {
  const row = new Float32Array(SEMANTIC_V2_EMBEDDING_DIMENSION);
  let normSq = 0;
  for (let i = 0; i < row.length; i += 1) {
    const value = Number(data[offset + i]);
    row[i] = value;
    normSq += value * value;
  }
  const invNorm = 1 / Math.sqrt(Math.max(normSq, 1e-12));
  for (let i = 0; i < row.length; i += 1) row[i] *= invNorm;
  return row;
}

async function encodeUncachedBatch(texts: string[]) {
  const session = await getSession();
  const inputIds = new BigInt64Array(texts.length * SEMANTIC_V2_MAX_LENGTH);
  const attentionMask = new BigInt64Array(texts.length * SEMANTIC_V2_MAX_LENGTH);

  texts.forEach((text, row) => {
    const tokenized = tokenizeSemanticV2(text);
    inputIds.set(tokenized.inputIds, row * SEMANTIC_V2_MAX_LENGTH);
    attentionMask.set(tokenized.attentionMask, row * SEMANTIC_V2_MAX_LENGTH);
  });

  const output = await session.run({
    input_ids: new Tensor('int64', inputIds, [texts.length, SEMANTIC_V2_MAX_LENGTH]),
    attention_mask: new Tensor('int64', attentionMask, [texts.length, SEMANTIC_V2_MAX_LENGTH]),
  });
  const data = output.embedding?.data;
  if (!data || data.length !== texts.length * SEMANTIC_V2_EMBEDDING_DIMENSION) {
    throw new Error('Semantic V2 selector returned an invalid embedding tensor');
  }

  return texts.map((_, row) => normalizedRow(data as ArrayLike<number>, row * SEMANTIC_V2_EMBEDDING_DIMENSION));
}

export async function encodeSemanticV2Texts(texts: string[]) {
  const output = new Array<Float32Array>(texts.length);
  const missing = new Map<string, number[]>();

  texts.forEach((text, index) => {
    const cached = embeddingCache.get(text);
    if (cached) {
      embeddingCache.delete(text);
      embeddingCache.set(text, cached);
      output[index] = cached;
      return;
    }
    const indexes = missing.get(text) ?? [];
    indexes.push(index);
    missing.set(text, indexes);
  });

  const uniqueMissing = [...missing.keys()];
  for (let start = 0; start < uniqueMissing.length; start += MAX_BATCH_SIZE) {
    const batchTexts = uniqueMissing.slice(start, start + MAX_BATCH_SIZE);
    const embeddings = await encodeUncachedBatch(batchTexts);
    batchTexts.forEach((text, batchIndex) => {
      const embedding = embeddings[batchIndex];
      rememberEmbedding(text, embedding);
      for (const targetIndex of missing.get(text) ?? []) output[targetIndex] = embedding;
    });
  }
  return output;
}

export function cosineSimilarity512(left: ArrayLike<number>, right: ArrayLike<number>) {
  if (left.length !== SEMANTIC_V2_EMBEDDING_DIMENSION || right.length !== SEMANTIC_V2_EMBEDDING_DIMENSION) return 0;
  let dot = 0;
  let leftSq = 0;
  let rightSq = 0;
  for (let i = 0; i < SEMANTIC_V2_EMBEDDING_DIMENSION; i += 1) {
    const a = Number(left[i]);
    const b = Number(right[i]);
    dot += a * b;
    leftSq += a * a;
    rightSq += b * b;
  }
  return dot / Math.sqrt(Math.max(leftSq * rightSq, 1e-12));
}

export function resetSemanticV2Encoder() {
  sessionPromise = null;
  embeddingCache.clear();
}
