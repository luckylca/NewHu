import { getApiInstance } from '@/src/api/ZhihuApi';
import { getOfflinePin } from '@/src/db/repositories/offlineCacheRepository';
import { upsertContent } from '@/src/db/repositories/contentRepository';
import { cacheContentForOfflineFromId } from '@/src/services/offlineCacheService';
import type { FeedItemInfo } from '@/src/types/zhihu';
import { normalizeRecommendItem } from './recommendFeedService';

export type BrowseAndSaveResult = {
    fetched: number;
    saved: number;
    skipped: number;
    failed: number;
};

/** Fetch one additional recommendation page and pin its answer/article bodies for offline reading. */
export async function fetchAndSaveRecommendationPage(options: {
    cursor: string;
    cookie: string;
    filterAds: boolean;
    filterPaid: boolean;
    withImages: boolean;
}): Promise<BrowseAndSaveResult> {
    const api = getApiInstance(options.cookie);
    const response = await api.getRecommend(options.cursor);
    const candidates = (Array.isArray(response?.data) ? response.data : [])
        .map(normalizeRecommendItem)
        .filter((item: FeedItemInfo | null): item is FeedItemInfo => item !== null)
        .filter((item: FeedItemInfo) => !(options.filterAds && item.isAds) && !(options.filterPaid && item.isPaid));

    const unique = new Map<string, FeedItemInfo>();
    for (const item of candidates) unique.set(`${item.feedType}:${item.item.id}`, item);

    const result: BrowseAndSaveResult = { fetched: candidates.length, saved: 0, skipped: 0, failed: 0 };
    for (const item of unique.values()) {
        try {
            const existingPin = await getOfflinePin(item.item.id, item.feedType);
            const hasEnoughComments = existingPin?.rootCommentMode === 'all'
                || (existingPin?.rootCommentMode === 'limit' && existingPin.rootCommentLimit >= 100);
            const hasEnoughChildren = existingPin != null && existingPin.childCommentLimit >= 100;
            const hasEnoughImages = !options.withImages || existingPin?.withImages === true;
            if (
                existingPin?.status === 'active'
                && hasEnoughComments
                && hasEnoughChildren
                && hasEnoughImages
            ) {
                result.skipped += 1;
                continue;
            }

            // Preserve a body already included in the recommendation response. If it
            // is missing, fetch the detail before caching the body and its comments.
            await upsertContent(item.item, item.feedType, { cacheState: 'transient' });
            await cacheContentForOfflineFromId(item.item.id, item.feedType, {
                rootCommentMode: 'limit',
                rootCommentLimit: 100,
                childCommentLimit: 100,
                withImages: options.withImages,
            });
            result.saved += 1;
        } catch (error) {
            result.failed += 1;
            console.warn('边看边存内容失败:', item.feedType, item.item.id, error);
        }
    }

    return result;
}
