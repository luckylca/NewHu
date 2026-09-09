import type { FeedType } from '@/src/types/zhihu';
import type {
    LaterReadRuntimeState,
    LaterReadRuntimeStateMap,
} from '@/src/utils/laterRead';
import { getDatabase, withSerializedTransaction } from '../database';

export type LaterReadTarget = {
    key: string;
    contentId: string;
    contentType: FeedType;
};

function targetPredicate(targets: LaterReadTarget[]) {
    return {
        sql: targets.map(() => '(content_id = ? AND content_type = ?)').join(' OR '),
        params: targets.flatMap((target) => [target.contentId, target.contentType]),
    };
}

export async function getLaterReadRuntimeStates(
    targets: LaterReadTarget[],
): Promise<LaterReadRuntimeStateMap> {
    if (!targets.length) return {};
    const db = await getDatabase();
    const predicate = targetPredicate(targets);

    const [progressRows, pinRows] = await Promise.all([
        db.getAllAsync<{
            content_id: string;
            content_type: FeedType;
            scroll_ratio: number;
            max_scroll_ratio: number;
            completed: number;
        }>(
            `SELECT content_id, content_type, scroll_ratio, max_scroll_ratio, completed
             FROM reading_progress
             WHERE ${predicate.sql}`,
            ...predicate.params,
        ),
        db.getAllAsync<{
            content_id: string;
            content_type: FeedType;
        }>(
            `SELECT content_id, content_type
             FROM offline_pins
             WHERE status = 'active' AND (${predicate.sql})`,
            ...predicate.params,
        ),
    ]);

    const states: LaterReadRuntimeStateMap = {};
    for (const target of targets) {
        states[target.key] = {
            completed: false,
            progress: 0,
            offline: false,
        };
    }
    for (const row of progressRows) {
        const key = `${row.content_type}:${row.content_id}`;
        const current: LaterReadRuntimeState = states[key] ?? {
            completed: false,
            progress: 0,
            offline: false,
        };
        states[key] = {
            ...current,
            completed: Boolean(row.completed),
            progress: Math.max(
                Number(row.scroll_ratio || 0),
                Number(row.max_scroll_ratio || 0),
            ),
        };
    }
    for (const row of pinRows) {
        const key = `${row.content_type}:${row.content_id}`;
        const current: LaterReadRuntimeState = states[key] ?? {
            completed: false,
            progress: 0,
            offline: false,
        };
        states[key] = { ...current, offline: true };
    }
    return states;
}

export async function markLaterReadCompleted(targets: LaterReadTarget[]) {
    if (!targets.length) return;
    const timestamp = Date.now();
    await withSerializedTransaction(async (db) => {
        for (const target of targets) {
            await db.runAsync(
                `INSERT INTO reading_progress (
                    content_id, content_type, scroll_offset, scroll_ratio,
                    max_scroll_ratio, completed, content_height, viewport_height,
                    updated_at
                 ) VALUES (?, ?, 0, 1, 1, 1, 0, 0, ?)
                 ON CONFLICT(content_id, content_type) DO UPDATE SET
                    max_scroll_ratio = MAX(reading_progress.max_scroll_ratio, 1),
                    completed = 1,
                    updated_at = excluded.updated_at`,
                target.contentId,
                target.contentType,
                timestamp,
            );
        }
    });
}
