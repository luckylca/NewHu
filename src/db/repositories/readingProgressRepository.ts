import type { FeedType } from '@/src/types/zhihu';
import type { ReadingProgress } from '../types';
import { getDatabase } from '../database';

type ReadingProgressRow = {
    content_id: string;
    content_type: FeedType;
    scroll_offset: number;
    scroll_ratio: number;
    max_scroll_ratio: number;
    completed: number;
    content_height: number;
    viewport_height: number;
    updated_at: number;
};

function rowToReadingProgress(row: ReadingProgressRow): ReadingProgress {
    return {
        contentId: row.content_id,
        contentType: row.content_type,
        scrollOffset: Number(row.scroll_offset || 0),
        scrollRatio: Number(row.scroll_ratio || 0),
        maxScrollRatio: Number(row.max_scroll_ratio || 0),
        completed: Boolean(row.completed),
        contentHeight: Number(row.content_height || 0),
        viewportHeight: Number(row.viewport_height || 0),
        updatedAt: Number(row.updated_at || 0),
    };
}

export async function getReadingProgress(contentId: string, contentType: FeedType) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ReadingProgressRow>(
        'SELECT * FROM reading_progress WHERE content_id = ? AND content_type = ?',
        contentId,
        contentType,
    );
    return row ? rowToReadingProgress(row) : null;
}

export async function saveReadingProgress(
    progress: Omit<ReadingProgress, 'updatedAt'> & { updatedAt?: number },
) {
    const db = await getDatabase();
    const updatedAt = progress.updatedAt ?? Date.now();
    await db.runAsync(
        `INSERT INTO reading_progress (
            content_id, content_type, scroll_offset, scroll_ratio, max_scroll_ratio,
            completed, content_height, viewport_height, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(content_id, content_type) DO UPDATE SET
            scroll_offset = excluded.scroll_offset,
            scroll_ratio = excluded.scroll_ratio,
            max_scroll_ratio = MAX(reading_progress.max_scroll_ratio, excluded.max_scroll_ratio),
            completed = MAX(reading_progress.completed, excluded.completed),
            content_height = excluded.content_height,
            viewport_height = excluded.viewport_height,
            updated_at = excluded.updated_at`,
        progress.contentId,
        progress.contentType,
        Math.max(0, Number(progress.scrollOffset || 0)),
        Math.max(0, Math.min(1, Number(progress.scrollRatio || 0))),
        Math.max(0, Math.min(1, Number(progress.maxScrollRatio || 0))),
        progress.completed ? 1 : 0,
        Math.max(0, Number(progress.contentHeight || 0)),
        Math.max(0, Number(progress.viewportHeight || 0)),
        updatedAt,
    );
}
