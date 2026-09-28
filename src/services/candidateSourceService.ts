import type { CandidateSourceOrigin } from '@/src/product-v1/core/candidateAcquisition';
import type { FeedItemInfo } from '@/src/types/zhihu';
import type { RecommendationSourceMode } from '@/src/product-v1/types';
import type { AndroidRecommendationPage } from '@/src/services/androidRecommendService';

export function candidateSourcesForItem(item: FeedItemInfo): CandidateSourceOrigin[] {
  const sources = Array.isArray(item.candidateSources) ? item.candidateSources : [];
  return sources.length ? [...new Set(sources)] : ['web_recommend'];
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value !== '暂无简介' && value !== '无标题';
}

/** Merge identical content by stable Zhihu content ID while retaining every acquisition source. */
export function mergeRecommendationSourceItems(items: FeedItemInfo[]) {
  const merged = new Map<string, FeedItemInfo>();
  let duplicateCount = 0;
  for (const item of items) {
    const key = `${item.feedType}:${item.item.id}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...item, candidateSources: candidateSourcesForItem(item) });
      continue;
    }
    duplicateCount += 1;
    current.candidateSources = [...new Set([...candidateSourcesForItem(current), ...candidateSourcesForItem(item)])];
    current.isAds ||= item.isAds;
    current.isPaid ||= item.isPaid;
    for (const field of ['title', 'excerpt', 'content', 'authorName', 'authorUrlToken', 'authorAvatar', 'questionTitle', 'questionExcerpt'] as const) {
      if (!hasText(current.item[field]) && hasText(item.item[field])) current.item[field] = item.item[field];
    }
    current.item.voteCount = Math.max(current.item.voteCount || 0, item.item.voteCount || 0);
    current.item.favoriteCount = Math.max(current.item.favoriteCount || 0, item.item.favoriteCount || 0);
    current.item.commentCount = Math.max(current.item.commentCount || 0, item.item.commentCount || 0);
    if (!current.item.questionId && item.item.questionId) current.item.questionId = item.item.questionId;
  }
  return { items: [...merged.values()], duplicateCount };
}

export function sourceCountsForItems(items: FeedItemInfo[]) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const source of candidateSourcesForItem(item)) counts[source] = (counts[source] ?? 0) + 1;
  }
  return counts;
}

export async function fetchRecommendationSourcePage(options: {
  mode: RecommendationSourceMode;
  webCursor: string;
  androidCursor: string;
  fetchWeb: (cursor: string) => Promise<any>;
  fetchAndroid: (cursor: string) => Promise<AndroidRecommendationPage>;
  normalizeWebItem: (item: any) => FeedItemInfo | null;
}) {
  const { mode, webCursor, androidCursor, fetchWeb, fetchAndroid, normalizeWebItem } = options;
  const wantsWeb = mode !== 'android';
  const wantsAndroid = mode !== 'web';
  const [webResult, androidResult] = await Promise.allSettled([
    wantsWeb ? fetchWeb(webCursor) : Promise.resolve(null),
    wantsAndroid ? fetchAndroid(androidCursor) : Promise.resolve(null),
  ]);
  let webResponse = webResult.status === 'fulfilled' ? webResult.value : null;
  const androidPage = androidResult.status === 'fulfilled' ? androidResult.value : null;
  let webError = webResult.status === 'rejected' ? webResult.reason : null;
  const androidError = androidResult.status === 'rejected' ? androidResult.reason : null;

  // ANDROID mode degrades to the established Web source; MIXED keeps whichever source succeeded.
  if (mode === 'android' && androidError) {
    try {
      webResponse = await fetchWeb(webCursor);
      webError = null;
    } catch (error) {
      webError = error;
    }
  }
  if (!webResponse && !androidPage) throw webError ?? androidError ?? new Error('推荐候选源没有返回数据');

  const webData: any[] = Array.isArray(webResponse?.data) ? webResponse.data : [];
  const webItems = webData
    .filter((item: any) => item?.target && ['answer', 'article'].includes(item.target.type))
    .map(normalizeWebItem)
    .filter((item: FeedItemInfo | null): item is FeedItemInfo => item !== null);
  const merged = mergeRecommendationSourceItems([...webItems, ...(androidPage?.items ?? [])]);
  return {
    webResponse,
    webError,
    androidError,
    androidPage,
    webRawCount: webData.length,
    webNormalizedCount: webItems.length,
    items: merged.items,
    duplicateCount: merged.duplicateCount,
    nextWebCursor: webResponse?.paging?.next ? String(webResponse.paging.next) : '',
    nextAndroidCursor: androidPage?.nextCursor ?? '',
  };
}
