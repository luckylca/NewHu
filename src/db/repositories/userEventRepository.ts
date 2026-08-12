import type { FeedType } from '@/src/types/zhihu';
import { getDatabase } from '../database';

export async function recordUserEvent(event: { contentId: string; contentType: FeedType; eventType: string; valueReal?: number; valueText?: string }) {
    const db = await getDatabase();
    await db.runAsync(
        'INSERT INTO user_events (content_id, content_type, event_type, value_real, value_text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        event.contentId, event.contentType, event.eventType, event.valueReal ?? null, event.valueText ?? null, Date.now(),
    );
}
