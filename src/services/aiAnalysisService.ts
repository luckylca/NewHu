import {
    buildAiAnalysisMessages,
    buildAiChatCompletionsUrl,
    buildAiModelsUrl,
    parseAiAnalysisResult,
    parseAiModelList,
    type AiAnalysisInput,
} from '@/src/services/aiAnalysisCore';

type AiConnection = {
    baseUrl: string;
    apiKey: string;
};

async function readError(response: Response) {
    try {
        const data = await response.json() as any;
        return String(data?.error?.message || data?.message || `HTTP ${response.status}`);
    } catch {
        return `HTTP ${response.status}`;
    }
}

function authHeaders(apiKey: string) {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };
    const key = apiKey.trim();
    if (key) headers.Authorization = `Bearer ${key}`;
    return headers;
}

export async function fetchAiAnalysisModels(
    connection: AiConnection,
    signal?: AbortSignal,
) {
    const response = await fetch(buildAiModelsUrl(connection.baseUrl), {
        method: 'GET',
        headers: authHeaders(connection.apiKey),
        signal,
    });
    if (!response.ok) throw new Error(`获取模型失败：${await readError(response)}`);

    const models = parseAiModelList(await response.json());
    if (!models.length) throw new Error('接口返回成功，但没有识别到模型列表');
    return models;
}

function messageText(payload: any) {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((item) => typeof item === 'string' ? item : item?.text || '')
            .filter(Boolean)
            .join('\n');
    }
    if (typeof payload?.output_text === 'string') return payload.output_text;
    return '';
}

export async function analyzeContentWithAi(
    connection: AiConnection & { model: string },
    input: AiAnalysisInput,
    signal?: AbortSignal,
) {
    const model = connection.model.trim();
    if (!model) throw new Error('请先选择模型');

    const response = await fetch(buildAiChatCompletionsUrl(connection.baseUrl), {
        method: 'POST',
        headers: authHeaders(connection.apiKey),
        signal,
        body: JSON.stringify({
            model,
            messages: buildAiAnalysisMessages(input),
            temperature: 0.2,
            stream: false,
        }),
    });

    if (!response.ok) throw new Error(`AI 分析失败：${await readError(response)}`);
    const payload = await response.json();
    const text = messageText(payload);
    if (!text) throw new Error('AI 接口没有返回可读取的文本');
    return parseAiAnalysisResult(text);
}
