export const AI_TEXT_MODEL_SHA256 = '9a504fb699d335836737a54fbdd839f3c9d2e3d48c0c2fc3dec2ff300ccc4300';
export const AI_TEXT_MODEL_ENTRY_COUNT = 80_000;
export const AI_TEXT_MODEL_MAX_CODE_POINTS = 192;
export const AI_TEXT_CONSERVATIVE_THRESHOLD = 0.6648456937028345;

export type AiTextDetectionSensitivity = 'conservative' | 'balanced' | 'sensitive';

// 三档全部来自冻结模型报告中的 validation-selected operating points：
// <=1% / <=2% / <=5% Human-FPR budget。固定内部测试上的实际 Human FPR
// 约为 1.00% / 1.85% / 4.85%；跨领域或外部分布下可能明显更高。
export const AI_TEXT_SENSITIVITY_THRESHOLDS: Record<AiTextDetectionSensitivity, number> = {
    conservative: AI_TEXT_CONSERVATIVE_THRESHOLD,
    balanced: 0.5137511455,
    sensitive: 0.2917528562,
};

const TAIDTF1_MAGIC = [0x54, 0x41, 0x49, 0x44, 0x54, 0x46, 0x31, 0x00] as const;
const HEADER_SIZE = 20;

function decodeUtf8(bytes: Uint8Array, start: number, length: number) {
    const end = start + length;
    let cursor = start;
    let result = '';

    while (cursor < end) {
        const first = bytes[cursor++];
        if (first < 0x80) {
            result += String.fromCodePoint(first);
            continue;
        }

        let codePoint = 0;
        let continuationCount = 0;
        if ((first & 0xe0) === 0xc0) {
            codePoint = first & 0x1f;
            continuationCount = 1;
        } else if ((first & 0xf0) === 0xe0) {
            codePoint = first & 0x0f;
            continuationCount = 2;
        } else if ((first & 0xf8) === 0xf0) {
            codePoint = first & 0x07;
            continuationCount = 3;
        } else {
            throw new Error('TAIDTF1 contains invalid UTF-8');
        }

        if (cursor + continuationCount > end) {
            throw new Error('TAIDTF1 contains truncated UTF-8');
        }

        for (let index = 0; index < continuationCount; index += 1) {
            const next = bytes[cursor++];
            if ((next & 0xc0) !== 0x80) throw new Error('TAIDTF1 contains invalid UTF-8 continuation');
            codePoint = (codePoint << 6) | (next & 0x3f);
        }
        result += String.fromCodePoint(codePoint);
    }

    return result;
}

function stableSigmoid(logit: number) {
    if (logit >= 0) {
        const z = Math.exp(-logit);
        return 1 / (1 + z);
    }
    const z = Math.exp(logit);
    return z / (1 + z);
}

export function preprocessAiDetectorText(text: unknown, maxCodePoints = AI_TEXT_MODEL_MAX_CODE_POINTS) {
    const source = text == null ? '' : String(text);
    return Array.from(source)
        .slice(0, maxCodePoints)
        .join('')
        .toLowerCase()
        .replace(/\s\s+/gu, ' ');
}

export class TaidTfidfModel {
    readonly entryCount: number;
    readonly maxCodePoints: number;
    readonly intercept: number;

    private readonly featureIndex: Map<string, number>;
    private readonly idf: Float32Array;
    private readonly coefficients: Float32Array;

    private constructor(
        entryCount: number,
        maxCodePoints: number,
        intercept: number,
        featureIndex: Map<string, number>,
        idf: Float32Array,
        coefficients: Float32Array,
    ) {
        this.entryCount = entryCount;
        this.maxCodePoints = maxCodePoints;
        this.intercept = intercept;
        this.featureIndex = featureIndex;
        this.idf = idf;
        this.coefficients = coefficients;
    }

    static fromBytes(bytes: Uint8Array) {
        if (bytes.byteLength < HEADER_SIZE) throw new Error('TAIDTF1 model is too small');
        for (let index = 0; index < TAIDTF1_MAGIC.length; index += 1) {
            if (bytes[index] !== TAIDTF1_MAGIC[index]) throw new Error('Invalid TAIDTF1 magic');
        }

        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const entryCount = view.getUint32(8, true);
        const maxCodePoints = view.getUint32(12, true);
        const intercept = view.getFloat32(16, true);
        const featureIndex = new Map<string, number>();
        const idf = new Float32Array(entryCount);
        const coefficients = new Float32Array(entryCount);

        let offset = HEADER_SIZE;
        for (let index = 0; index < entryCount; index += 1) {
            if (offset + 2 > bytes.byteLength) throw new Error(`Unexpected TAIDTF1 EOF at entry ${index}`);
            const tokenLength = view.getUint16(offset, true);
            offset += 2;

            const valuesEnd = offset + tokenLength + 8;
            if (valuesEnd > bytes.byteLength) throw new Error(`Unexpected TAIDTF1 entry length at ${index}`);

            const token = decodeUtf8(bytes, offset, tokenLength);
            offset += tokenLength;
            idf[index] = view.getFloat32(offset, true);
            coefficients[index] = view.getFloat32(offset + 4, true);
            offset += 8;
            featureIndex.set(token, index);
        }

        if (offset !== bytes.byteLength) {
            throw new Error(`TAIDTF1 parser stopped at ${offset}, file length is ${bytes.byteLength}`);
        }

        return new TaidTfidfModel(entryCount, maxCodePoints, intercept, featureIndex, idf, coefficients);
    }

    decisionFunction(text: unknown) {
        const chars = Array.from(preprocessAiDetectorText(text, this.maxCodePoints));
        const counts = new Map<number, number>();

        for (let n = 2; n <= 5; n += 1) {
            if (chars.length < n) continue;
            for (let start = 0; start <= chars.length - n; start += 1) {
                const feature = this.featureIndex.get(chars.slice(start, start + n).join(''));
                if (feature == null) continue;
                counts.set(feature, (counts.get(feature) ?? 0) + 1);
            }
        }

        if (counts.size === 0) return this.intercept;

        let normSquared = 0;
        const weighted: [index: number, value: number][] = [];
        for (const [index, count] of counts) {
            const tf = 1 + Math.log(count);
            const value = tf * this.idf[index];
            normSquared += value * value;
            weighted.push([index, value]);
        }

        if (normSquared <= 0) return this.intercept;
        const norm = Math.sqrt(normSquared);
        let logit = this.intercept;
        for (const [index, value] of weighted) {
            logit += (value / norm) * this.coefficients[index];
        }
        return logit;
    }

    predictScore(text: unknown) {
        return stableSigmoid(this.decisionFunction(text));
    }

    isLikelyAi(text: unknown, threshold = AI_TEXT_CONSERVATIVE_THRESHOLD) {
        return this.predictScore(text) >= threshold;
    }
}
