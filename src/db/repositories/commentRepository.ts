import type { FeedType } from '@/src/types/zhihu';
import { getDatabase, withSerializedTransaction } from '../database';
import { commentToDb } from '../mappers';
import type { CacheState, DbComment, DbPageState } from '../types';
import type { CommentViewModel } from '@/src/components/CommentItem';

const now = () => Date.now();

function rowToComment(row: any): DbComment {
    return {
        id: row.id,
        content: row.content_html,
        createdTime: Number(row.created_at || 0),
        authorUrlToken: row.author_url_token || undefined,
        authorName: row.author_name,
        authorAvatar: row.author_avatar || undefined,
        voteCount: Number(row.vote_count || 0),
        isVote: Boolean(row.is_voted),
        isAuthor: Boolean(row.is_author),
        isHot: Boolean(row.is_hot),
        isTop: Boolean(row.is_top),
        childCommentCount: Number(row.child_comment_count || 0),
        replyToAuthorName: row.reply_to_author_name || undefined,
        contentId: row.content_id,
        contentType: row.content_type,
        parentCommentId: row.parent_comment_id,
        rootCommentId: row.root_comment_id,
        cacheState: row.cache_state,
        syncStatus: row.sync_status,
        localOnly: Boolean(row.local_only),
    };
}

