import type { FeedType } from '@/src/types/zhihu';

export function getContentSourceUrl(type: FeedType, id: string, questionId?: string) {
    if (type === 'article') return `https://zhuanlan.zhihu.com/p/${id}`;
    if (questionId) return `https://www.zhihu.com/question/${questionId}/answer/${id}`;
    return `https://www.zhihu.com/answer/${id}`;
}

export function normalizeAnnotationSelection(start: number, end: number, textLength: number) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(textLength)) return null;
    const length = Math.max(0, Math.floor(textLength));
    const from = Math.max(0, Math.min(length, Math.floor(start)));
    const to = Math.max(0, Math.min(length, Math.floor(end)));
    if (to <= from) return null;
    return { start: from, end: to };
}
