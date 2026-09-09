import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type CommentInsightComment,
    buildCommentInsightStats,
    computeHighLikeThreshold,
    filterCommentsByInsight,
    isControversialComment,
    isSeriousDiscussionComment,
    mergeUniqueComments,
} from '../../src/utils/commentInsights';

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

test('comment insight threshold uses at least ten likes and adapts to the top quartile', () => {
    assert.equal(
        computeHighLikeThreshold([
            comment('1', { voteCount: 1 }),
            comment('2', { voteCount: 8 }),
            comment('3', { voteCount: 20 }),
            comment('4', { voteCount: 60 }),
        ]),
        20,
    );
    assert.equal(computeHighLikeThreshold([comment('1', { voteCount: 2 })]), 10);
});

test('comment insight filters content-author replies using API flags and identity fallback', () => {
    const comments = [
        comment('1', { authorName: '作者', authorUrlToken: 'author-token', isAuthorFromApi: false }),
        comment('2', { authorName: '路人' }),
        comment('3', { authorName: '作者本人', isAuthor: true }),
    ];
    assert.deepEqual(
        filterCommentsByInsight(comments, 'author', { name: '作者', urlToken: 'author-token' }).map((item) => item.id),
        ['1', '3'],
    );
});

test('controversial is a reply-to-like structural heuristic, not sentiment', () => {
    assert.equal(isControversialComment(comment('1', { voteCount: 2, childCommentCount: 8 })), true);
    assert.equal(isControversialComment(comment('2', { voteCount: 20, childCommentCount: 8 })), false);
});

test('serious discussion requires substantial text plus interaction', () => {
    const longText = '<p>' + '这是一个有论证过程的评论。'.repeat(10) + '</p>';
    assert.equal(isSeriousDiscussionComment(comment('1', { content: longText, voteCount: 4 })), true);
    assert.equal(isSeriousDiscussionComment(comment('2', { content: longText, voteCount: 0 })), false);
    assert.equal(isSeriousDiscussionComment(comment('3', { content: '<p>很短</p>', voteCount: 30 })), false);
});

test('comment insight stats and merge keep stable unique comments', () => {
    const comments = [
        comment('1', { voteCount: 12, isHot: true }),
        comment('2', { childCommentCount: 8, voteCount: 2 }),
    ];
    const stats = buildCommentInsightStats(comments);
    assert.equal(stats.total, 2);
    assert.equal(stats.highLike, 1);
    assert.equal(stats.controversial, 1);

    const merged = mergeUniqueComments(
        [comment('1', { voteCount: 2 })],
        [comment('1', { voteCount: 9 }), comment('2')],
    );
    assert.deepEqual(merged.map((item) => item.id), ['1', '2']);
    assert.equal(merged[0].voteCount, 9);
});
