import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommentInsightComment } from '../../src/utils/commentInsights';
import { buildCommentQuality } from '../../src/utils/commentQuality';

function comment(
    id: string,
    options: Partial<CommentInsightComment> = {},
): CommentInsightComment {
    return {
        id,
        content: '<p>普通评论</p>',
        authorName: '用户',
        authorUrlToken: `u-${id}`,
        voteCount: 0,
        isAuthor: false,
        isAuthorFromApi: true,
        childCommentCount: 0,
        ...options,
    };
}

test('comment quality returns unavailable instead of a misleading zero score without samples', () => {
    assert.deepEqual(
        buildCommentQuality([], { totalCount: 12 }),
        {
            score: null,
            reason: '共 12 条评论，但当前没有可用评论样本',
            sampleSize: 0,
            totalCount: 12,
            source: 'none',
        },
    );
});

test('comment quality rewards substantial engaged discussion over short low-signal comments', () => {
    const strong = buildCommentQuality([
        comment('1', {
            content: '<p>' + '这是有依据、有解释、有推理过程的认真讨论。'.repeat(7) + '</p>',
            voteCount: 30,
            childCommentCount: 6,
            isHot: true,
        }),
        comment('2', {
            content: '<p>' + '补充另一组数据和边界条件，并解释为什么结论不能直接外推。'.repeat(5) + '</p>',
            voteCount: 15,
            childCommentCount: 3,
        }),
        comment('3', {
            content: '<p>' + '作者这里的假设需要结合场景理解，我补充一个反例。'.repeat(6) + '</p>',
            voteCount: 6,
            childCommentCount: 2,
            isAuthor: true,
        }),
    ], {
        totalCount: 30,
        source: 'network',
        contentAuthor: { name: '用户' },
    });

    const weak = buildCommentQuality([
        comment('1', { content: '<p>支持</p>' }),
        comment('2', { content: '<p>哈哈</p>' }),
        comment('3', { content: '<p>来了</p>' }),
    ], {
        totalCount: 30,
        source: 'cache',
    });

    assert.ok(strong.score != null && weak.score != null);
    assert.ok(strong.score > weak.score);
    assert.equal(strong.sampleSize, 3);
    assert.equal(strong.totalCount, 30);
    assert.match(strong.reason, /认真讨论/);
    assert.match(strong.reason, /样本较少/);
});

test('comment quality caps its sample to forty comments deterministically', () => {
    const comments = Array.from({ length: 60 }, (_, index) => comment(String(index), {
        content: '<p>' + '有效评论内容'.repeat(8) + '</p>',
        voteCount: index,
        childCommentCount: index % 3,
    }));

    const first = buildCommentQuality(comments, { totalCount: 60, source: 'cache' });
    const second = buildCommentQuality(comments, { totalCount: 60, source: 'cache' });
    assert.deepEqual(first, second);
    assert.equal(first.sampleSize, 40);
    assert.equal(first.totalCount, 60);
});
