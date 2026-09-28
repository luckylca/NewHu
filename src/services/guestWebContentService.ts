import { fetchPublicWebDetail } from '@/src/api/web/publicContent';
import type { FeedDetail, FeedItem } from '@/src/types/zhihu';

/** Fetch a public full-detail page through Zhihu's Web surfaces without cookies. */
export function fetchGuestWebContent(type: 'answer' | 'article', id: string, fallback?: FeedItem): Promise<FeedDetail> {
  return fetchPublicWebDetail(type, id, fallback);
}
