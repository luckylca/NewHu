import { getAndroidRecommend } from '@/src/api/ZhihuApi';
import type { AndroidRequestOptions } from '@/src/api/android/androidClient';
import type { FeedItemInfo, FeedType } from '@/src/types/zhihu';

type AndroidCard = Record<string, any>;

function visitNodes(node: any, output: any[] = []): any[] {
  if (!node || typeof node !== 'object') return output;
  output.push(node);
  if (Array.isArray(node.children)) node.children.forEach((child: any) => visitNodes(child, output));
  if (Array.isArray(node.elements)) node.elements.forEach((child: any) => visitNodes(child, output));
  if (node.tail_element) visitNodes(node.tail_element, output);
  return output;
}

function routeFor(card: AndroidCard): URL | null {
  const parameter = card?.action?.parameter;
  const routeUrl = typeof parameter === 'string'
    ? new URLSearchParams(parameter).get('route_url')
    : typeof parameter?.route_url === 'string' ? parameter.route_url : null;
  if (!routeUrl) return null;
  try {
    const route = new URL(routeUrl);
    if (!['zhihu.com', 'www.zhihu.com', 'zhuanlan.zhihu.com'].includes(route.hostname)) return null;
    return route;
  } catch {
    return null;
  }
}

function targetFromRoute(route: URL): { type: FeedType; id: string; questionId: string } | null {
  const answer = route.pathname.match(/\/question\/(\d+)\/answer\/(\d+)/);
  if (answer) return { type: 'answer', questionId: answer[1], id: answer[2] };
  const article = route.pathname.match(/\/p\/([A-Za-z0-9_-]+)/);
  if (article) return { type: 'article', questionId: '', id: article[1] };
  const question = route.pathname.match(/\/question\/(\d+)\/?$/);
  if (question) return { type: 'question', questionId: question[1], id: question[1] };
  return null;
}

function hasFlag(value: unknown, pattern: RegExp): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => hasFlag(item, pattern));
  return Object.entries(value as Record<string, unknown>).some(([key, field]) => {
    if (pattern.test(key) && field !== false && field != null && field !== 0 && field !== '') return true;
    return hasFlag(field, pattern);
  });
}

function firstText(nodes: any[], testId: string) {
  return nodes.find((node) => node.type === 'Text' && node.test_id === testId && typeof node.text === 'string')?.text?.trim() ?? '';
}

function authorNameFrom(nodes: any[]) {
  const lineText = nodes.find((node) => node.type === 'Line' && Array.isArray(node.elements))?.elements
    ?.find((node: any) => node.type === 'Text' && typeof node.text === 'string')?.text;
  return typeof lineText === 'string' && lineText.trim() ? lineText.trim().slice(0, 80) : '匿名用户';
}

function imageUrlFrom(nodes: any[]) {
  for (const node of nodes) {
    const image = node.type === 'Avatar' ? node.image : null;
    const url = typeof image === 'string' ? image : image?.url ?? image?.url_template;
    if (typeof url === 'string' && url.trim()) return url.replace('{size}', 's');
  }
  return '';
}

function reactionCount(nodes: any[], suffix: string) {
  const node = nodes.find((item) => item.type === 'Reaction' && typeof item.test_id === 'string' && item.test_id.endsWith(`.${suffix}`));
  const numeric = Number(node?.count);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

/** Convert Zhihu Android ComponentCard entries into NewHu's existing FeedItem model. */
export function normalizeAndroidRecommendItem(card: AndroidCard): FeedItemInfo | null {
  if (!card || card.type !== 'ComponentCard') return null;
  const route = routeFor(card);
  if (!route) return null;
  const target = targetFromRoute(route);
  if (!target) return null;

  const nodes = visitNodes(card);
  const key = `${target.type}.${target.id}`;
  const title = firstText(nodes, `${key}.title`)
    || firstText(nodes, `question.${target.questionId}.title`);
  const excerpt = firstText(nodes, `${key}.description`)
    || firstText(nodes, `answer.${target.id}.description`);
  const authorUrlToken = typeof card.extra?.author?.url_token === 'string' ? card.extra.author.url_token : '';
  const updatedTime = Number(card.extra?.updated_time ?? card.extra?.created_time ?? 0) || 0;
  const itemTitle = title || '无标题';

  return {
    feedType: target.type,
    isAds: hasFlag(card.extra, /advert|promotion|sponsor|commercial/i),
    isPaid: hasFlag(card.extra, /paid|paywall/i),
    candidateSources: ['android_recommend'],
    item: {
      id: target.id,
      title: itemTitle,
      authorName: authorNameFrom(nodes),
      authorUrlToken,
      authorAvatar: imageUrlFrom(nodes),
      excerpt: excerpt || '暂无简介',
      updatedTime,
      voteCount: reactionCount(nodes, 'vote'),
      favoriteCount: reactionCount(nodes, 'collect'),
      commentCount: reactionCount(nodes, 'comment'),
      content: '',
      questionTitle: target.type === 'answer' || target.type === 'question' ? itemTitle : '',
      questionExcerpt: '',
      questionId: target.questionId,
      questionTopicIds: undefined,
      questionAuthorName: '匿名用户',
      questionAuthorAvatar: '',
      questionAuthorUrlToken: '',
      questionAnswerCount: 0,
      questionCreatedTime: 0,
    },
  };
}

export type AndroidRecommendationPage = {
  items: FeedItemInfo[];
  rawCount: number;
  unsupportedCount: number;
  status: number;
  contentType: string;
  nextCursor: string;
  isEnd: boolean;
  feedRequestId: string;
};

export async function fetchAndroidRecommendPage(cursor = '', options: AndroidRequestOptions = {}): Promise<AndroidRecommendationPage> {
  const result = await getAndroidRecommend(cursor, options);
  const raw = Array.isArray(result.data?.data) ? result.data.data : [];
  const items = raw.map((item: any) => normalizeAndroidRecommendItem(item)).filter((item: FeedItemInfo | null): item is FeedItemInfo => item !== null);
  const nextCursor = typeof result.data?.paging?.next === 'string' ? result.data.paging.next : '';
  const page: AndroidRecommendationPage = {
    items,
    rawCount: raw.length,
    unsupportedCount: raw.length - items.length,
    status: result.status,
    contentType: result.contentType,
    nextCursor,
    isEnd: result.data?.paging?.is_end === true,
    feedRequestId: typeof result.data?.feed_request_id === 'string' ? result.data.feed_request_id : '',
  };
  console.info(`[CandidateSource] android raw=${page.rawCount} normalized=${items.length} unsupported=${page.unsupportedCount}`);
  return page;
}
