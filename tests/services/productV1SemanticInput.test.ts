import assert from 'node:assert/strict';
import test from 'node:test';
import { semanticExcerpt, semanticTitle } from '../../src/product-v1/semanticInput';
import type { FeedItem } from '../../src/types/zhihu';

function feedItem(overrides: Partial<FeedItem>): FeedItem {
    return {
        id: '1',
        title: '',
        authorName: '作者',
        authorUrlToken: '',
        authorAvatar: '',
        excerpt: '回答正文开头',
        updatedTime: 0,
        voteCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        content: '',
        questionTitle: '',
        questionId: '',
        questionAuthorName: '',
        questionAuthorAvatar: '',
        questionAuthorUrlToken: '',
        questionAnswerCount: 0,
        questionCreatedTime: 0,
        ...overrides,
    };
}

test('answer semantic input combines question detail with the answer body', () => {
    const item = feedItem({
        questionTitle: '如何评价某款手机？',
        questionExcerpt: '想听听真实用户的长期使用体验。',
        title: '如何评价某款手机？',
    });
    assert.equal(semanticTitle('answer', item), '如何评价某款手机？');
    assert.equal(
        semanticExcerpt('answer', item),
        '想听听真实用户的长期使用体验。\n回答正文开头',
    );
});

test('answer semantic input falls back to the answer body when question detail is missing', () => {
    const item = feedItem({ questionTitle: '问题标题' });
    assert.equal(semanticTitle('answer', item), '问题标题');
    assert.equal(semanticExcerpt('answer', item), '回答正文开头');
});

test('answer semantic title prefers the question title over the answer title', () => {
    const item = feedItem({ title: '回答自身标题', questionTitle: '问题标题' });
    assert.equal(semanticTitle('answer', item), '问题标题');
    const noQuestion = feedItem({ title: '回答自身标题' });
    assert.equal(semanticTitle('answer', noQuestion), '回答自身标题');
});

test('article semantic input ignores question fields', () => {
    const item = feedItem({
        title: '文章标题',
        excerpt: '文章摘要',
        questionTitle: '问题标题',
        questionExcerpt: '问题描述',
    });
    assert.equal(semanticTitle('article', item), '文章标题');
    assert.equal(semanticExcerpt('article', item), '文章摘要');
});

test('explicit body text overrides the item excerpt but keeps the question detail', () => {
    const item = feedItem({ questionExcerpt: '问题描述' });
    assert.equal(semanticExcerpt('answer', item, '覆盖正文'), '问题描述\n覆盖正文');
});
