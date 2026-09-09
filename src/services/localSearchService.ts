import type { LocalSearchResult } from '@/src/types/localSearch';
import type { CommentDraft } from '@/src/stores/useDraftStore';
import type { LaterReadItem } from '@/src/stores/useLaterReadStore';
import { searchLocalDatabase } from '@/src/db/repositories/localSearchRepository';
import {
    buildLocalSearchSnippet,
    localTextMatches,
    mergeLocalSearchSources,
    scoreLocalSearchText,
} from '@/src/utils/localSearch';

function mergeContentResult(
    map: Map<string, LocalSearchResult>,
    incoming: LocalSearchResult,
) {
    const existing = map.get(incoming.key);
    if (!existing || existing.kind !== 'local-content' || incoming.kind !== 'local-content') {
        map.set(incoming.key, incoming);
        return;
    }
    map.set(incoming.key, {
        ...existing,
        title: existing.title !== '无标题' ? existing.title : incoming.title,
        snippet: existing.snippet || incoming.snippet,
        author: existing.author !== '匿名用户' ? existing.author : incoming.author,
        sources: mergeLocalSearchSources(existing.sources, incoming.sources),
        updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
        score: Math.max(existing.score, incoming.score) + 3,
    });
}

export async function searchLocalLibrary(
    query: string,
    options: {
        laterReadItems: LaterReadItem[];
        drafts: CommentDraft[];
    },
) {
    const dbResults = await searchLocalDatabase(query);
    const resultMap = new Map<string, LocalSearchResult>();

    for (const result of dbResults) resultMap.set(result.key, result);

    for (const item of options.laterReadItems) {
        const key = `content:${item.type}:${item.id}`;
        const existing = resultMap.get(key);
        if (existing?.kind === 'local-content') {
            resultMap.set(key, {
                ...existing,
                sources: mergeLocalSearchSources(existing.sources, ['later']),
                updatedAt: Math.max(existing.updatedAt, item.addedAt),
                score: existing.score + 3,
            });
            continue;
        }
        if (!localTextMatches(query, item.title, item.summary, item.authorName)) continue;
        mergeContentResult(resultMap, {
            key,
            kind: 'local-content',
            contentId: item.id,
            contentType: item.type,
            title: item.title,
            snippet: buildLocalSearchSnippet(item.summary, query),
            author: item.authorName,
            sources: ['later'],
            updatedAt: item.addedAt,
            score: scoreLocalSearchText(query, {
                title: item.title,
                snippet: item.summary,
                author: item.authorName,
            }) + 10,
        });
    }

    for (const draft of options.drafts) {
        if (!localTextMatches(
            query,
            draft.title,
            draft.content,
            draft.target.replyName,
        )) continue;
        const contentType = draft.target.contentType === 'article' ? 'article' : 'answer';
        resultMap.set(`draft:${draft.id}`, {
            key: `draft:${draft.id}`,
            kind: 'local-draft',
            contentId: draft.target.contentId,
            contentType,
            title: draft.title || '评论草稿',
            snippet: buildLocalSearchSnippet(draft.content, query),
            author: draft.target.replyName || '评论草稿',
            sources: ['draft'],
            updatedAt: draft.updatedAt,
            score: scoreLocalSearchText(query, {
                title: draft.title,
                snippet: draft.content,
                author: draft.target.replyName,
            }) + 14,
            draftId: draft.id,
        });
    }

    return [...resultMap.values()]
        .sort((a, b) => (
            b.score - a.score
            || b.updatedAt - a.updatedAt
            || a.title.localeCompare(b.title)
        ))
        .slice(0, 200);
}
