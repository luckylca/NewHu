import { getDatabase } from '../database';
import type { ResourceRecord } from '../types';

const now = () => Date.now();

function rowToResource(row: any): ResourceRecord {
    return {
        id: row.id,
        remoteUrl: row.remote_url,
        localUri: row.local_uri,
        mimeType: row.mime_type,
        fileSize: Number(row.file_size || 0),
        status: row.status,
        createdAt: row.created_at,
        lastAccessedAt: row.last_accessed_at,
    };
}

export async function getResource(remoteUrl: string) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM resources WHERE remote_url = ?', remoteUrl);
    return row ? rowToResource(row) : null;
}

export async function upsertResource(resource: ResourceRecord) {
    const db = await getDatabase();
    await db.runAsync(
        `INSERT INTO resources (id, remote_url, local_uri, mime_type, file_size, status, created_at, last_accessed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(remote_url) DO UPDATE SET id = excluded.id, local_uri = excluded.local_uri,
           mime_type = excluded.mime_type, file_size = excluded.file_size, status = excluded.status,
           last_accessed_at = excluded.last_accessed_at`,
        resource.id, resource.remoteUrl, resource.localUri, resource.mimeType, resource.fileSize,
        resource.status, resource.createdAt, resource.lastAccessedAt,
    );
}

export async function touchResource(remoteUrl: string) {
    const db = await getDatabase();
    await db.runAsync('UPDATE resources SET last_accessed_at = ? WHERE remote_url = ?', now(), remoteUrl);
}

export async function addResourceRef(remoteUrl: string, ownerType: string, ownerId: string, purpose: string) {
    const resource = await getResource(remoteUrl);
    if (!resource) return;
    const db = await getDatabase();
    await db.runAsync(
        'INSERT OR IGNORE INTO resource_refs (resource_id, owner_type, owner_id, purpose) VALUES (?, ?, ?, ?)',
        resource.id, ownerType, ownerId, purpose,
    );
}

export async function listResourcesForCleanup(limit = 20): Promise<ResourceRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
        `SELECT r.* FROM resources r
         WHERE r.status = 'ready'
           AND NOT EXISTS (
             SELECT 1 FROM resource_refs rr
             JOIN content_bodies b ON b.content_id = rr.owner_id AND b.content_type = rr.owner_type
             WHERE rr.resource_id = r.id AND b.cache_state = 'pinned'
           )
         ORDER BY r.last_accessed_at ASC LIMIT ?`, limit,
    );
    return rows.map(rowToResource);
}

export async function deleteResourceRecord(id: string) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM resources WHERE id = ?', id);
}

export async function getResourceBytes() {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ bytes: number }>("SELECT COALESCE(SUM(file_size), 0) AS bytes FROM resources WHERE status = 'ready'");
    return Number(row?.bytes ?? 0);
}

