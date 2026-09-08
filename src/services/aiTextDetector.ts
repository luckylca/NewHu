import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import detectorModelAsset from '../../assets/ai-detector/tfidf_opening_192_plus_nlpcc.taid';
import {
    AI_TEXT_CONSERVATIVE_THRESHOLD,
    AI_TEXT_MODEL_ENTRY_COUNT,
    AI_TEXT_MODEL_MAX_CODE_POINTS,
    TaidTfidfModel,
} from './aiTextDetectorCore';

export { AI_TEXT_CONSERVATIVE_THRESHOLD } from './aiTextDetectorCore';

const EXPECTED_MODEL_BYTES = 1_464_732;
const MAX_CACHE_ENTRIES = 500;

let modelPromise: Promise<TaidTfidfModel> | null = null;
const scoreCache = new Map<string, { sample: string; score: number }>();

function cacheSample(text: unknown) {
    return Array.from(text == null ? '' : String(text)).slice(0, AI_TEXT_MODEL_MAX_CODE_POINTS).join('');
}

async function loadBundledModel() {
    const asset = Asset.fromModule(detectorModelAsset);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error('AI 检测模型资源不可用');

    const file = new File(uri);
    const bytes = await file.bytes();
    if (bytes.byteLength !== EXPECTED_MODEL_BYTES) {
        throw new Error(`AI 检测模型大小异常：${bytes.byteLength}`);
    }

    const model = TaidTfidfModel.fromBytes(bytes);
    if (model.entryCount !== AI_TEXT_MODEL_ENTRY_COUNT || model.maxCodePoints !== AI_TEXT_MODEL_MAX_CODE_POINTS) {
        throw new Error('AI 检测模型版本不匹配');
    }
    return model;
}

export function ensureAiTextDetectorLoaded() {
    if (!modelPromise) {
        modelPromise = loadBundledModel().catch((error) => {
            modelPromise = null;
            throw error;
        });
    }
    return modelPromise;
}

export async function detectAiText(text: unknown) {
    const model = await ensureAiTextDetectorLoaded();
    return model.predictScore(text);
}

export async function detectAiTextCached(contentKey: string, text: unknown) {
    const sample = cacheSample(text);
    const cached = scoreCache.get(contentKey);
    if (cached?.sample === sample) return cached.score;

    const score = await detectAiText(text);
    scoreCache.set(contentKey, { sample, score });
    if (scoreCache.size > MAX_CACHE_ENTRIES) {
        const oldest = scoreCache.keys().next().value;
        if (oldest != null) scoreCache.delete(oldest);
    }
    return score;
}

export function clearAiTextDetectionCache() {
    scoreCache.clear();
}

export function isSuspiciousAiScore(score: number, threshold = AI_TEXT_CONSERVATIVE_THRESHOLD) {
    return score >= threshold;
}
