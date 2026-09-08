import type { KnowledgeReviewState } from '@/src/db/types';

export const MAX_KNOWLEDGE_TAGS = 8;
export const MAX_KNOWLEDGE_TAG_LENGTH = 24;

export const KNOWLEDGE_REVIEW_STATES: KnowledgeReviewState[] = [
    'new',
    'learning',
    'mastered',
];

export const KNOWLEDGE_REVIEW_LABELS: Record<KnowledgeReviewState, string> = {
    new: '待复习',
    learning: '复习中',
    mastered: '已掌握',
};

export function normalizeKnowledgeTags(input: string | string[]) {
    const raw = Array.isArray(input)
        ? input
        : input.split(/[\n,，;；#]+/g);

    const result: string[] = [];
    const seen = new Set<string>();
    for (const entry of raw) {
        const tag = String(entry)
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, MAX_KNOWLEDGE_TAG_LENGTH);
        if (!tag) continue;
        const fingerprint = tag.toLocaleLowerCase();
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        result.push(tag);
        if (result.length >= MAX_KNOWLEDGE_TAGS) break;
    }
    return result;
}

export function parseKnowledgeTagsJson(value: string) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
            ? normalizeKnowledgeTags(parsed.map((item) => String(item)))
            : [];
    } catch {
        return [];
    }
}

export function stringifyKnowledgeTags(tags: string[]) {
    return JSON.stringify(normalizeKnowledgeTags(tags));
}
