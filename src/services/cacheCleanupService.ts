import { removeTransientBody } from '@/src/db/repositories/contentRepository';
import { getCacheSummary } from '@/src/db/repositories/offlineCacheRepository';
import { cleanupResourceFiles } from './resourceService';
import { getDatabase } from '@/src/db/database';

const DEFAULT_LIMIT = 1024 * 1024 * 1024;

export async function cleanupTransientCache(limitBytes = DEFAULT_LIMIT) {
    const db = await getDatabase();
    let summary = await getCacheSummary();
    let currentBytes = summary.transientBytes;
    if (currentBytes <= limitBytes) return { deletedBytes: 0, summary };
    const target = Math.floor(limitBytes * 0.8);
    const bodies = await db.getAllAsync<{ content_id: string; content_type: 'answer' | 'article'; bytes: number }>(
        "SELECT content_id, content_type, LENGTH(html) AS bytes FROM content_bodies WHERE cache_state = 'transient' ORDER BY last_accessed_at ASC",
    );
    let deletedBytes = 0;
    for (const body of bodies) {
        if (currentBytes <= target) break;
        await removeTransientBody(body.content_id, body.content_type);
        currentBytes -= Number(body.bytes || 0);
        deletedBytes += Number(body.bytes || 0);
    }
    deletedBytes += await cleanupResourceFiles(100);
    await db.runAsync("DELETE FROM feed_entries WHERE id NOT IN (SELECT id FROM feed_entries ORDER BY fetched_at DESC, id DESC LIMIT 500)");
    summary = await getCacheSummary();
    return { deletedBytes, summary };
}
