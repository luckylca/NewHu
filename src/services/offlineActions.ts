import { cancelLikeComment, cancelVoteupAnswer, cancelVoteupArticle, likeComment, voteupAnswer, voteupArticle } from '@/src/api/ZhihuApi';
import { enqueueAction } from '@/src/db/repositories/outboxRepository';
import { updateCommentVote } from '@/src/db/repositories/commentRepository';
import { upsertContent } from '@/src/db/repositories/contentRepository';
import { getNetworkStatus } from '@/src/stores/useNetworkStore';
import type { FeedDetail, FeedType } from '@/src/types/zhihu';

export async function setContentVote(content: FeedDetail, type: FeedType, voted: boolean) {
    const nextCount = Math.max(0, Number(content.voteCount || 0) + (voted === Boolean(content.voted) ? 0 : voted ? 1 : -1));
    const next = { ...content, voted, voteCount: nextCount };
    await upsertContent(next, type, { voted, cacheState: 'transient' });
    if (getNetworkStatus() !== 'online') {
        await enqueueAction({ actionType: 'SET_CONTENT_VOTE', targetType: type, targetId: content.id, payload: { voted } });
        return next;
    }
    try {
        if (type === 'answer') {
            if (voted) await voteupAnswer(content.id); else await cancelVoteupAnswer(content.id);
        } else {
            if (voted) await voteupArticle(content.id); else await cancelVoteupArticle(content.id);
        }
    } catch (error) {
        if (getNetworkStatus() !== 'online' || /network|timeout|fetch|offline|internet/i.test(error instanceof Error ? error.message : String(error))) {
            await enqueueAction({ actionType: 'SET_CONTENT_VOTE', targetType: type, targetId: content.id, payload: { voted } });
        }
        throw error;
    }
    return next;
}

export async function setCommentVote(commentId: string, liked: boolean, voteCount: number) {
    await updateCommentVote(commentId, liked, voteCount);
    if (getNetworkStatus() !== 'online') {
        await enqueueAction({ actionType: 'SET_COMMENT_VOTE', targetType: 'comment', targetId: commentId, payload: { liked } });
        return;
    }
    try {
        if (liked) await likeComment(commentId); else await cancelLikeComment(commentId);
    } catch (error) {
        if (getNetworkStatus() !== 'online' || /network|timeout|fetch|offline|internet/i.test(error instanceof Error ? error.message : String(error))) {
            await enqueueAction({ actionType: 'SET_COMMENT_VOTE', targetType: 'comment', targetId: commentId, payload: { liked } });
        }
        throw error;
    }
}
