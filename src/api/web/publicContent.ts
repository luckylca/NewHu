import type { FeedDetail, FeedItem, FeedType } from '@/src/types/zhihu';

export class PublicWebContentError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'PublicWebContentError';
  }
}

const PUBLIC_WEB_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'user-agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};
const MAX_PUBLIC_HTML_CHARS = 2_000_000;

function validateContentId(value: string, type: FeedType) {
  const id = String(value);
  if (id.length > 80 || !/^[A-Za-z0-9_-]+$/.test(id) || (type === 'answer' && !/^\d+$/.test(id))) {
    throw new PublicWebContentError('知乎公开内容 ID 无效');
  }
  return id;
}

async function getAnonymousHtml(url: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: PUBLIC_WEB_HEADERS,
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new PublicWebContentError(`知乎公开网页请求失败（HTTP ${response.status}）`, response.status);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !contentType.toLowerCase().includes('text/html')) {
    throw new PublicWebContentError('知乎公开网页返回了非 HTML 内容');
  }
  const html = await response.text();
  if (html.length > MAX_PUBLIC_HTML_CHARS) {
    throw new PublicWebContentError('知乎公开网页响应过大，已停止解析');
  }
  return html;
}

function parseJsonObjectAt(source: string, marker: string): Record<string, any> {
  const markerIndex = source.indexOf(marker);
  const start = markerIndex < 0 ? -1 : source.indexOf('{', markerIndex + marker.length);
  if (start < 0) throw new PublicWebContentError('知乎公开网页缺少正文数据');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          const value = JSON.parse(source.slice(start, index + 1));
          if (value && typeof value === 'object' && !Array.isArray(value)) return value;
        } catch {
          break;
        }
      }
    }
  }
  throw new PublicWebContentError('知乎公开网页正文数据格式无法识别');
}

function parseArticleInitialData(html: string): Record<string, any> {
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi);
  for (const match of scripts) {
    if (!/\bid\s*=\s*["']js-initialData["']/i.test(match[1])) continue;
    try {
      return JSON.parse(match[2]);
    } catch {
      throw new PublicWebContentError('知乎文章初始数据格式无法识别');
    }
  }
  throw new PublicWebContentError('知乎公开文章页没有初始正文数据');
}

function hasPublicHtml(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizePublicDetail(raw: Record<string, any>, type: FeedType, id: string, fallback?: FeedItem): FeedDetail {
  const author = raw.author && typeof raw.author === 'object' ? raw.author : {};
  const avatar = author.avatar_url ?? author.avatarUrl ?? author.logo ?? fallback?.authorAvatar ?? '';
  const html = String(raw.content);
  return {
    id: String(raw.id ?? id),
    title: String(raw.title ?? fallback?.title ?? ''),
    authorName: String(author.name ?? fallback?.authorName ?? '匿名用户'),
    authorUrlToken: String(author.url_token ?? author.urlToken ?? fallback?.authorUrlToken ?? ''),
    authorAvatar: typeof avatar === 'string' ? avatar.replace('{size}', 's') : fallback?.authorAvatar ?? '',
    excerpt: String(raw.excerpt ?? raw.desc ?? fallback?.excerpt ?? ''),
    updatedTime: Number(raw.updated_time ?? raw.updated ?? raw.created ?? fallback?.updatedTime ?? 0) || 0,
    voteCount: Number(raw.voteup_count ?? raw.voteupCount ?? raw.upvoted_count ?? fallback?.voteCount ?? 0) || 0,
    favoriteCount: Number(raw.favorite_count ?? raw.favlists_count ?? raw.favlistsCount ?? raw.favorites ?? fallback?.favoriteCount ?? 0) || 0,
    favorited: fallback?.favorited ?? false,
    commentCount: Number(raw.comment_count ?? raw.commentCount ?? fallback?.commentCount ?? 0) || 0,
    content: html,
    questionTitle: type === 'answer' ? String(raw.question?.title ?? raw.title ?? fallback?.questionTitle ?? '') : '',
    questionExcerpt: fallback?.questionExcerpt,
    questionId: String(raw.question?.id ?? raw.question_id ?? fallback?.questionId ?? ''),
    questionTopicIds: fallback?.questionTopicIds,
    questionAuthorName: fallback?.questionAuthorName ?? '匿名用户',
    questionAuthorAvatar: fallback?.questionAuthorAvatar ?? '',
    questionAuthorUrlToken: fallback?.questionAuthorUrlToken ?? '',
    questionAnswerCount: Number(raw.question?.answer_count ?? raw.answer_count ?? fallback?.questionAnswerCount ?? 0) || 0,
    questionCreatedTime: Number(raw.question?.created ?? fallback?.questionCreatedTime ?? 0) || 0,
    recommendationReason: fallback?.recommendationReason,
  };
}

/** Anonymous first-party Web surfaces for publicly readable answer/article content. */
export async function fetchPublicWebDetail(type: 'answer' | 'article', contentId: string, fallback?: FeedItem): Promise<FeedDetail> {
  const id = validateContentId(contentId, type);
  let raw: Record<string, any>;

  if (type === 'answer') {
    const html = await getAnonymousHtml(`https://www.zhihu.com/tardis/zm/ans/${id}`);
    raw = parseJsonObjectAt(html, 'g_initialProps')?.renderHtml;
  } else {
    const html = await getAnonymousHtml(`https://zhuanlan.zhihu.com/p/${encodeURIComponent(id)}`);
    const initial = parseArticleInitialData(html);
    const articles = initial?.initialState?.entities?.articles;
    raw = articles?.[id] ?? Object.values(articles ?? {}).find((article: any) => String(article?.id) === id) as Record<string, any>;
  }

  if (raw?.contentNeedTruncated === true
    || raw?.forceLoginWhenClickReadMore === true
    || raw?.isPaid === true
    || raw?.is_paid === true
    || raw?.paidInfo?.isPaid === true
    || raw?.paid_info?.is_paid === true) {
    throw new PublicWebContentError('这篇内容需要登录或付费后才能阅读完整正文');
  }
  if (!raw || !hasPublicHtml(raw.content)) {
    throw new PublicWebContentError('知乎没有向游客返回这篇内容的完整正文');
  }
  return normalizePublicDetail(raw, type, id, fallback);
}
