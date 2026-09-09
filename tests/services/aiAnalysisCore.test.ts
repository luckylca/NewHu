import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildAiChatCompletionsUrl,
    buildAiAnalysisMessages,
    buildAiModelsUrl,
    normalizeAiBaseUrl,
    parseAiAnalysisResult,
    parseAiModelList,
} from '../../src/services/aiAnalysisCore';
import { analyzeContentWithAi, fetchAiAnalysisModels } from '../../src/services/aiAnalysisService';

test('AI analysis normalizes OpenAI-compatible base URLs', () => {
    assert.equal(normalizeAiBaseUrl(' https://example.com/v1/ '), 'https://example.com/v1');
    assert.equal(buildAiModelsUrl('https://example.com/v1/'), 'https://example.com/v1/models');
    assert.equal(buildAiChatCompletionsUrl('https://example.com/v1'), 'https://example.com/v1/chat/completions');
    assert.throws(() => normalizeAiBaseUrl('file:///tmp/api'), /http/);
});

test('AI analysis parses common model list response shapes and deduplicates', () => {
    assert.deepEqual(
        parseAiModelList({ data: [{ id: 'gpt-b' }, { id: 'gpt-a' }, { id: 'gpt-a' }] }),
        ['gpt-a', 'gpt-b'],
    );
    assert.deepEqual(
        parseAiModelList({ models: ['model-z', { name: 'model-x' }] }),
        ['model-x', 'model-z'],
    );
});

test('AI analysis parses fenced JSON and clamps metric scores', () => {
    const fenced = '```json\n' + JSON.stringify({
        summary: '总结',
        one_line_summary: '一句话总结',
        keywords: ['A', 'B'],
        core_points: ['观点1'],
        counter_points: ['反例1'],
        audience: ['适合人群1'],
        information_density: { score: 108, reason: '高' },
        collectionValue: { score: 73.4, reason: '值得' },
        ai_writing_risk: { score: -2, reason: '仅文本特征' },
        content_quality: {
            structure_clarity: { score: 91, reason: '层次清楚' },
            clickbait_risk: { score: 18, reason: '标题基本克制' },
            ad_risk: { score: 7, reason: '无明显推广' },
            templated_risk: { score: 33, reason: '有少量套话' },
        },
        evaluation: '评价',
        cautions: ['需核实'],
    }) + '\n```';
    const result = parseAiAnalysisResult(fenced);
    assert.equal(result.summary, '总结');
    assert.equal(result.oneLineSummary, '一句话总结');
    assert.deepEqual(result.corePoints, ['观点1']);
    assert.deepEqual(result.counterPoints, ['反例1']);
    assert.deepEqual(result.suitableFor, ['适合人群1']);
    assert.equal(result.informationDensity.score, 100);
    assert.equal(result.collectionValue.score, 73);
    assert.equal(result.aiWritingRisk.score, 0);
    assert.equal(result.contentQuality?.structureClarity.score, 91);
    assert.equal(result.contentQuality?.clickbaitRisk.score, 18);
    assert.equal(result.contentQuality?.adRisk.score, 7);
    assert.equal(result.contentQuality?.templatedRisk.score, 33);
    assert.deepEqual(result.cautions, ['需核实']);
});

test('AI analysis rejects non-JSON model output', () => {
    assert.throws(() => parseAiAnalysisResult('普通自然语言回答'), /有效 JSON/);
});

test('AI analysis prompt requests the second-version summary fields in one response', () => {
    const messages = buildAiAnalysisMessages({
        contentType: 'article',
        title: '测试文章',
        authorName: '作者',
        text: '正文内容',
    });
    const prompt = messages[1].content;
    assert.match(prompt, /oneLineSummary/);
    assert.match(prompt, /严格3条核心观点/);
    assert.match(prompt, /counterPoints/);
    assert.match(prompt, /suitableFor/);
    assert.match(prompt, /反方观点、反例或主要质疑/);
    assert.match(prompt, /contentQuality/);
    assert.match(prompt, /structureClarity/);
    assert.match(prompt, /clickbaitRisk/);
    assert.match(prompt, /adRisk/);
    assert.match(prompt, /templatedRisk/);
});

test('AI analysis model fetch uses the configured endpoint and bearer key', async () => {
    const originalFetch = globalThis.fetch;
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        seenUrl = String(input);
        seenInit = init;
        return new Response(JSON.stringify({
            data: [{ id: 'model-b' }, { id: 'model-a' }],
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    try {
        const models = await fetchAiAnalysisModels({
            baseUrl: 'https://example.com/v1/',
            apiKey: 'secret-key',
        });
        assert.deepEqual(models, ['model-a', 'model-b']);
        assert.equal(seenUrl, 'https://example.com/v1/models');
        assert.equal(seenInit?.method, 'GET');
        const headers = new Headers(seenInit?.headers);
        assert.equal(headers.get('Authorization'), 'Bearer secret-key');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('AI analysis chat request sends model and messages then parses the JSON result', async () => {
    const originalFetch = globalThis.fetch;
    let seenUrl = '';
    let seenBody: any = null;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        seenUrl = String(input);
        seenBody = JSON.parse(String(init?.body ?? '{}'));
        return new Response(JSON.stringify({
            choices: [{
                message: {
                    content: JSON.stringify({
                        summary: '测试总结',
                        oneLineSummary: '一句话测试总结',
                        keywords: ['测试'],
                        corePoints: ['核心观点'],
                        counterPoints: ['反方观点'],
                        suitableFor: ['目标读者'],
                        informationDensity: { score: 80, reason: '信息集中' },
                        collectionValue: { score: 70, reason: '可回看' },
                        aiWritingRisk: { score: 20, reason: '仅有少量模板化特征' },
                        contentQuality: {
                            structureClarity: { score: 88, reason: '结构清晰' },
                            clickbaitRisk: { score: 12, reason: '标题克制' },
                            adRisk: { score: 4, reason: '无推广' },
                            templatedRisk: { score: 24, reason: '模板化较低' },
                        },
                        evaluation: '逻辑清楚',
                        cautions: ['核实来源'],
                    }),
                },
            }],
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    try {
        const result = await analyzeContentWithAi(
            {
                baseUrl: 'https://example.com/v1',
                apiKey: 'secret-key',
                model: 'model-a',
            },
            {
                contentType: 'answer',
                title: '测试标题',
                authorName: '测试作者',
                text: '这是一段用于验证请求体的正文。',
            },
        );
        assert.equal(seenUrl, 'https://example.com/v1/chat/completions');
        assert.equal(seenBody.model, 'model-a');
        assert.equal(seenBody.stream, false);
        assert.equal(seenBody.temperature, 0.2);
        assert.equal(Array.isArray(seenBody.messages), true);
        assert.match(seenBody.messages[1].content, /测试标题/);
        assert.match(seenBody.messages[1].content, /用于验证请求体/);
        assert.equal(result.summary, '测试总结');
        assert.equal(result.oneLineSummary, '一句话测试总结');
        assert.deepEqual(result.counterPoints, ['反方观点']);
        assert.deepEqual(result.suitableFor, ['目标读者']);
        assert.equal(result.informationDensity.score, 80);
        assert.equal(result.aiWritingRisk.score, 20);
        assert.equal(result.contentQuality?.structureClarity.score, 88);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
