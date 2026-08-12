import type { FeedType } from '@/src/types/zhihu';
import { getDatabase } from '../database';
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
    return {
        transientBytes: Number(bodyRow?.transient_bytes ?? 0) + Number(resourceRow?.transient_bytes ?? 0),
        pinnedBytes: Number(bodyRow?.pinned_bytes ?? 0) + Number(resourceRow?.pinned_bytes ?? 0),
        commentCount: Number(commentsRow?.count ?? 0),
        outboxCount: Number(outboxRow?.count ?? 0),
        pinnedCount: Number(pinnedCount?.count ?? 0),
    };
}
