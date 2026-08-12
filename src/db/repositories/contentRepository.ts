import type { FeedDetail, FeedItem, FeedType } from '@/src/types/zhihu';
import { getDatabase, withSerializedTransaction } from '../database';
import { contentToItem } from '../mappers';
import type { CacheState, DbContent } from '../types';

const now = () => Date.now();

type ContentRow = {
    id: string; type: FeedType; title: string; excerpt: string;
    author_name: string; author_url_token: string; author_avatar: string;
    question_id: string; question_title: string; question_author_name: string;
    question_author_avatar: string; question_author_url_token: string;
    question_answer_count: number; question_created_time: number;
    vote_count: number; comment_count: number; favorite_count: number;
    is_voted: number; created_at: number; updated_at: number;
    has_body: number; body_html?: string; body_cache_state?: CacheState;
};

function rowToContent(row: ContentRow): DbContent {
    return {
        id: row.id,
        title: row.title,
        authorName: row.author_name,
        authorUrlToken: row.author_url_token,
        authorAvatar: row.author_avatar,
        excerpt: row.excerpt,
        updatedTime: row.updated_at,
        voteCount: row.vote_count,
        voted: Boolean(row.is_voted),
        favoriteCount: row.favorite_count,
        commentCount: row.comment_count,
        content: row.body_html || '',
        questionTitle: row.question_title,
        questionId: row.question_id,
        questionAuthorName: row.question_author_name,
        questionAuthorAvatar: row.question_author_avatar,
        questionAuthorUrlToken: row.question_author_url_token,
        questionAnswerCount: row.question_answer_count,
        questionCreatedTime: row.question_created_time,
        type: row.type,
        hasBody: Boolean(row.has_body),
        bodyCacheState: row.body_cache_state,
    };
}

export async function upsertContent(content: FeedItem | FeedDetail, type: FeedType, options: { cacheState?: CacheState; voted?: boolean } = {}) {
    const timestamp = now();
    const cacheState = options.cacheState ?? 'transient';
    const body = content.content || '';
    await withSerializedTransaction(async (transaction) => {
        const existingBody = await transaction.getFirstAsync<{ cache_state: CacheState }>(
            'SELECT cache_state FROM content_bodies WHERE content_id = ? AND content_type = ?',
            content.id, type,
        );
        const effectiveState: CacheState = existingBody?.cache_state === 'pinned' || cacheState === 'pinned' ? 'pinned' : 'transient';
        await transaction.runAsync(
            `INSERT INTO contents (
                id, type, title, excerpt, author_name, author_url_token, author_avatar,
                question_id, question_title, question_author_name, question_author_avatar,
                question_author_url_token, question_answer_count, question_created_time,
                vote_count, comment_count, favorite_count, is_voted, created_at, updated_at,
                first_seen_at, last_seen_at, last_accessed_at, has_body
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id, type) DO UPDATE SET
                title = CASE
                    WHEN TRIM(excluded.title) NOT IN ('', '无标题', '未知标题') THEN excluded.title
                    ELSE contents.title
                END,
                excerpt = CASE
                    WHEN TRIM(excluded.excerpt) NOT IN ('', '暂无简介') THEN excluded.excerpt
                    ELSE contents.excerpt
                END,
                author_name = excluded.author_name,
                author_url_token = excluded.author_url_token,
                author_avatar = excluded.author_avatar,
                question_id = excluded.question_id,
                question_title = CASE
                    WHEN TRIM(excluded.question_title) NOT IN ('', '未知问题', '无标题') THEN excluded.question_title
                    ELSE contents.question_title
                END,
                question_author_name = excluded.question_author_name,
                question_author_avatar = excluded.question_author_avatar,
                question_author_url_token = excluded.question_author_url_token,
                question_answer_count = excluded.question_answer_count,
                question_created_time = excluded.question_created_time,
                vote_count = excluded.vote_count,
                comment_count = excluded.comment_count,
                favorite_count = excluded.favorite_count,
                is_voted = excluded.is_voted,
                updated_at = excluded.updated_at,
                last_seen_at = excluded.last_seen_at,
                last_accessed_at = excluded.last_accessed_at,
                has_body = MAX(contents.has_body, excluded.has_body)`,
            content.id, type, content.title, content.excerpt, content.authorName, content.authorUrlToken,
            content.authorAvatar, content.questionId, content.questionTitle, content.questionAuthorName,
            content.questionAuthorAvatar, content.questionAuthorUrlToken, content.questionAnswerCount,
            content.questionCreatedTime, content.voteCount, content.commentCount, content.favoriteCount,
            (options.voted ?? ('voted' in content ? Boolean(content.voted) : false)) ? 1 : 0,
            content.updatedTime || 0, content.updatedTime || 0, timestamp, timestamp, timestamp, body ? 1 : 0,
        );
        if (body) {
            await transaction.runAsync(
                `INSERT INTO content_bodies (content_id, content_type, html, fetched_at, last_accessed_at, cache_state)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(content_id, content_type) DO UPDATE SET
                   html = excluded.html,
                   fetched_at = excluded.fetched_at,
                   last_accessed_at = excluded.last_accessed_at,
                   cache_state = ?`,
                content.id, type, body, timestamp, timestamp, effectiveState, effectiveState,
            );
        }
    });
}

export async function getContent(id: string, type: FeedType): Promise<DbContent | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ContentRow>(
        `SELECT c.*, b.html AS body_html, b.cache_state AS body_cache_state
         FROM contents c LEFT JOIN content_bodies b
         ON b.content_id = c.id AND b.content_type = c.type
         WHERE c.id = ? AND c.type = ?`, id, type,
    );
    if (!row) return null;
    await touchContent(id, type);
    return rowToContent(row);
}

export async function touchContent(id: string, type: FeedType) {
    const db = await getDatabase();
    const timestamp = now();
    await db.runAsync('UPDATE contents SET last_accessed_at = ? WHERE id = ? AND type = ?', timestamp, id, type);
    await db.runAsync('UPDATE content_bodies SET last_accessed_at = ? WHERE content_id = ? AND content_type = ?', timestamp, id, type);
}

export async function markBodyCacheState(id: string, type: FeedType, state: CacheState) {
    const db = await getDatabase();
    await db.runAsync('UPDATE content_bodies SET cache_state = ? WHERE content_id = ? AND content_type = ?', state, id, type);
}

export async function removeTransientBody(id: string, type: FeedType) {
    await withSerializedTransaction(async (transaction) => {
        await transaction.runAsync('DELETE FROM content_bodies WHERE content_id = ? AND content_type = ? AND cache_state = \'transient\'', id, type);
        await transaction.runAsync('DELETE FROM comment_list_entries WHERE content_id = ? AND content_type = ? AND comment_id IN (SELECT id FROM comments WHERE cache_state = \'transient\' AND local_only = 0)', id, type);
        await transaction.runAsync('DELETE FROM comments WHERE content_id = ? AND content_type = ? AND cache_state = \'transient\' AND local_only = 0', id, type);
    });
}

export function contentToFeedItem(content: DbContent): FeedItem {
    return contentToItem(content);
}
