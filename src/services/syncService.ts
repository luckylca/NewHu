import { cancelLikeComment, cancelVoteupAnswer, cancelVoteupArticle, getApiInstance, likeComment, submitComment, voteupAnswer, voteupArticle } from '@/src/api/ZhihuApi';
import { useUserStore } from '@/src/stores/useUserStore';
import { getNetworkStatus } from '@/src/stores/useNetworkStore';
import { getPendingAction, listPendingActions, markActionResult, markActionRetry, markActionSyncing } from '@/src/db/repositories/outboxRepository';
import { replaceLocalCommentId } from '@/src/db/repositories/commentRepository';
import type { PendingAction } from '@/src/db/types';
import { notify } from '@/src/stores/useNotificationStore';

let syncing = false;

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function isAuthError(error: unknown) {
    return /401|403|登录状态|请求被拒绝|Cookie/i.test(errorMessage(error));
}

function isNetworkError(error: unknown) {
    return /network|network request failed|timeout|fetch|offline|internet/i.test(errorMessage(error));
}

function serverCommentId(result: any) {
    const id = result?.id ?? result?.comment?.id ?? result?.data?.id;
    return id == null ? '' : String(id);
}

async function syncAction(action: PendingAction) {
    const payload = action.payload;
    if (action.actionType === 'SET_CONTENT_VOTE') {
        const voted = Boolean(payload.voted);
        if (action.targetType === 'answer') return voted ? voteupAnswer(action.targetId) : cancelVoteupAnswer(action.targetId);
        return voted ? voteupArticle(action.targetId) : cancelVoteupArticle(action.targetId);
    }
    if (action.actionType === 'SET_COMMENT_VOTE') {
        return Boolean(payload.liked) ? likeComment(action.targetId) : cancelLikeComment(action.targetId);
    }
    if (action.actionType === 'CREATE_COMMENT' || action.actionType === 'CREATE_REPLY') {
        const result = await submitComment({
            contentType: String(payload.contentType),
            contentId: String(payload.contentId),
            text: String(payload.text),
            replyCommentId: payload.replyCommentId ? String(payload.replyCommentId) : undefined,
        });
        const id = serverCommentId(result);
        if (!id) throw new Error('发表评论成功但未返回服务器评论 ID，请手动确认后重试');
        await replaceLocalCommentId(action.targetId, id);
        return result;
    }
}

export async function syncOutbox(options: { silent?: boolean } = {}) {
    if (syncing || getNetworkStatus() !== 'online') return { synced: 0, failed: 0 };
    const cookies = useUserStore.getState().cookies;
    if (!cookies) return { synced: 0, failed: 0 };
    syncing = true;
    let synced = 0;
    let failed = 0;
    try {
        getApiInstance(cookies);
        const actions = await listPendingActions();
        const completed = new Set<string>();
        for (const action of actions) {
            if (action.status === 'needs_user_action') continue;
            if (action.dependsOnActionId && !completed.has(action.dependsOnActionId)) continue;
            await markActionSyncing(action.id);
            try {
                // A preceding local-comment sync may have replaced IDs in the
                // persisted payload; reload it before sending a dependent reply.
                await syncAction((await getPendingAction(action.id)) || action);
                await markActionResult(action.id, 'synced');
                completed.add(action.id);
                synced += 1;
            } catch (error) {
                failed += 1;
                if (isAuthError(error)) await markActionResult(action.id, 'needs_user_action', errorMessage(error));
                else if (isNetworkError(error) && (action.actionType === 'CREATE_COMMENT' || action.actionType === 'CREATE_REPLY')) {
                    await markActionResult(action.id, 'needs_user_action', '提交结果未知，请确认后再重试，避免重复发表');
                } else if (isNetworkError(error)) await markActionRetry(action.id, errorMessage(error));
                else if ((action.actionType === 'CREATE_COMMENT' || action.actionType === 'CREATE_REPLY') && /未返回服务器评论 ID/i.test(errorMessage(error))) {
                    await markActionResult(action.id, 'needs_user_action', errorMessage(error));
                }
                else await markActionResult(action.id, 'failed', errorMessage(error));
            }
        }
        if (!options.silent && failed > 0) notify({ message: '部分离线操作同步失败', duration: 5000, actionLabel: '稍后重试' });
        return { synced, failed };
    } finally {
        syncing = false;
    }
}
