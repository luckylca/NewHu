export type AiAnalysisMetric = {
    score: number;
    reason: string;
};

export type AiAnalysisResult = {
    oneLineSummary: string;
    summary: string;
    keywords: string[];
    corePoints: string[];
    counterPoints: string[];
    suitableFor: string[];
    informationDensity: AiAnalysisMetric;
    collectionValue: AiAnalysisMetric;
    aiWritingRisk: AiAnalysisMetric;
    evaluation: string;
    cautions: string[];
};

export type AiAnalysisInput = {
    contentType: 'answer' | 'article';
    title: string;
    authorName?: string;
    text: string;
};

export function normalizeAiBaseUrl(input: string) {
    const trimmed = input.trim().replace(/\/+$/g, '');
    if (!trimmed) throw new Error('请填写 Base URL');

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error('Base URL 格式不正确');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Base URL 必须使用 http 或 https');
    }
    return trimmed;
}

export function buildAiModelsUrl(baseUrl: string) {
    return `${normalizeAiBaseUrl(baseUrl)}/models`;
}

export function buildAiChatCompletionsUrl(baseUrl: string) {
    return `${normalizeAiBaseUrl(baseUrl)}/chat/completions`;
}

function modelId(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object') return '';
    const item = value as Record<string, unknown>;
    for (const key of ['id', 'name', 'model']) {
        if (typeof item[key] === 'string' && item[key]) return String(item[key]).trim();
    }
    return '';
}

export function parseAiModelList(payload: unknown) {
    let items: unknown[] = [];
    if (Array.isArray(payload)) {
        items = payload;
    } else if (payload && typeof payload === 'object') {
        const data = payload as Record<string, unknown>;
        if (Array.isArray(data.data)) items = data.data;
        else if (Array.isArray(data.models)) items = data.models;
        else if (Array.isArray(data.items)) items = data.items;
    }

    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        const id = modelId(item);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        result.push(id);
    }
    return result.sort((a, b) => a.localeCompare(b));
}

function clampScore(value: unknown) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function asString(value: unknown, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function asStringArray(value: unknown, max = 8) {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        const text = asString(item);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        result.push(text);
        if (result.length >= max) break;
    }
    return result;
}

function metric(value: unknown): AiAnalysisMetric {
    const data = value && typeof value === 'object'
        ? value as Record<string, unknown>
        : {};
    return {
        score: clampScore(data.score),
        reason: asString(data.reason),
    };
}

function extractJsonObject(text: string) {
    const unfenced = text
        .replace(/^\s*\x60\x60\x60(?:json)?\s*/i, '')
        .replace(/\s*\x60\x60\x60\s*$/i, '')
        .trim();
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI 返回结果不是有效 JSON');
    return unfenced.slice(start, end + 1);
}

export function parseAiAnalysisResult(raw: string): AiAnalysisResult {
    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
    } catch (error) {
        if (error instanceof Error && error.message === 'AI 返回结果不是有效 JSON') throw error;
        throw new Error('AI 返回结果无法解析');
    }

    const informationDensity = parsed.informationDensity ?? parsed.information_density;
    const collectionValue = parsed.collectionValue ?? parsed.collection_value;
    const aiWritingRisk = parsed.aiWritingRisk ?? parsed.ai_writing_risk;
    const corePoints = parsed.corePoints ?? parsed.core_points;
    const oneLineSummary = parsed.oneLineSummary ?? parsed.one_line_summary;
    const counterPoints = parsed.counterPoints ?? parsed.counter_points ?? parsed.counterarguments;
    const suitableFor = parsed.suitableFor ?? parsed.suitable_for ?? parsed.audience;

    return {
        oneLineSummary: asString(oneLineSummary),
        summary: asString(parsed.summary),
        keywords: asStringArray(parsed.keywords, 8),
        corePoints: asStringArray(corePoints, 3),
        counterPoints: asStringArray(counterPoints, 3),
        suitableFor: asStringArray(suitableFor, 4),
        informationDensity: metric(informationDensity),
        collectionValue: metric(collectionValue),
        aiWritingRisk: metric(aiWritingRisk),
        evaluation: asString(parsed.evaluation),
        cautions: asStringArray(parsed.cautions, 6),
    };
}

export function buildAiAnalysisMessages(input: AiAnalysisInput) {
    const body = input.text.trim().slice(0, 40_000);
    return [
        {
            role: 'system',
            content: [
                '你是严谨的中文内容分析助手。',
                '只分析文本本身，不推断作者真实身份。',
                '“AI 写作特征风险”只表示文本呈现出的写作特征，不代表作者一定使用了 AI。',
                '必须只返回 JSON，不要使用 Markdown 代码块。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: `请分析下面这篇知乎${input.contentType === 'answer' ? '回答' : '文章'}。

标题：${input.title}
作者：${input.authorName || '未知'}

正文：
${body}

请返回以下 JSON：
{
  "oneLineSummary": "一句话总结，尽量不超过45字",
  "summary": "100-220字总结",
  "keywords": ["3-8个关键词"],
  "corePoints": ["严格3条核心观点"],
  "counterPoints": ["1-3条反方观点、反例或主要质疑；不要为了反对而反对"],
  "suitableFor": ["2-4类适合阅读的人群或使用场景"],
  "informationDensity": {"score": 0-100, "reason": "解释"},
  "collectionValue": {"score": 0-100, "reason": "解释"},
  "aiWritingRisk": {"score": 0-100, "reason": "仅根据文本写作特征解释，不推断作者身份"},
  "evaluation": "对逻辑、证据、表达和适用范围的综合评价",
  "cautions": ["信息缺口、证据不足或需要核实的点"]
}`,
        },
    ];
}