export async function saveCommentPage(options: {
    contentId: string;
    contentType: FeedType;
    parentCommentId: string | null;
    orderBy: string;
    comments: CommentViewModel[];
    nextOffset: string;
    isEnd: boolean;
    totalCount: number;
    cacheState?: CacheState;
    rootComment?: CommentViewModel | null;
}) {
    const timestamp = now();
    const { contentId, contentType, parentCommentId, orderBy, comments, nextOffset, isEnd, totalCount, cacheState = 'transient', rootComment } = options;
    await withSerializedTransaction(async (transaction) => {
        if (rootComment && parentCommentId) {
            await saveComment(transaction, commentToDb(rootComment, contentId, contentType, null, cacheState), timestamp);
        }
        const positionRow = await transaction.getFirstAsync<{ position: number }>(
            'SELECT COALESCE(MAX(position), -1) AS position FROM comment_list_entries WHERE content_id = ? AND content_type = ? AND parent_comment_id IS ? AND order_by = ?',
            contentId, contentType, parentCommentId, orderBy,
        );
        const basePosition = Number(positionRow?.position ?? -1) + 1;
        for (let index = 0; index < comments.length; index += 1) {
            const comment = commentToDb(comments[index], contentId, contentType, parentCommentId, cacheState);
            await saveComment(transaction, comment, timestamp);
            // SQLite permits NULL inside a composite primary key, so the
            // declared conflict target does not de-duplicate root comments.
            await transaction.runAsync(
                'DELETE FROM comment_list_entries WHERE content_id = ? AND content_type = ? AND parent_comment_id IS ? AND order_by = ? AND comment_id = ?',
                contentId, contentType, parentCommentId, orderBy, comment.id,
            );
            await transaction.runAsync(
                `INSERT INTO comment_list_entries (content_id, content_type, parent_comment_id, order_by, comment_id, position, fetched_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                contentId, contentType, parentCommentId, orderBy, comment.id, basePosition + index, timestamp,
            );
        }
        const loadedRow = await transaction.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) AS count FROM comment_list_entries WHERE content_id = ? AND content_type = ? AND parent_comment_id IS ? AND order_by = ?`,
            contentId, contentType, parentCommentId, orderBy,
        );
        await transaction.runAsync(
            'DELETE FROM comment_page_state WHERE content_id = ? AND content_type = ? AND parent_comment_id IS ? AND order_by = ?',
            contentId, contentType, parentCommentId, orderBy,
        );
        await transaction.runAsync(
            `INSERT INTO comment_page_state (content_id, content_type, parent_comment_id, order_by, next_offset, is_end, total_count, loaded_count, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             `,
            contentId, contentType, parentCommentId, orderBy, nextOffset, isEnd ? 1 : 0, totalCount, Number(loadedRow?.count ?? 0), timestamp,
        );
    });
}

async function saveComment(db: Awaited<ReturnType<typeof getDatabase>>, comment: DbComment, timestamp: number) {
    await db.runAsync(
        `INSERT INTO comments (
            id, content_id, content_type, parent_comment_id, root_comment_id, content_html,
            author_url_token, author_name, author_avatar, vote_count, is_voted, is_author,
            is_hot, is_top, created_at, child_comment_count, reply_to_author_name,
            cache_state, sync_status, local_only, fetched_at, last_accessed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           content_id = excluded.content_id, content_type = excluded.content_type,
           parent_comment_id = excluded.parent_comment_id, root_comment_id = excluded.root_comment_id,
           content_html = excluded.content_html, author_url_token = excluded.author_url_token,
           author_name = excluded.author_name, author_avatar = excluded.author_avatar,
           vote_count = excluded.vote_count, is_voted = excluded.is_voted, is_author = excluded.is_author,
           is_hot = excluded.is_hot, is_top = excluded.is_top, created_at = excluded.created_at,
           child_comment_count = excluded.child_comment_count, reply_to_author_name = excluded.reply_to_author_name,
           cache_state = CASE WHEN comments.cache_state = 'pinned' THEN 'pinned' ELSE excluded.cache_state END,
           sync_status = CASE WHEN comments.local_only = 1 THEN comments.sync_status ELSE excluded.sync_status END,
           local_only = comments.local_only, fetched_at = excluded.fetched_at, last_accessed_at = excluded.last_accessed_at`,
        comment.id, comment.contentId, comment.contentType, comment.parentCommentId, comment.rootCommentId,
        comment.content, comment.authorUrlToken || null, comment.authorName || '', comment.authorAvatar || null,
        comment.voteCount, comment.isVote ? 1 : 0, comment.isAuthor ? 1 : 0, comment.isHot ? 1 : 0,
        comment.isTop ? 1 : 0, comment.createdTime, comment.childCommentCount, comment.replyToAuthorName || null,
        comment.cacheState, comment.syncStatus, comment.localOnly ? 1 : 0, timestamp, timestamp,
    );
}

export async function getCachedComments(contentId: string, contentType: FeedType, parentCommentId: string | null, orderBy: string): Promise<DbComment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
        `SELECT c.* FROM comment_list_entries e JOIN comments c ON c.id = e.comment_id
         WHERE e.content_id = ? AND e.content_type = ? AND e.parent_comment_id IS ? AND e.order_by = ?
         ORDER BY e.position ASC`, contentId, contentType, parentCommentId, orderBy,
    );
    if (rows.length) {
        await db.runAsync('UPDATE comments SET last_accessed_at = ? WHERE id IN (' + rows.map(() => '?').join(',') + ')', now(), ...rows.map((row) => row.id));
    }
    return rows.map(rowToComment);
}

export async function getPageState(contentId: string, contentType: FeedType, parentCommentId: string | null, orderBy: string): Promise<DbPageState | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
        'SELECT * FROM comment_page_state WHERE content_id = ? AND content_type = ? AND parent_comment_id IS ? AND order_by = ?',
        contentId, contentType, parentCommentId, orderBy,
    );
    if (!row) return null;
    return { contentId, contentType, parentCommentId, orderBy, nextOffset: row.next_offset, isEnd: Boolean(row.is_end), totalCount: row.total_count, loadedCount: row.loaded_count, updatedAt: row.updated_at };
}

