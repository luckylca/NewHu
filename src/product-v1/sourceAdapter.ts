import { search } from '@/src/api/ZhihuApi';
import type { FeedItemInfo, FeedType } from '@/src/types/zhihu';

function plainText(value: unknown) {
  return String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeProductSearchItem(raw: any): FeedItemInfo | null {
  const object = raw?.object ?? raw;
  const type: FeedType | null = object?.type === 'answer' || object?.type === 'article' ? object.type : null;
  const id = String(object?.id ?? '');
  if (!type || !id) return null;
  const questionTitle = plainText(object?.question?.title);
  const title = plainText(type === 'answer' ? questionTitle || raw?.highlight?.title : object?.title || raw?.highlight?.title);
  return {
    feedType: type,
    isAds: false,
    isPaid: Boolean(object?.paid_info || object?.paywall_info || object?.is_paid),
    item: {
      id,
      title: title || '无标题',
      authorName: plainText(object?.author?.name) || '匿名用户',
      authorUrlToken: String(object?.author?.url_token ?? ''),
      authorAvatar: String(object?.author?.avatar_url ?? ''),
      excerpt: plainText(object?.excerpt ?? raw?.highlight?.description ?? raw?.highlight?.content) || '暂无简介',
      updatedTime: Number(object?.updated_time ?? object?.updated ?? object?.created ?? 0),
      voteCount: Number(object?.voteup_count ?? 0),
      favoriteCount: Number(object?.favlists_count ?? 0),
      commentCount: Number(object?.comment_count ?? 0),
      content: String(object?.content ?? ''),
      questionTitle,
      questionId: String(object?.question?.id ?? ''),
      questionAuthorName: plainText(object?.question?.author?.name) || '匿名用户',
      questionAuthorAvatar: String(object?.question?.author?.avatar_url ?? ''),
      questionAuthorUrlToken: String(object?.question?.author?.url_token ?? ''),
      questionAnswerCount: Number(object?.question?.answer_count ?? 0),
      questionCreatedTime: Number(object?.question?.created ?? 0),
    },
  };
}

export async function fetchProductSearch(query: string, offset = 0, highQuality = false) {
  const response = await search(query, offset, 'general', highQuality
    ? { sort: 'upvoted_count', searchSource: 'Filter' }
    : {});
  return (Array.isArray(response?.data) ? response.data : [])
    .map(normalizeProductSearchItem)
    .filter((item: FeedItemInfo | null): item is FeedItemInfo => item !== null);
}
