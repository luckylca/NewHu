import type { FeedType } from '@/src/types/zhihu';
import { getDatabase, withSerializedTransaction } from '../database';
import type { CacheJob, OfflinePin, RootCommentMode } from '../types';

const now = () => Date.now();

function rowToPin(row: any): OfflinePin {
    return {
        contentId: row.content_id,
        contentType: row.content_type,
        rootCommentMode: row.root_comment_mode,
        rootCommentLimit: Number(row.root_comment_limit),
        childCommentLimit: Number(row.child_comment_limit),
        withImages: Boolean(row.with_images),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
    };
}

function rowToJob(row: any): CacheJob {
    return {
        id: row.id,
        contentId: row.content_id,
        contentType: row.content_type,
        status: row.status,
        rootTarget: row.root_target == null ? null : Number(row.root_target),
        rootCached: Number(row.root_cached),
        childCached: Number(row.child_cached),
        imageTotal: Number(row.image_total),
        imageCached: Number(row.image_cached),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastError: row.last_error,
    };
}

export async function getOfflinePin(contentId: string, contentType: FeedType) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM offline_pins WHERE content_id = ? AND content_type = ?', contentId, contentType);
    return row ? rowToPin(row) : null;
}

export async function listOfflinePins(): Promise<OfflinePin[]> {
    const db = await getDatabase();
    return (await db.getAllAsync<any>("SELECT * FROM offline_pins WHERE status = 'active' ORDER BY updated_at DESC")).map(rowToPin);
}

export type OfflineCacheListItem = OfflinePin & {
    title: string;
    excerpt: string;
    authorName: string;
    bytes: number;
    commentCount: number;
};

function usableTitle(value: unknown) {
    const title = String(value || '').trim();
    return title && !['无标题', '未知标题', '未知问题'].includes(title) ? title : '';
}

/** List offline entries with their logical local size, without touching access timestamps. */
export async function listOfflineCacheItems(): Promise<OfflineCacheListItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
        `WITH comment_stats AS (
            SELECT content_id, content_type,
                   SUM(LENGTH(content_html) + LENGTH(COALESCE(author_name, '')) + LENGTH(COALESCE(author_avatar, ''))) AS bytes,
                   COUNT(*) AS count
              FROM comments
             WHERE cache_state = 'pinned'
             GROUP BY content_id, content_type
         ), resource_owners AS (
            SELECT DISTINCT rr.owner_id, rr.owner_type, rr.resource_id
              FROM resource_refs rr
              JOIN offline_pins active
                ON active.content_id = rr.owner_id
               AND active.content_type = rr.owner_type
               AND active.status = 'active'
         ), resource_stats AS (
            SELECT ro.owner_id, ro.owner_type, SUM(r.file_size) AS bytes
              FROM resource_owners ro
              JOIN resources r ON r.id = ro.resource_id AND r.status = 'ready'
             GROUP BY ro.owner_id, ro.owner_type
         )
         SELECT p.*, c.title, c.question_title, c.excerpt, c.author_name,
                COALESCE(LENGTH(b.html), 0) AS body_bytes,
                COALESCE(cs.bytes, 0) AS comment_bytes,
                COALESCE(rs.bytes, 0) AS resource_bytes,
                COALESCE(cs.count, 0) AS cached_comment_count
         FROM offline_pins p
         JOIN contents c ON c.id = p.content_id AND c.type = p.content_type
         LEFT JOIN content_bodies b ON b.content_id = p.content_id AND b.content_type = p.content_type
         LEFT JOIN comment_stats cs ON cs.content_id = p.content_id AND cs.content_type = p.content_type
         LEFT JOIN resource_stats rs ON rs.owner_id = p.content_id AND rs.owner_type = p.content_type
         WHERE p.status = 'active'
         ORDER BY p.updated_at DESC`,
    );
    return rows.map((row) => {
        const pin = rowToPin(row);
        const title = pin.contentType === 'answer'
            ? usableTitle(row.question_title) || usableTitle(row.title)
            : usableTitle(row.title) || usableTitle(row.question_title);
        return {
            ...pin,
            title: title || String(row.excerpt || '').trim().slice(0, 60) || `${pin.contentType === 'answer' ? '回答' : '文章'} ${pin.contentId}`,
            excerpt: String(row.excerpt || '').trim(),
            authorName: String(row.author_name || '').trim(),
            bytes: Number(row.body_bytes || 0) + Number(row.comment_bytes || 0) + Number(row.resource_bytes || 0),
            commentCount: Number(row.cached_comment_count || 0),
        };
    });
}

