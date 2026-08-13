import type { FeedType } from '@/src/types/zhihu';
import { getDatabase, withSerializedTransaction } from '../database';

export async function recordUserEvent(event: { contentId: string; contentType: FeedType; eventType: string; valueReal?: number; valueText?: string }) {
    const db = await getDatabase();
    await db.runAsync(
        'INSERT INTO user_events (content_id, content_type, event_type, value_real, value_text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        event.contentId, event.contentType, event.eventType, event.valueReal ?? null, event.valueText ?? null, Date.now(),
    );
}

/** Removes all locally derived interest data without touching reading content or offline pins. */
export async function clearInterestProfile() {
    await withSerializedTransaction(async (db) => {
        await db.runAsync('DELETE FROM user_events');
        await db.runAsync('DELETE FROM content_embeddings');
    });
}
