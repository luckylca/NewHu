import {
    buildCommentInsightStats,
    commentPlainLength,
    type CommentInsightComment,
} from '@/src/utils/commentInsights';
import type { CommentAuthorIdentity } from '@/src/utils/commentAuthor';

export type CommentQualityResult = {
    score: number | null;
    reason: string;
    sampleSize: number;
    totalCount: number;
    source: 'cache' | 'network' | 'none';
};

function clampScore(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildCommentQuality(
    comments: CommentInsightComment[],
    options: {
        totalCount?: number;
        source?: CommentQualityResult['source'];
        contentAuthor?: CommentAuthorIdentity;
    } = {},
): CommentQualityResult {
    const sample = comments.slice(0, 40);
    const totalCount = Math.max(sample.length, Number(options.totalCount || 0));
    const source = sample.length ? (options.source || 'cache') : 'none';

    if (!sample.length) {
        return {
            score: null,
            reason: totalCount > 0
                ? `共 ${totalCount} 条评论，但当前没有可用评论样本`
                : '当前没有可用评论样本',
            sampleSize: 0,
            totalCount,
            source,
        };
    }

    const stats = buildCommentInsightStats(sample, options.contentAuthor);
    const lengths = sample.map(commentPlainLength);
    const substantial = lengths.filter((length) => length >= 30).length;
    const veryShort = lengths.filter((length) => length <= 8).length;
    const discussion = sample.filter((comment) => Number(comment.childCommentCount || 0) >= 2).length;

    const denominator = sample.length;
    const seriousRatio = stats.serious / denominator;
    const substantialRatio = substantial / denominator;
    const highLikeRatio = stats.highLike / denominator;
    const discussionRatio = discussion / denominator;
    const veryShortRatio = veryShort / denominator;

    const score = clampScore(
        35
        + seriousRatio * 30
        + substantialRatio * 15
        + highLikeRatio * 10
        + discussionRatio * 10
        + (stats.author > 0 ? 5 : 0)
        - veryShortRatio * 20,
    );

    const details = [
        `样本 ${sample.length}${totalCount > sample.length ? ` / 共 ${totalCount} 条` : ' 条'}`,
        `认真讨论 ${stats.serious}`,
        `高赞 ${stats.highLike}`,
        `有来回讨论 ${discussion}`,
    ];
    if (sample.length < 5) details.push('样本较少，仅供参考');

    return {
        score,
        reason: details.join(' · '),
        sampleSize: sample.length,
        totalCount,
        source,
    };
}
