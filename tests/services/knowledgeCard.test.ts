import assert from 'node:assert/strict';
import test from 'node:test';
import {
    MAX_KNOWLEDGE_TAGS,
    normalizeKnowledgeTags,
    parseKnowledgeTagsJson,
    stringifyKnowledgeTags,
} from '../../src/utils/knowledgeCard';

test('knowledge card tags split Chinese and English separators and deduplicate', () => {
    assert.deepEqual(
        normalizeKnowledgeTags('AI，机器人, ai；嵌入式 # 量化'),
        ['AI', '机器人', '嵌入式', '量化'],
    );
});

test('knowledge card tags are capped and round-trip through JSON', () => {
    const tags = Array.from({ length: 12 }, (_, index) => `标签${index}`);
    const normalized = normalizeKnowledgeTags(tags);
    assert.equal(normalized.length, MAX_KNOWLEDGE_TAGS);
    assert.deepEqual(parseKnowledgeTagsJson(stringifyKnowledgeTags(normalized)), normalized);
    assert.deepEqual(parseKnowledgeTagsJson('{bad json'), []);
});
