import { getApiInstance } from '@/src/api/ZhihuApi';
import { useUserStore } from '@/src/stores/useUserStore';
import { getNetworkStatus } from '@/src/stores/useNetworkStore';
import { normalizeComment, normalizeContent } from '@/src/db/mappers';
import { downgradeContentComments, getCachedComments, getPageState, markCommentsPinned, saveCommentPage } from '@/src/db/repositories/commentRepository';
import { getContent, markBodyCacheState, upsertContent } from '@/src/db/repositories/contentRepository';
import { createCacheJob, removeOfflinePin, updateCacheJob, upsertOfflinePin } from '@/src/db/repositories/offlineCacheRepository';
import { downloadResources, extractImageUrls, referenceResource } from './resourceService';
import type { FeedType } from '@/src/types/zhihu';
import type { RootCommentMode } from '@/src/db/types';

export type CacheProgressCallback = (progress: number) => void;

function nextOffset(next?: string) {
    if (!next) return '';
    try { return new URL(next).searchParams.get('offset') || ''; } catch { return ''; }
}

function rootTarget(mode: RootCommentMode, limit: number) {
    return mode === 'none' ? 0 : mode === 'all' ? null : limit;
}

async function ensureApi() {
    const cookies = useUserStore.getState().cookies;
    return getApiInstance(cookies);
}

async function cacheRootComments(contentId: string, contentType: FeedType, target: number | null, jobId: string, onProgress?: CacheProgressCallback) {
    if (target === 0) return [];
    const api = await ensureApi();
    const orderBy = 'score';
    let cached = await getCachedComments(contentId, contentType, null, orderBy);
    let page = await getPageState(contentId, contentType, null, orderBy);
    let next = page?.nextOffset || '';
    let isEnd = page?.isEnd ?? false;
    while (!isEnd && (target == null || cached.length < target)) {
        const response = await api.getRootComments(contentId, contentType === 'answer' ? 'answers' : 'articles', next, orderBy);
        const incoming = (response?.data || []).map((item: any) => normalizeComment(item)).filter(Boolean);
        next = nextOffset(response?.paging?.next);
        isEnd = Boolean(response?.paging?.is_end) || !next;
        await saveCommentPage({ contentId, contentType, parentCommentId: null, orderBy, comments: incoming, nextOffset: next, isEnd, totalCount: Number(response?.counts?.total_counts || 0) });
        cached = await getCachedComments(contentId, contentType, null, orderBy);
        page = await getPageState(contentId, contentType, null, orderBy);
        await updateCacheJob(jobId, { status: 'running', rootCached: target == null ? cached.length : Math.min(cached.length, target) });
        if (target != null && target > 0) onProgress?.(Math.min(cached.length, target) / target);
        if (!incoming.length && !page?.nextOffset) break;
    }
    return target == null ? cached : cached.slice(0, target);
}

async function cacheChildComments(contentId: string, contentType: FeedType, roots: Awaited<ReturnType<typeof getCachedComments>>, childLimit: number, jobId: string, onProgress?: CacheProgressCallback) {
    const api = await ensureApi();
    let childCached = 0;
    const childTarget = roots.reduce((sum, root) => sum + Math.min(root.childCommentCount || 0, childLimit), 0);
    for (const root of roots) {
        if (!root.childCommentCount) continue;
        const orderBy = 'ts';
        let cached = await getCachedComments(contentId, contentType, root.id, orderBy);
        let page = await getPageState(contentId, contentType, root.id, orderBy);
        let next = page?.nextOffset || '';
        let isEnd = page?.isEnd ?? false;
        while (!isEnd && cached.length < childLimit) {
            const response = await api.getChildComments(root.id, next, orderBy);
            const incoming = (response?.data || []).map((item: any) => normalizeComment(item)).filter(Boolean);
            next = nextOffset(response?.paging?.next);
            isEnd = Boolean(response?.paging?.is_end) || !next;
            await saveCommentPage({ contentId, contentType, parentCommentId: root.id, orderBy, comments: incoming, nextOffset: next, isEnd, totalCount: Number(response?.counts?.total_counts || 0), rootComment: normalizeComment(response?.root) });
            cached = await getCachedComments(contentId, contentType, root.id, orderBy);
            page = await getPageState(contentId, contentType, root.id, orderBy);
            if (!incoming.length && !page?.nextOffset) break;
        }
        childCached += Math.min(cached.length, childLimit);
        await updateCacheJob(jobId, { status: 'running', childCached });
        onProgress?.(childTarget > 0 ? Math.min(childCached, childTarget) / childTarget : 1);
    }
    return childCached;
}

