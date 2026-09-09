import type { CommentAuthorIdentity } from '@/src/utils/commentAuthor';
import { commentMatchesContentAuthor } from '@/src/utils/commentAuthor';

export type CommentInsightComment = {
    id: string;
    content: string;
    authorName?: string;
    authorUrlToken?: string;
    voteCount: number;
    isAuthor: boolean;
    isAuthorFromApi?: boolean;
    isHot?: boolean;
    childCommentCount: number;
};

export type CommentInsightFilter =
    | 'all'
    | 'author'
    | 'high_like'
    | 'controversial'
    | 'serious';

export type CommentInsightStats = {
    total: number;
    author: number;
    highLike: number;
    controversial: number;
    serious: number;
    highLikeThreshold: number;
};

export function isContentAuthorComment(
    comment: CommentInsightComment,
    contentAuthor?: CommentAuthorIdentity,
) {
    if (comment.isAuthorFromApi === true) return comment.isAuthor;
    return comment.isAuthor || commentMatchesContentAuthor(comment, contentAuthor);
}

function plainCommentText(html: string) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>(?=\s*)/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'");
}

export function commentPlainLength(comment: CommentInsightComment) {
    return plainCommentText(comment.content || '')
        .replace(/\s+/g, '')
        .length;
}

export function computeHighLikeThreshold(comments: CommentInsightComment[]) {
    const votes = comments
        .map((comment) => Math.max(0, Number(comment.voteCount || 0)))
        .sort((left, right) => left - right);
    if (!votes.length) return 10;

    const percentileIndex = Math.max(0, Math.ceil(votes.length * 0.75) - 1);
    const percentile = votes[percentileIndex] ?? 0;
    return Math.max(10, percentile);
}

export function isHighLikeComment(
    comment: CommentInsightComment,
    threshold: number,
) {
    return Boolean(comment.isHot) || Number(comment.voteCount || 0) >= threshold;
}

/**
 * Zhihu's comment payload does not expose down-votes. "Controversial" therefore
 * means a discussion-heavy thread whose replies substantially outnumber likes;
 * it is a structural signal, not sentiment classification.
 */
export function isControversialComment(comment: CommentInsightComment) {
    const replies = Math.max(0, Number(comment.childCommentCount || 0));
    const likes = Math.max(0, Number(comment.voteCount || 0));
    return replies >= 5 && replies >= Math.max(5, likes * 2);
}

export function isSeriousDiscussionComment(comment: CommentInsightComment) {
    const length = commentPlainLength(comment);
    const likes = Math.max(0, Number(comment.voteCount || 0));
    const replies = Math.max(0, Number(comment.childCommentCount || 0));

    return length >= 80 && (likes >= 3 || replies >= 2 || Boolean(comment.isHot));
}

export function buildCommentInsightStats(
    comments: CommentInsightComment[],
    contentAuthor?: CommentAuthorIdentity,
): CommentInsightStats {
    const highLikeThreshold = computeHighLikeThreshold(comments);
    return {
        total: comments.length,
        author: comments.filter((comment) => isContentAuthorComment(comment, contentAuthor)).length,
        highLike: comments.filter((comment) => isHighLikeComment(comment, highLikeThreshold)).length,
        controversial: comments.filter(isControversialComment).length,
        serious: comments.filter(isSeriousDiscussionComment).length,
        highLikeThreshold,
    };
}

export function filterCommentsByInsight(
    comments: CommentInsightComment[],
    filter: CommentInsightFilter,
    contentAuthor?: CommentAuthorIdentity,
) {
    if (filter === 'all') return comments;

    const threshold = computeHighLikeThreshold(comments);
    if (filter === 'author') {
        return comments.filter((comment) => isContentAuthorComment(comment, contentAuthor));
    }
    if (filter === 'high_like') {
        return comments.filter((comment) => isHighLikeComment(comment, threshold));
    }
    if (filter === 'controversial') {
        return comments.filter(isControversialComment);
    }
    return comments.filter(isSeriousDiscussionComment);
}

export function mergeUniqueComments(
    primary: CommentInsightComment[],
    secondary: CommentInsightComment[],
) {
    const map = new Map<string, CommentInsightComment>();
    for (const comment of [...primary, ...secondary]) {
        const current = map.get(comment.id);
        if (!current) {
            map.set(comment.id, comment);
            continue;
        }
        map.set(comment.id, {
            ...current,
            ...comment,
            isAuthor: current.isAuthor || comment.isAuthor,
            isAuthorFromApi: current.isAuthorFromApi || comment.isAuthorFromApi,
            voteCount: Math.max(current.voteCount, comment.voteCount),
            childCommentCount: Math.max(current.childCommentCount, comment.childCommentCount),
        });
    }
    return [...map.values()];
}
