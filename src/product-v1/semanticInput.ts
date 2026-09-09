import type { FeedItem, FeedType } from '@/src/types/zhihu';

/**
 * Product V1 语义输入（候选嵌入、领域分类）的统一组装规则。
 *
 * 回答不能只用回答正文：问题标题作为标题，问题描述（接口返回时）
 * 拼接在回答正文之前，让嵌入同时携带问题上下文。
 */
export function semanticTitle(feedType: FeedType, item: FeedItem) {
    return feedType === 'answer'
        ? item.questionTitle || item.title
        : item.title || item.questionTitle;
}

export function semanticExcerpt(feedType: FeedType, item: FeedItem, bodyText?: string) {
    const body = (bodyText ?? item.excerpt)?.trim() || '';
    if (feedType !== 'answer') return body;
    return [item.questionExcerpt?.trim(), body].filter(Boolean).join('\n');
}
