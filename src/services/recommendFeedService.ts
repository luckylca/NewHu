import { getApiInstance } from '@/src/api/ZhihuApi';
import { saveFeedEntries } from '@/src/db/repositories/feedRepository';
import type { FeedItemInfo, FeedType } from '@/src/types/zhihu';

export function getRecommendSessionToken(next: unknown): string {
    if (typeof next !== 'string' || !next) return '';
    try {
        return new URL(next, 'https://www.zhihu.com').searchParams.get('session_token') || '';
    } catch {
        const match = next.match(/[?&]session_token=([^&]+)/);
        if (!match) return '';
        try {
            return decodeURIComponent(match[1]);
        } catch {
            return match[1];
        }
    }
}

export function getRecommendNextCursor(next: unknown): string {
    return typeof next === 'string' ? next : '';
}

function getExcerpt(target: any) {
    const direct = target?.excerpt || target?.intro || target?.description;
    if (direct) return String(direct).trim();

    const plainText = String(target?.content || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();
    return plainText.slice(0, 240) || '暂无简介';
}

/** Normalize one recommendation target before it enters either UI or SQLite. */
export function normalizeRecommendItem(item: any): FeedItemInfo | null {
    const target = item?.target;
    if (!target || (target.type !== 'answer' && target.type !== 'article') || !target.id) return null;

    const isAds = item.promotion_extra != null || item.advertisement != null;
    const isPaid = Boolean(
        target.paid_info
        || target.paywall_info
        || target.answer_type === 'paid'
        || target.is_paid === true,
    );
    const type = target.type as FeedType;

    return {
        feedType: type,
        isAds,
        isPaid,
        item: {
            id: String(target.id),
            title: target.title || '无标题',
            authorName: target.author?.name || '匿名用户',
            authorUrlToken: target.author?.url_token || '',
            authorAvatar: target.author?.avatar_url || '',
            excerpt: getExcerpt(target),
            updatedTime: target.updated_time || target.created || 0,
            voteCount: target.voteup_count || 0,
            favoriteCount: target.favorite_count || 0,
            commentCount: target.comment_count || 0,
            content: target.content || '',
            questionTitle: target.question?.title || '未知问题',
            questionId: String(target.question?.id || ''),
            questionAuthorName: target.question?.author?.name || '匿名用户',
            questionAuthorAvatar: target.question?.author?.avatar_url || '',
            questionAuthorUrlToken: target.question?.author?.url_token || '',
            questionAnswerCount: target.question?.answer_count || 0,
            questionCreatedTime: target.question?.created || 0,
        },
    };
}

export type RecommendBatchProgress = {
    fetched: number;
    pages: number;
};

/**
 * Fetch recommendation pages for offline caching. Every page is persisted
 * through the SQLite feed repository first, so historical push filtering is
 * shared with the home feed and never bypassed by the batch cache flow.
 */
export async function fetchRecommendBatch(options: {
    count: number;
    cookie?: string;
    filterAds?: boolean;
    filterPaid?: boolean;
    deduplicate?: boolean;
    onProgress?: (progress: RecommendBatchProgress) => void;
}): Promise<FeedItemInfo[]> {
    const { count, cookie, filterAds = true, filterPaid = true, deduplicate = true, onProgress } = options;
    if (count <= 0) return [];

    const api = getApiInstance(cookie);
    const result: FeedItemInfo[] = [];
    const resultKeys = new Set<string>();
    const visitedCursors = new Set<string>();
    let nextCursor = '';

    // Historical filtering can make a page yield no usable items, so keep
    // paging until the requested amount is reached or the API is exhausted.
    for (let page = 0; page < 200 && result.length < count; page += 1) {
        if (visitedCursors.has(nextCursor)) break;
        visitedCursors.add(nextCursor);

        const response = await api.getRecommend(nextCursor);
        const pageItems = (Array.isArray(response?.data) ? response.data : [])
            .map(normalizeRecommendItem)
            .filter((item: FeedItemInfo | null): item is FeedItemInfo => item !== null)
            .filter((item: FeedItemInfo) => !(filterAds && item.isAds) && !(filterPaid && item.isPaid));

        const freshPageItems = await saveFeedEntries(
            pageItems,
            'recommend',
            getRecommendSessionToken(nextCursor),
            deduplicate,
        );
        for (const item of freshPageItems) {
            const key = `${item.feedType}:${item.item.id}`;
            if (resultKeys.has(key)) continue;
            resultKeys.add(key);
            result.push(item);
            if (result.length >= count) break;
        }
        onProgress?.({ fetched: result.length, pages: page + 1 });

        const next = getRecommendNextCursor(response?.paging?.next);
        if (!next || response?.paging?.is_end === true) break;
        nextCursor = next;
    }

    return result.slice(0, count);
}