export async function insertLocalComment(options: { contentId: string; contentType: FeedType; comment: CommentViewModel; parentCommentId: string | null; orderBy: string }) {
    const timestamp = now();
    const comment = commentToDb(options.comment, options.contentId, options.contentType, options.parentCommentId, 'transient');
    await withSerializedTransaction(async (transaction) => {
        await saveComment(transaction, comment, timestamp);
        const max = await transaction.getFirstAsync<{ position: number }>(
            'SELECT COALESCE(MAX(position), -1) AS position FROM comment_list_entries WHERE content_id = ? AND content_type = ? AND parent_comment_id IS ? AND order_by = ?',
            options.contentId, options.contentType, options.parentCommentId, options.orderBy,
        );
        await transaction.runAsync(
            'DELETE FROM comment_list_entries WHERE content_id = ? AND content_type = ? AND parent_comment_id IS ? AND order_by = ? AND comment_id = ?',
            options.contentId, options.contentType, options.parentCommentId, options.orderBy, comment.id,
        );
        await transaction.runAsync(
            `INSERT INTO comment_list_entries (content_id, content_type, parent_comment_id, order_by, comment_id, position, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            options.contentId, options.contentType, options.parentCommentId, options.orderBy, comment.id, Number(max?.position ?? -1) + 1, timestamp,
        );
    });
}

export async function updateCommentVote(id: string, liked: boolean, voteCount: number) {
    const db = await getDatabase();
    await db.runAsync('UPDATE comments SET is_voted = ?, vote_count = ?, last_accessed_at = ? WHERE id = ?', liked ? 1 : 0, voteCount, now(), id);
}

export async function getCommentById(id: string): Promise<DbComment | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM comments WHERE id = ?', id);
    return row ? rowToComment(row) : null;
}

export async function replaceLocalCommentId(localId: string, serverId: string) {
    if (!localId.startsWith('local:')) return;
    await withSerializedTransaction(async (transaction) => {
        const exists = await transaction.getFirstAsync<{ id: string }>('SELECT id FROM comments WHERE id = ?', serverId);
        if (exists) {
            await transaction.runAsync('DELETE FROM comments WHERE id = ?', localId);
        } else {
            await transaction.runAsync('UPDATE comments SET id = ?, local_only = 0, sync_status = \'synced\' WHERE id = ?', serverId, localId);
            await transaction.runAsync('UPDATE comments SET parent_comment_id = ? WHERE parent_comment_id = ?', serverId, localId);
            await transaction.runAsync('UPDATE comments SET root_comment_id = ? WHERE root_comment_id = ?', serverId, localId);
            await transaction.runAsync('UPDATE comment_list_entries SET comment_id = ? WHERE comment_id = ?', serverId, localId);
        }
        await transaction.runAsync(
            "UPDATE pending_actions SET payload_json = REPLACE(payload_json, ?, ?) WHERE payload_json LIKE '%' || ? || '%'",
            localId, serverId, localId,
        );
    });
}

export async function markContentCommentsPinned(contentId: string, contentType: FeedType) {
    const db = await getDatabase();
    await db.runAsync('UPDATE comments SET cache_state = \'pinned\' WHERE content_id = ? AND content_type = ? AND local_only = 0', contentId, contentType);
}

export async function markCommentsPinned(contentId: string, contentType: FeedType, rootIds: string[], childLimit: number) {
    if (!rootIds.length) return;
    await withSerializedTransaction(async (transaction) => {
        const rootPlaceholders = rootIds.map(() => '?').join(',');
        await transaction.runAsync(`UPDATE comments SET cache_state = 'pinned' WHERE id IN (${rootPlaceholders}) AND local_only = 0`, ...rootIds);
        for (const rootId of rootIds) {
            const children = await transaction.getAllAsync<{ comment_id: string }>(
                `SELECT comment_id FROM comment_list_entries WHERE content_id = ? AND content_type = ? AND parent_comment_id = ? AND order_by = 'ts' ORDER BY position ASC LIMIT ?`,
                contentId, contentType, rootId, childLimit,
            );
            if (children.length) {
                const placeholders = children.map(() => '?').join(',');
                await transaction.runAsync(`UPDATE comments SET cache_state = 'pinned' WHERE id IN (${placeholders}) AND local_only = 0`, ...children.map((item) => item.comment_id));
            }
        }
    });
}

export async function downgradeContentComments(contentId: string, contentType: FeedType) {
    const db = await getDatabase();
    await db.runAsync("UPDATE comments SET cache_state = 'transient' WHERE content_id = ? AND content_type = ? AND local_only = 0", contentId, contentType);
}
