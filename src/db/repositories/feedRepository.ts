import type { FeedItemInfo } from '@/src/types/zhihu';
import { getDatabase, withSerializedTransaction } from '../database';
import { contentToFeedItem } from './contentRepository';

const now = () => Date.now();

/**
 * Persist only the first occurrence of a feed item when repeat filtering is
 * enabled. SQLite is the durable history for this rule; the Zustand list is
 * only the current in-memory page.
 */
export async function saveFeedEntries(items: FeedItemInfo[], source = 'recommend', sessionId = '', deduplicate = true): Promise<FeedItemInfo[]> {
    const db = await getDatabase();
    if (items.length === 0) return [];

    const historicalRows = deduplicate
        ? await db.getAllAsync<{ content_id: string; content_type: string }>(
            `SELECT DISTINCT content_id, content_type
             FROM feed_entries
             WHERE ${items.map(() => '(content_id = ? AND content_type = ?)').join(' OR ')}`,
            items.flatMap((item) => [item.item.id, item.feedType]),
        )
        : [];
    const historicalKeys = new Set(historicalRows.map((row) => `${row.content_type}:${row.content_id}`));
    const batchKeys = new Set<string>();
    const itemsToPersist = items.filter((item) => {
        const key = `${item.feedType}:${item.item.id}`;
        // 关闭“历史去重”时，允许再次推送历史内容，但同一批响应里的
        // 重复记录仍只保留一份，避免同一篇内容在首页/缓存列表重复出现。
        if (batchKeys.has(key)) return false;
        batchKeys.add(key);
        return !deduplicate || !historicalKeys.has(key);
    });
    if (itemsToPersist.length === 0) return [];

    const timestamp = now();
    const batchId = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
    // Commit a recommendation page as one serialized transaction. The old
    // per-item transaction loop repeatedly woke SQLite and the UI thread while
    // the feed was scrolling.
    await withSerializedTransaction(async (transaction) => {
        for (let index = 0; index < itemsToPersist.length; index += 1) {
            const item = itemsToPersist[index];
            const content = item.item;
            await transaction.runAsync(
                `INSERT INTO contents (
                    id, type, title, excerpt, author_name, author_url_token, author_avatar,
                    question_id, question_title, question_author_name, question_author_avatar,
                    question_author_url_token, question_answer_count, question_created_time,
                    vote_count, comment_count, favorite_count, is_voted, created_at, updated_at,
                    first_seen_at, last_seen_at, last_accessed_at, has_body
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id, type) DO UPDATE SET
                    title = CASE WHEN TRIM(excluded.title) NOT IN ('', '无标题', '未知标题') THEN excluded.title ELSE contents.title END,
                    excerpt = CASE WHEN TRIM(excluded.excerpt) NOT IN ('', '暂无简介') THEN excluded.excerpt ELSE contents.excerpt END,
                    author_name = excluded.author_name,
                    author_url_token = excluded.author_url_token,
                    author_avatar = excluded.author_avatar,
                    question_id = excluded.question_id,
                    question_title = CASE WHEN TRIM(excluded.question_title) NOT IN ('', '未知问题', '无标题') THEN excluded.question_title ELSE contents.question_title END,
                    question_author_name = excluded.question_author_name,
                    question_author_avatar = excluded.question_author_avatar,
                    question_author_url_token = excluded.question_author_url_token,
                    question_answer_count = excluded.question_answer_count,
                    question_created_time = excluded.question_created_time,
                    vote_count = excluded.vote_count,
                    comment_count = excluded.comment_count,
                    favorite_count = excluded.favorite_count,
                    updated_at = excluded.updated_at,
                    last_seen_at = excluded.last_seen_at,
                    last_accessed_at = excluded.last_accessed_at,
                    has_body = MAX(contents.has_body, excluded.has_body)`,
                content.id, item.feedType, content.title, content.excerpt, content.authorName, content.authorUrlToken,
                content.authorAvatar, content.questionId, content.questionTitle, content.questionAuthorName,
                content.questionAuthorAvatar, content.questionAuthorUrlToken, content.questionAnswerCount,
                content.questionCreatedTime, content.voteCount, content.commentCount, content.favoriteCount,
                0, content.updatedTime || 0, content.updatedTime || 0, timestamp, timestamp, timestamp,
                content.content ? 1 : 0,
            );
            // Recommendation responses often include the full answer body.
            // Preserve it as transient content without opening another transaction.
            if (content.content) {
                const existingBody = await transaction.getFirstAsync<{ cache_state: 'transient' | 'pinned' }>(
                    'SELECT cache_state FROM content_bodies WHERE content_id = ? AND content_type = ?',
                    content.id, item.feedType,
                );
                const cacheState = existingBody?.cache_state === 'pinned' ? 'pinned' : 'transient';
                await transaction.runAsync(
                    `INSERT INTO content_bodies (content_id, content_type, html, fetched_at, last_accessed_at, cache_state)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(content_id, content_type) DO UPDATE SET
                       html = excluded.html,
                       fetched_at = excluded.fetched_at,
                       last_accessed_at = excluded.last_accessed_at,
                       cache_state = ?`,
                    content.id, item.feedType, content.content, timestamp, timestamp, cacheState, cacheState,
                );
            }
            await transaction.runAsync(
                `INSERT INTO feed_entries (content_id, content_type, source, position, session_id, batch_id, fetched_at, last_accessed_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                content.id, item.feedType, source, index, sessionId || null, batchId, timestamp, timestamp,
            );
        }
    });
    return itemsToPersist;
}

export async function getRecentFeed(limit = 80, pinnedOnly = false): Promise<FeedItemInfo[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
        pinnedOnly
            ? `SELECT c.*, b.html AS body_html, b.cache_state AS body_cache_state,
                      p.updated_at AS fetched_at, 0 AS position
               FROM offline_pins p
               JOIN contents c ON c.id = p.content_id AND c.type = p.content_type
               LEFT JOIN content_bodies b ON b.content_id = c.id AND b.content_type = c.type
               WHERE p.status = 'active'
               ORDER BY p.updated_at DESC
               LIMIT ?`
            : `SELECT c.*, b.html AS body_html, b.cache_state AS body_cache_state,
                      f.source, f.position, f.fetched_at
               FROM feed_entries f
               JOIN contents c ON c.id = f.content_id AND c.type = f.content_type
               LEFT JOIN content_bodies b ON b.content_id = c.id AND b.content_type = c.type
               ORDER BY f.fetched_at DESC, f.position ASC
               LIMIT ?`,
        limit,
    );
    const seen = new Set<string>();
    return rows.flatMap((row) => {
        const key = `${row.type}:${row.id}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{
            feedType: row.type,
            isAds: false,
            isPaid: false,
            item: contentToFeedItem({
                id: row.id,
                type: row.type,
                title: row.title,
                excerpt: row.excerpt,
                authorName: row.author_name,
                authorUrlToken: row.author_url_token,
                authorAvatar: row.author_avatar,
                questionId: row.question_id,
                questionTitle: row.question_title,
                questionAuthorName: row.question_author_name,
                questionAuthorAvatar: row.question_author_avatar,
                questionAuthorUrlToken: row.question_author_url_token,
                questionAnswerCount: row.question_answer_count,
                questionCreatedTime: row.question_created_time,
                voteCount: row.vote_count,
                commentCount: row.comment_count,
                favoriteCount: row.favorite_count,
                voted: Boolean(row.is_voted),
                updatedTime: row.updated_at,
                content: row.body_html || '',
                hasBody: Boolean(row.has_body),
                bodyCacheState: row.body_cache_state,
            }),
        } as FeedItemInfo];
    });
}

export async function trimTransientFeedEntries(maxEntries = 500) {
    const db = await getDatabase();
    await db.runAsync(
        `DELETE FROM feed_entries WHERE id NOT IN (
            SELECT id FROM feed_entries ORDER BY fetched_at DESC, id DESC LIMIT ?
         )`, maxEntries,
    );
}