export async function cacheContent(options: {
    content: ReturnType<typeof normalizeContent>;
    contentType: FeedType;
    rootCommentMode: RootCommentMode;
    rootCommentLimit: number;
    childCommentLimit: number;
    withImages: boolean;
    onProgress?: CacheProgressCallback;
    onNetworkSpeed?: (bytesPerSecond: number) => void;
}) {
    if (getNetworkStatus() !== 'online') throw new Error('当前无网络，无法开始新的离线缓存');
    const { content, contentType, rootCommentMode, rootCommentLimit, childCommentLimit, withImages, onProgress, onNetworkSpeed } = options;
    onProgress?.(0.05);
    await upsertContent(content, contentType, { cacheState: 'pinned', voted: content.voted });
    await markBodyCacheState(content.id, contentType, 'pinned');
    await upsertOfflinePin({ contentId: content.id, contentType, rootCommentMode, rootCommentLimit, childCommentLimit, withImages });
    onProgress?.(0.12);
    const jobId = await createCacheJob(content.id, contentType, rootTarget(rootCommentMode, rootCommentLimit));
    await updateCacheJob(jobId, { status: 'running' });
    try {
        const roots = await cacheRootComments(
            content.id,
            contentType,
            rootTarget(rootCommentMode, rootCommentLimit),
            jobId,
            (value) => onProgress?.(0.12 + value * 0.33),
        );
        const selectedRoots = roots.slice(0, rootCommentMode === 'all' ? roots.length : rootCommentLimit);
        const childCached = rootCommentMode === 'none'
            ? 0
            : await cacheChildComments(
                content.id,
                contentType,
                selectedRoots,
                childCommentLimit,
                jobId,
                (value) => onProgress?.(0.45 + value * 0.25),
            );
        await markCommentsPinned(content.id, contentType, selectedRoots.map((item) => item.id), childCommentLimit);
        const cachedChildren = rootCommentMode === 'none'
            ? []
            : (await Promise.all(selectedRoots.map((root) => getCachedComments(content.id, contentType, root.id, 'ts'))))
                .flatMap((children) => children.slice(0, childCommentLimit));
        const commentsForImages = [...selectedRoots, ...cachedChildren];

        const imageUrls = withImages
            ? [...new Set([
                ...extractImageUrls(content.content),
                content.authorAvatar,
                content.questionAuthorAvatar,
                ...commentsForImages.flatMap((comment) => [comment.authorAvatar || '', ...extractImageUrls(comment.content)]),
            ].filter(Boolean))]
            : [];
        await updateCacheJob(jobId, { imageTotal: imageUrls.length });
        onProgress?.(0.72);
        const imageCached = await downloadResources(imageUrls, (completed, _total, stats) => {
            void updateCacheJob(jobId, { imageCached: completed });
            onNetworkSpeed?.(stats.bytesPerSecond);
            onProgress?.(imageUrls.length > 0 ? 0.72 + (completed / imageUrls.length) * 0.28 : 1);
        });
        for (const url of imageUrls) {
            await referenceResource(url, contentType, content.id, 'article_body');
        }
        await updateCacheJob(jobId, { status: imageCached === imageUrls.length ? 'completed' : 'partial', rootCached: selectedRoots.length, childCached, imageCached, imageTotal: imageUrls.length });
        onProgress?.(1);
        return { jobId, status: imageCached === imageUrls.length ? 'completed' : 'partial' };
    } catch (error) {
        await updateCacheJob(jobId, { status: 'failed', lastError: error instanceof Error ? error.message : String(error) });
        throw error;
    }
}

export async function removeCachedContent(contentId: string, contentType: FeedType) {
    await removeOfflinePin(contentId, contentType);
    await markBodyCacheState(contentId, contentType, 'transient');
    const cached = await getContent(contentId, contentType);
    if (cached) {
        // Do not remove metadata or behavior records; only downgrade the body/comments.
        await downgradeContentComments(contentId, contentType);
    }
}

export async function cacheContentFromId(contentId: string, contentType: FeedType, options: Omit<Parameters<typeof cacheContent>[0], 'content' | 'contentType'>) {
    const api = await ensureApi();
    options.onProgress?.(0.01);
    const raw = contentType === 'answer' ? await api.getAnswer(contentId) : await api.getArticle(contentId);
    return cacheContent({ content: normalizeContent(raw, contentType), contentType, ...options });
}
