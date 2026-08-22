import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { articleText, tokenizeProductV1 } from './tokenizer';
import { loadProductV1ModelPath } from './assets';
import { PRODUCT_V1_EMBEDDING_DIMENSION } from './constants';

let sessionPromise: Promise<InferenceSession> | null = null;

export function resetProductV1Encoder() {
  sessionPromise = null;
}

function getSession() {
  if (!sessionPromise) {
    sessionPromise = loadProductV1ModelPath().then((modelPath) => InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    }));
  }
  return sessionPromise;
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>) {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += Number(a[index]) * Number(b[index]);
    normA += Number(a[index]) ** 2;
    normB += Number(b[index]) ** 2;
  }
  return dot / Math.sqrt(Math.max(normA * normB, 1e-12));
}

export async function encodeText(text: string): Promise<Float32Array> {
  const session = await getSession();
  const input = tokenizeProductV1(text);
  const output = await session.run({
    input_ids: new Tensor('int64', input.inputIds, [1, 256]),
    attention_mask: new Tensor('int64', input.attentionMask, [1, 256]),
  });
  const data = output.embedding?.data;
  if (!data || data.length !== PRODUCT_V1_EMBEDDING_DIMENSION) {
    throw new Error('Tiny Encoder V1 returned an invalid embedding');
  }
  return Float32Array.from(data as ArrayLike<number>);
}

export function encodeArticle(article: { title: string; excerpt: string }) {
  return encodeText(articleText(article.title, article.excerpt));
}

export async function verifyProductV1Encoder() {
  const embedding = await encodeText('机器人控制 VLA');
  const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || Math.abs(norm - 1) >= 5e-4) {
    throw new Error(`Tiny Encoder V1 norm check failed: ${norm}`);
  }
  return norm;
}
