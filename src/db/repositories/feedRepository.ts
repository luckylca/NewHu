import type { FeedItemInfo } from '@/src/types/zhihu';
import { getDatabase } from '../database';
import { contentToFeedItem, upsertContent } from './contentRepository';

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
    // upsertContent owns its transaction; keep feed-entry writes separate to
    // avoid nesting transactions on the same SQLite connection.
    for (let index = 0; index < itemsToPersist.length; index += 1) {
        const item = itemsToPersist[index];
        await upsertContent(item.item, item.feedType, { cacheState: 'transient' });
        await db.runAsync(
            `INSERT INTO feed_entries (content_id, content_type, source, position, session_id, batch_id, fetched_at, last_accessed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            item.item.id, item.feedType, source, index, sessionId || null, batchId, timestamp, timestamp,
        );
    }
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
