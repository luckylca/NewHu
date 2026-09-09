import type { FeedType } from '@/src/types/zhihu';
import type { LocalSearchResult, LocalSearchSource } from '@/src/types/localSearch';
import { htmlToPlainText } from '@/src/utils/contentExport';
import {
    buildLocalSearchSnippet,
    normalizeLocalSearchTerms,
    scoreLocalSearchText,
} from '@/src/utils/localSearch';
import { getDatabase } from '../database';

export type ContentLibrarySource = 'favorite';

function escapeLikeTerm(term: string) {
    return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildLikePredicate(fields: string[], terms: string[]) {
    const clauses: string[] = [];
    const params: string[] = [];
    for (const term of terms) {
        const pattern = `%${escapeLikeTerm(term)}%`;
        clauses.push(`(${fields.map((field) => `${field} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
        for (let index = 0; index < fields.length; index += 1) params.push(pattern);
    }
    return {
        sql: clauses.length ? clauses.join(' AND ') : '0',
        params,
    };
}

function contentTitle(row: any) {
    if (row.type === 'answer') {
        return String(row.question_title || '').trim()
            || String(row.title || '').trim()
            || '无标题';
    }
    return String(row.title || '').trim()
        || String(row.question_title || '').trim()
        || '无标题';
}

function sortResults(results: LocalSearchResult[]) {
    return results.sort((a, b) => (
        b.score - a.score
        || b.updatedAt - a.updatedAt
        || a.title.localeCompare(b.title)
    ));
}

export async function setContentLibrarySource(
    contentId: string,
    contentType: FeedType,
    source: ContentLibrarySource,
    enabled: boolean,
) {
    const db = await getDatabase();
    if (!enabled) {
        await db.runAsync(
            'DELETE FROM content_library_sources WHERE content_id = ? AND content_type = ? AND source = ?',
            contentId,
            contentType,
            source,
        );
        return;
    }
    const timestamp = Date.now();
    await db.runAsync(
        `INSERT INTO content_library_sources (
            content_id, content_type, source, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(content_id, content_type, source) DO UPDATE SET
            updated_at = excluded.updated_at`,
        contentId,
        contentType,
        source,
        timestamp,
        timestamp,
    );
}

async function searchLocalContents(query: string, terms: string[]) {
    const db = await getDatabase();
    const predicate = buildLikePredicate([
        'c.title',
        'c.question_title',
        'c.excerpt',
        'c.author_name',
        "COALESCE(b.html, '')",
    ], terms);

    const rows = await db.getAllAsync<any>(
        `SELECT c.*, COALESCE(b.html, '') AS body_html,
                EXISTS(
                    SELECT 1 FROM reading_progress rp
                     WHERE rp.content_id = c.id AND rp.content_type = c.type
                ) AS is_read,
                EXISTS(
                    SELECT 1 FROM offline_pins op
                     WHERE op.content_id = c.id AND op.content_type = c.type
                       AND op.status = 'active'
                ) AS is_offline,
                EXISTS(
                    SELECT 1 FROM content_library_sources ls
                     WHERE ls.content_id = c.id AND ls.content_type = c.type
                       AND ls.source = 'favorite'
                ) AS is_favorite
           FROM contents c
           LEFT JOIN content_bodies b
             ON b.content_id = c.id AND b.content_type = c.type
          WHERE (
                EXISTS(
                    SELECT 1 FROM reading_progress rp
                     WHERE rp.content_id = c.id AND rp.content_type = c.type
                )
                OR EXISTS(
                    SELECT 1 FROM offline_pins op
                     WHERE op.content_id = c.id AND op.content_type = c.type
                       AND op.status = 'active'
                )
                OR EXISTS(
                    SELECT 1 FROM content_library_sources ls
                     WHERE ls.content_id = c.id AND ls.content_type = c.type
                       AND ls.source = 'favorite'
                )
          )
            AND ${predicate.sql}
          ORDER BY c.last_accessed_at DESC
          LIMIT 120`,
        ...predicate.params,
    );

    return rows.map((row): LocalSearchResult => {
        const bodyText = row.body_html ? htmlToPlainText(String(row.body_html)) : '';
        const title = contentTitle(row);
        const excerpt = String(row.excerpt || '').trim();
        const searchableSnippet = [excerpt, bodyText].filter(Boolean).join('\n');
        const sources: LocalSearchSource[] = [];
        if (row.is_read) sources.push('read');
        if (row.is_favorite) sources.push('favorite');
        if (row.is_offline) sources.push('offline');
        return {
            key: `content:${row.type}:${row.id}`,
            kind: 'local-content',
            contentId: String(row.id),
            contentType: row.type === 'article' ? 'article' : 'answer',
            title,
            snippet: buildLocalSearchSnippet(searchableSnippet || title, query),
            author: String(row.author_name || '').trim() || '匿名用户',
            sources,
            updatedAt: Number(row.last_accessed_at || row.updated_at || 0),
            score: scoreLocalSearchText(query, {
                title,
                snippet: searchableSnippet,
                author: String(row.author_name || ''),
            }) + sources.length * 4,
        };
    });
}

async function searchLocalAnnotations(query: string, terms: string[]) {
    const db = await getDatabase();
    const predicate = buildLikePredicate([
        'title',
        'author_name',
        'quote_text',
        'note_text',
    ], terms);
    const rows = await db.getAllAsync<any>(
        `SELECT * FROM content_annotations
          WHERE ${predicate.sql}
          ORDER BY updated_at DESC
          LIMIT 100`,
        ...predicate.params,
    );

    return rows.map((row): LocalSearchResult => {
        const title = String(row.title || '').trim() || '未命名内容';
        const quote = String(row.quote_text || '').trim();
        const note = String(row.note_text || '').trim();
        const snippet = note && terms.some((term) => note.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
            ? note
            : quote || note;
        return {
            key: `annotation:${row.id}`,
            kind: 'local-annotation',
            contentId: String(row.content_id),
            contentType: row.content_type === 'article' ? 'article' : 'answer',
            title,
            snippet: buildLocalSearchSnippet(snippet, query),
            author: String(row.author_name || '').trim() || '匿名用户',
            sources: ['annotation'],
            updatedAt: Number(row.updated_at || row.created_at || 0),
            score: scoreLocalSearchText(query, {
                title,
                snippet: `${quote}\n${note}`,
                author: String(row.author_name || ''),
            }) + 14,
            annotationId: String(row.id),
        };
    });
}

async function searchKnowledgeCards(query: string, terms: string[]) {
    const db = await getDatabase();
    const predicate = buildLikePredicate([
        'title',
        'author_name',
        'quote_text',
        'understanding_text',
        'tags_json',
    ], terms);
    const rows = await db.getAllAsync<any>(
        `SELECT * FROM knowledge_cards
          WHERE ${predicate.sql}
          ORDER BY updated_at DESC
          LIMIT 100`,
        ...predicate.params,
    );

    return rows.map((row): LocalSearchResult => {
        const title = String(row.title || '').trim() || '未命名内容';
        const quote = String(row.quote_text || '').trim();
        const understanding = String(row.understanding_text || '').trim();
        const snippet = understanding || quote;
        return {
            key: `knowledge:${row.id}`,
            kind: 'local-knowledge',
            contentId: String(row.content_id),
            contentType: row.content_type === 'article' ? 'article' : 'answer',
            title,
            snippet: buildLocalSearchSnippet(snippet, query),
            author: String(row.author_name || '').trim() || '匿名用户',
            sources: ['knowledge'],
            updatedAt: Number(row.updated_at || row.created_at || 0),
            score: scoreLocalSearchText(query, {
                title,
                snippet: `${quote}\n${understanding}\n${row.tags_json || ''}`,
                author: String(row.author_name || ''),
            }) + 16,
            knowledgeCardId: String(row.id),
        };
    });
}

async function searchOfflineComments(query: string, terms: string[]) {
    const db = await getDatabase();
    const predicate = buildLikePredicate([
        'cm.content_html',
        'cm.author_name',
        "COALESCE(cm.reply_to_author_name, '')",
    ], terms);
    const rows = await db.getAllAsync<any>(
        `SELECT cm.*, c.title, c.question_title
           FROM comments cm
           JOIN offline_pins op
             ON op.content_id = cm.content_id
            AND op.content_type = cm.content_type
            AND op.status = 'active'
           LEFT JOIN contents c
             ON c.id = cm.content_id AND c.type = cm.content_type
          WHERE cm.cache_state = 'pinned'
            AND ${predicate.sql}
          ORDER BY cm.last_accessed_at DESC
          LIMIT 100`,
        ...predicate.params,
    );

    return rows.map((row): LocalSearchResult => {
        const contentType: FeedType = row.content_type === 'article' ? 'article' : 'answer';
        const title = contentType === 'answer'
            ? String(row.question_title || row.title || '').trim() || '回答评论'
            : String(row.title || '').trim() || '文章评论';
        const commentText = htmlToPlainText(String(row.content_html || ''));
        return {
            key: `comment:${row.id}`,
            kind: 'local-comment',
            contentId: String(row.content_id),
            contentType,
            title,
            snippet: buildLocalSearchSnippet(commentText, query),
            author: String(row.author_name || '').trim() || '匿名用户',
            sources: ['offline'],
            updatedAt: Number(row.last_accessed_at || row.created_at || 0),
            score: scoreLocalSearchText(query, {
                title,
                snippet: commentText,
                author: String(row.author_name || ''),
            }) + 8,
        };
    });
}

export async function searchLocalDatabase(query: string) {
    const terms = normalizeLocalSearchTerms(query);
    if (!terms.length) return [] as LocalSearchResult[];

    const groups = await Promise.all([
        searchLocalContents(query, terms),
        searchLocalAnnotations(query, terms),
        searchKnowledgeCards(query, terms),
        searchOfflineComments(query, terms),
    ]);
    return sortResults(groups.flat()).slice(0, 180);
}
