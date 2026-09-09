import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildLocalSearchSnippet,
    localTextMatches,
    mergeLocalSearchSources,
    normalizeLocalSearchTerms,
    scoreLocalSearchText,
} from '../../src/utils/localSearch';

test('local search normalizes query terms and removes duplicates', () => {
    assert.deepEqual(
        normalizeLocalSearchTerms('  AI 机器人，ai  嵌入式 '),
        ['AI', '机器人', '嵌入式'],
    );
});

test('local search requires every query term while ignoring case', () => {
    assert.equal(localTextMatches('AI 机器人', '这是 AI 与机器人的文章'), true);
    assert.equal(localTextMatches('AI 量化', '这是 AI 与机器人的文章'), false);
});

test('local search ranks title matches above body-only matches', () => {
    const titleScore = scoreLocalSearchText('机器人', {
        title: '机器人入门',
        snippet: '普通正文',
    });
    const bodyScore = scoreLocalSearchText('机器人', {
        title: '普通标题',
        snippet: '正文介绍机器人',
    });
    assert.ok(titleScore > bodyScore);
});

test('local search builds a bounded snippet around the first hit', () => {
    const text = `${'前'.repeat(160)}机器人${'后'.repeat(160)}`;
    const snippet = buildLocalSearchSnippet(text, '机器人', 80);
    assert.ok(snippet.length <= 82);
    assert.ok(snippet.includes('机器人'));
});

test('local search source badges are deduplicated in stable priority order', () => {
    assert.deepEqual(
        mergeLocalSearchSources(['read', 'offline'], ['favorite', 'read']),
        ['favorite', 'offline', 'read'],
    );
});
