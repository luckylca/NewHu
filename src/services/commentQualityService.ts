import { getRootComments } from '@/src/api/ZhihuApi';
import { normalizeComment } from '@/src/db/mappers';
import {
    getCachedComments,
    getPageState,
    saveCommentPage,
} from '@/src/db/repositories/commentRepository';
import type { FeedType } from '@/src/types/zhihu';
import type { CommentAuthorIdentity } from '@/src/utils/commentAuthor';
import {
    buildCommentQuality,
    type CommentQualityResult,
} from '@/src/utils/commentQuality';
import type { CommentViewModel } from '@/src/components/CommentItem';

function nextOffset(nextUrl: unknown) {
    if (!nextUrl) return '';
    try {
        return new URL(String(nextUrl)).searchParams.get('offset') || '';
    } catch {
        return '';
    }
}

export async function loadCommentQuality(options: {
    contentId: string;
    contentType: FeedType;
    allowNetwork: boolean;
    totalCountHint?: number;
    contentAuthor?: CommentAuthorIdentity;
}): Promise<CommentQualityResult> {
    const { contentId, contentType, allowNetwork, totalCountHint, contentAuthor } = options;
    let cached: CommentViewModel[] = await getCachedComments(contentId, contentType, null, 'score');
    const cachedPage = await getPageState(contentId, contentType, null, 'score');
    let totalCount = Math.max(Number(cachedPage?.totalCount || 0), Number(totalCountHint || 0), cached.length);
    let source: CommentQualityResult['source'] = cached.length ? 'cache' : 'none';

    if (allowNetwork && cached.length < 8) {
        try {
            const response = await getRootComments(
                contentId,
                contentType === 'answer' ? 'answers' : 'articles',
                '',
                'score',
            );
            const incoming = (response?.data ?? [])
                .map(normalizeComment)
                .filter(Boolean) as CommentViewModel[];
            const next = nextOffset(response?.paging?.next);
            totalCount = Number(response?.counts?.total_counts || incoming.length || totalCount);

            if (incoming.length) {
                cached = incoming;
                source = 'network';
                void saveCommentPage({
                    contentId,
                    contentType,
                    parentCommentId: null,
                    orderBy: 'score',
                    comments: incoming,
                    nextOffset: next,
                    isEnd: !next || response?.paging?.is_end === true,
                    totalCount,
                }).catch((error) => console.warn('评论质量样本写入缓存失败', error));
            }
        } catch (error) {
            console.warn('评论质量样本获取失败，回退本地缓存', error);
        }
    }

    return buildCommentQuality(cached, {
        totalCount,
        source,
        contentAuthor,
    });
}
