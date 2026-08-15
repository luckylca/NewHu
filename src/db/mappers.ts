import type { CommentViewModel } from '@/src/components/CommentItem';
import type { FeedDetail, FeedItem, FeedType } from '@/src/types/zhihu';
import type { DbComment } from './types';

function getExcerpt(raw: any) {
    const direct = raw?.excerpt || raw?.intro || raw?.description;
    if (direct) return String(direct).trim();
    const excerpt = String(raw?.content || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
    return excerpt || '暂无简介';
}

export function normalizeContent(raw: any, type: FeedType, voted?: boolean): FeedDetail {
    const questionTitle = raw?.question?.title || '';
    const title = raw?.title || (type === 'answer' ? questionTitle : '') || '';
    return {
        id: String(raw?.id ?? ''),
        title,
        authorName: raw?.author?.name || '匿名用户',
        authorUrlToken: raw?.author?.url_token || '',
        authorAvatar: raw?.author?.avatar_url || '',
        excerpt: getExcerpt(raw),
        updatedTime: raw?.updated_time || raw?.updated || raw?.created || 0,
        voteCount: Number(raw?.voteup_count || 0),
        voted: voted ?? raw?.relationship?.voting === 1,
        favoriteCount: Number(raw?.favorite_count ?? raw?.favlists_count ?? 0),
        favorited: Boolean(raw?.relationship?.is_favorited ?? raw?.is_favorited ?? false),
        commentCount: Number(raw?.comment_count || 0),
        content: raw?.content || '',
        questionTitle: questionTitle || (type === 'answer' ? title : ''),
        questionId: String(raw?.question?.id || ''),
        questionAuthorName: raw?.question?.author?.name || '匿名用户',
        questionAuthorAvatar: raw?.question?.author?.avatar_url || '',
        questionAuthorUrlToken: raw?.question?.author?.url_token || '',
        questionAnswerCount: Number(raw?.question?.answer_count || 0),
        questionCreatedTime: Number(raw?.question?.created || 0),
    };
}

export function normalizeComment(raw: any, extra?: Partial<CommentViewModel>): CommentViewModel | null {
    if (!raw?.id) return null;
    return {
        id: String(raw.id),
        content: raw.content ?? '',
        createdTime: Number(raw.created_time || raw.created || 0),
        authorUrlToken: raw.author?.url_token,
        authorName: raw.author?.name || '匿名用户',
        authorAvatar: raw.author?.avatar_url,
        voteCount: Number(raw.like_count || 0),
        isVote: Boolean(raw.liked),
        isAuthor: Boolean(raw.is_author),
        isHot: Boolean(raw.hot),
        isTop: Boolean(raw.top),
        childCommentCount: Number(raw.child_comment_count || 0),
        replyToAuthorName: raw.reply_to_author?.name,
        ...extra,
    };
}

export function commentToDb(comment: CommentViewModel, contentId: string, contentType: FeedType, parentCommentId: string | null, cacheState: DbComment['cacheState'] = 'transient'): DbComment {
    return {
        ...comment,
        contentId,
        contentType,
        parentCommentId,
        rootCommentId: parentCommentId ? parentCommentId : comment.id,
        cacheState,
        syncStatus: comment.id.startsWith('local:') ? 'pending' : 'synced',
        localOnly: comment.id.startsWith('local:'),
    };
}

export function contentToItem(content: FeedDetail): FeedItem {
    const { voted: _voted, ...item } = content;
    return item;
}