export async function upsertOfflinePin(options: {
    contentId: string; contentType: FeedType; rootCommentMode: RootCommentMode;
    rootCommentLimit: number; childCommentLimit: number; withImages: boolean;
}) {
    const db = await getDatabase();
    const timestamp = now();
    await db.runAsync(
        `INSERT INTO offline_pins (content_id, content_type, root_comment_mode, root_comment_limit, child_comment_limit, with_images, created_at, updated_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
         ON CONFLICT(content_id, content_type) DO UPDATE SET root_comment_mode = excluded.root_comment_mode,
           root_comment_limit = excluded.root_comment_limit, child_comment_limit = excluded.child_comment_limit,
           with_images = excluded.with_images, updated_at = excluded.updated_at, status = 'active'`,
        options.contentId, options.contentType, options.rootCommentMode, options.rootCommentLimit,
        options.childCommentLimit, options.withImages ? 1 : 0, timestamp, timestamp,
    );
}

export async function removeOfflinePin(contentId: string, contentType: FeedType) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM offline_pins WHERE content_id = ? AND content_type = ?', contentId, contentType);
}

export type OfflineCacheTarget = { contentId: string; contentType: FeedType };

/**
 * Remove the selected offline payload in one serialized transaction. Metadata
 * and feed history are retained so recommendation de-duplication is unchanged.
 */
export async function purgeOfflineCacheRecords(targets: OfflineCacheTarget[]) {
    if (!targets.length) return [] as { id: string; localUri: string | null }[];
    return withSerializedTransaction(async (db) => {
        await db.execAsync(`
            CREATE TEMP TABLE IF NOT EXISTS offline_delete_targets (
                content_id TEXT NOT NULL,
                content_type TEXT NOT NULL,
                PRIMARY KEY (content_id, content_type)
            );
            DELETE FROM offline_delete_targets;
            DROP TABLE IF EXISTS offline_delete_resources;
        `);
        for (const target of targets) {
            await db.runAsync(
                'INSERT OR IGNORE INTO offline_delete_targets (content_id, content_type) VALUES (?, ?)',
                target.contentId,
                target.contentType,
            );
        }
        await db.execAsync(`
            CREATE TEMP TABLE offline_delete_resources AS
            SELECT DISTINCT r.id, r.local_uri
            FROM resources r
            JOIN resource_refs rr ON rr.resource_id = r.id
            JOIN offline_delete_targets t
              ON t.content_id = rr.owner_id AND t.content_type = rr.owner_type;

            DELETE FROM offline_pins
             WHERE EXISTS (SELECT 1 FROM offline_delete_targets t WHERE t.content_id = offline_pins.content_id AND t.content_type = offline_pins.content_type);
            DELETE FROM content_bodies
             WHERE EXISTS (SELECT 1 FROM offline_delete_targets t WHERE t.content_id = content_bodies.content_id AND t.content_type = content_bodies.content_type);
            UPDATE contents SET has_body = 0
             WHERE EXISTS (SELECT 1 FROM offline_delete_targets t WHERE t.content_id = contents.id AND t.content_type = contents.type);
            DELETE FROM comment_list_entries
             WHERE EXISTS (SELECT 1 FROM offline_delete_targets t WHERE t.content_id = comment_list_entries.content_id AND t.content_type = comment_list_entries.content_type);
            DELETE FROM comment_page_state
             WHERE EXISTS (SELECT 1 FROM offline_delete_targets t WHERE t.content_id = comment_page_state.content_id AND t.content_type = comment_page_state.content_type);
            DELETE FROM comments
             WHERE local_only = 0 AND EXISTS (SELECT 1 FROM offline_delete_targets t WHERE t.content_id = comments.content_id AND t.content_type = comments.content_type);
            DELETE FROM cache_jobs
             WHERE EXISTS (SELECT 1 FROM offline_delete_targets t WHERE t.content_id = cache_jobs.content_id AND t.content_type = cache_jobs.content_type);
            DELETE FROM resource_refs
             WHERE EXISTS (SELECT 1 FROM offline_delete_targets t WHERE t.content_id = resource_refs.owner_id AND t.content_type = resource_refs.owner_type);
        `);

        const orphaned = await db.getAllAsync<{ id: string; local_uri: string | null }>(
            `SELECT r.id, r.local_uri
             FROM resources r JOIN offline_delete_resources d ON d.id = r.id
             WHERE NOT EXISTS (SELECT 1 FROM resource_refs rr WHERE rr.resource_id = r.id)`,
        );
        // A subquery avoids SQLite's bind-variable limit when "select all"
        // releases thousands of image files at once.
        await db.execAsync(`
            DELETE FROM resources
             WHERE id IN (SELECT id FROM offline_delete_resources)
               AND NOT EXISTS (SELECT 1 FROM resource_refs rr WHERE rr.resource_id = resources.id);
            DROP TABLE offline_delete_resources;
            DELETE FROM offline_delete_targets;
        `);
        return orphaned.map((item) => ({ id: item.id, localUri: item.local_uri }));
    });
}

