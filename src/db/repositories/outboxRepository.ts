import type { FeedType } from '@/src/types/zhihu';
import { getDatabase } from '../database';
import type { OutboxStatus, PendingAction } from '../types';

const now = () => Date.now();

function rowToAction(row: any): PendingAction {
    return {
        id: row.id,
        actionType: row.action_type,
        targetType: row.target_type,
        targetId: row.target_id,
        payload: JSON.parse(row.payload_json),
        status: row.status,
        retryCount: Number(row.retry_count),
        dependsOnActionId: row.depends_on_action_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastAttemptAt: row.last_attempt_at,
        lastError: row.last_error,
    };
}

function makeId() {
    return `action:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueAction(options: {
    actionType: PendingAction['actionType']; targetType: FeedType | 'comment'; targetId: string;
    payload: Record<string, unknown>; dependsOnActionId?: string | null;
}) {
    const db = await getDatabase();
    const timestamp = now();
    const existing = options.actionType === 'SET_CONTENT_VOTE' || options.actionType === 'SET_COMMENT_VOTE'
        ? await db.getFirstAsync<any>(
            `SELECT * FROM pending_actions WHERE action_type = ? AND target_type = ? AND target_id = ? AND status IN ('pending', 'failed', 'needs_user_action') ORDER BY created_at DESC LIMIT 1`,
            options.actionType, options.targetType, options.targetId,
        )
        : null;
    if (existing) {
        await db.runAsync(
            `UPDATE pending_actions SET payload_json = ?, status = 'pending', updated_at = ?, last_error = NULL WHERE id = ?`,
            JSON.stringify(options.payload), timestamp, existing.id,
        );
        return existing.id as string;
    }
    const id = makeId();
    await db.runAsync(
        `INSERT INTO pending_actions (id, action_type, target_type, target_id, payload_json, status, retry_count, depends_on_action_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
        id, options.actionType, options.targetType, options.targetId, JSON.stringify(options.payload), options.dependsOnActionId || null, timestamp, timestamp,
    );
    return id;
}

export async function listPendingActions(): Promise<PendingAction[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>("SELECT * FROM pending_actions WHERE status IN ('pending', 'failed', 'needs_user_action') ORDER BY created_at ASC");
    return rows.map(rowToAction);
}

export async function getPendingActionByTarget(targetId: string) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
        "SELECT * FROM pending_actions WHERE target_id = ? AND status IN ('pending', 'syncing', 'failed') ORDER BY created_at DESC LIMIT 1",
        targetId,
    );
    return row ? rowToAction(row) : null;
}

export async function getPendingAction(id: string) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM pending_actions WHERE id = ?', id);
    return row ? rowToAction(row) : null;
}

export async function markActionSyncing(id: string) {
    const db = await getDatabase();
    await db.runAsync("UPDATE pending_actions SET status = 'syncing', updated_at = ?, last_attempt_at = ? WHERE id = ?", now(), now(), id);
}

export async function markActionResult(id: string, status: OutboxStatus, error?: string) {
    const db = await getDatabase();
    await db.runAsync('UPDATE pending_actions SET status = ?, updated_at = ?, last_error = ? WHERE id = ?', status, now(), error || null, id);
}

export async function markActionRetry(id: string, error: string) {
    const db = await getDatabase();
    await db.runAsync("UPDATE pending_actions SET status = 'pending', retry_count = retry_count + 1, updated_at = ?, last_error = ? WHERE id = ?", now(), error, id);
}

export async function hasPendingActions() {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM pending_actions WHERE status IN ('pending', 'syncing', 'failed', 'needs_user_action')");
    return Number(row?.count ?? 0) > 0;
}