export async function createCacheJob(contentId: string, contentType: FeedType, rootTarget: number | null) {
    const db = await getDatabase();
    const id = `cache:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = now();
    await db.runAsync(
        `INSERT INTO cache_jobs (id, content_id, content_type, status, root_target, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?)`, id, contentId, contentType, rootTarget, timestamp, timestamp,
    );
    return id;
}

export async function updateCacheJob(id: string, update: Partial<Pick<CacheJob, 'status' | 'rootCached' | 'childCached' | 'imageTotal' | 'imageCached' | 'lastError'>>) {
    const db = await getDatabase();
    const current = await db.getFirstAsync<any>('SELECT * FROM cache_jobs WHERE id = ?', id);
    if (!current) return;
    const next = { ...rowToJob(current), ...update } as CacheJob;
    await db.runAsync(
        `UPDATE cache_jobs SET status = ?, root_cached = ?, child_cached = ?, image_total = ?, image_cached = ?, updated_at = ?, last_error = ? WHERE id = ?`,
        next.status, next.rootCached, next.childCached, next.imageTotal, next.imageCached, now(), next.lastError, id,
    );
}

export async function getCacheJob(id: string) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM cache_jobs WHERE id = ?', id);
    return row ? rowToJob(row) : null;
}

export async function recoverRunningJobs() {
    const db = await getDatabase();
    await db.runAsync("UPDATE cache_jobs SET status = 'paused', updated_at = ? WHERE status = 'running'", now());
}

export async function getCacheSummary() {
    const db = await getDatabase();
    const bodyRow = await db.getFirstAsync<{ transient_bytes: number; pinned_bytes: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN cache_state = 'transient' THEN LENGTH(html) ELSE 0 END), 0) AS transient_bytes,
           COALESCE(SUM(CASE WHEN cache_state = 'pinned' THEN LENGTH(html) ELSE 0 END), 0) AS pinned_bytes
         FROM content_bodies`,
    );
    const commentRow = await db.getFirstAsync<{ transient_bytes: number; pinned_bytes: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN cache_state = 'transient' THEN LENGTH(content_html) + LENGTH(COALESCE(author_name, '')) + LENGTH(COALESCE(author_avatar, '')) ELSE 0 END), 0) AS transient_bytes,
           COALESCE(SUM(CASE WHEN cache_state = 'pinned' THEN LENGTH(content_html) + LENGTH(COALESCE(author_name, '')) + LENGTH(COALESCE(author_avatar, '')) ELSE 0 END), 0) AS pinned_bytes
         FROM comments WHERE local_only = 0`,
    );
    const resourceRow = await db.getFirstAsync<{ transient_bytes: number; pinned_bytes: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN EXISTS (
             SELECT 1 FROM resource_refs rr JOIN offline_pins p
               ON p.content_id = rr.owner_id AND p.content_type = rr.owner_type AND p.status = 'active'
             WHERE rr.resource_id = r.id
           ) THEN 0 ELSE r.file_size END), 0) AS transient_bytes,
           COALESCE(SUM(CASE WHEN EXISTS (
             SELECT 1 FROM resource_refs rr JOIN offline_pins p
               ON p.content_id = rr.owner_id AND p.content_type = rr.owner_type AND p.status = 'active'
             WHERE rr.resource_id = r.id
           ) THEN r.file_size ELSE 0 END), 0) AS pinned_bytes
         FROM resources r WHERE r.status = 'ready'`,
    );
    const commentsRow = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM comments WHERE local_only = 0");
    const outboxRow = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM pending_actions WHERE status NOT IN ('synced')");
    const pinnedCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM offline_pins WHERE status = 'active'");
    const modelRow = await db.getFirstAsync<{ bytes: number; count: number }>(
        "SELECT COALESCE(SUM(LENGTH(embedding)), 0) AS bytes, COUNT(*) AS count FROM content_embeddings WHERE embedding IS NOT NULL",
    );
    const readingRow = await db.getFirstAsync<{ bytes: number; count: number }>(
        `SELECT COALESCE(SUM(
            LENGTH(content_id) + LENGTH(content_type) + LENGTH(event_type) + LENGTH(COALESCE(value_text, '')) + 32
         ), 0) AS bytes, COUNT(*) AS count FROM user_events`,
    );
    const transientBytes = Number(bodyRow?.transient_bytes ?? 0)
        + Number(commentRow?.transient_bytes ?? 0)
        + Number(resourceRow?.transient_bytes ?? 0);
    const pinnedBytes = Number(bodyRow?.pinned_bytes ?? 0)
        + Number(commentRow?.pinned_bytes ?? 0)
        + Number(resourceRow?.pinned_bytes ?? 0);
    return {
        transientBytes,
        pinnedBytes,
        modelBytes: Number(modelRow?.bytes ?? 0),
        readingBytes: Number(readingRow?.bytes ?? 0),
        managedBytes: transientBytes + pinnedBytes + Number(modelRow?.bytes ?? 0) + Number(readingRow?.bytes ?? 0),
        commentCount: Number(commentsRow?.count ?? 0),
        outboxCount: Number(outboxRow?.count ?? 0),
        pinnedCount: Number(pinnedCount?.count ?? 0),
        modelCount: Number(modelRow?.count ?? 0),
        readingCount: Number(readingRow?.count ?? 0),
    };
}
