import type { FeedType } from '@/src/types/zhihu';
import type { ContentAnnotation, ContentAnnotationKind } from '../types';
import { getDatabase } from '../database';

type AnnotationRow = {
    id: string;
    content_id: string;
    content_type: FeedType;
    kind: ContentAnnotationKind;
    selection_start: number;
    selection_end: number;
    quote_text: string;
    note_text: string;
    title: string;
    author_name: string;
    source_url: string;
    source_updated_at: number;
    created_at: number;
    updated_at: number;
};

function rowToAnnotation(row: AnnotationRow): ContentAnnotation {
    return {
        id: row.id,
        contentId: row.content_id,
        contentType: row.content_type,
        kind: row.kind,
        selectionStart: Number(row.selection_start || 0),
        selectionEnd: Number(row.selection_end || 0),
        quoteText: row.quote_text || '',
        noteText: row.note_text || '',
        title: row.title || '',
        authorName: row.author_name || '',
        sourceUrl: row.source_url || '',
        sourceUpdatedAt: Number(row.source_updated_at || 0),
        createdAt: Number(row.created_at || 0),
        updatedAt: Number(row.updated_at || 0),
    };
}

export async function listContentAnnotations(contentId: string, contentType: FeedType) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<AnnotationRow>(
        `SELECT * FROM content_annotations
         WHERE content_id = ? AND content_type = ?
         ORDER BY selection_start ASC, created_at ASC`,
        contentId,
        contentType,
    );
    return rows.map(rowToAnnotation);
}

export async function createContentAnnotation(input: {
    contentId: string;
    contentType: FeedType;
    kind: ContentAnnotationKind;
    selectionStart: number;
    selectionEnd: number;
    quoteText: string;
    noteText?: string;
    title: string;
    authorName: string;
    sourceUrl: string;
    sourceUpdatedAt?: number;
}) {
    const db = await getDatabase();
    const now = Date.now();
    const id = `ann-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await db.runAsync(
        `INSERT INTO content_annotations (
            id, content_id, content_type, kind, selection_start, selection_end,
            quote_text, note_text, title, author_name, source_url, source_updated_at,
            created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.contentId,
        input.contentType,
        input.kind,
        input.selectionStart,
        input.selectionEnd,
        input.quoteText,
        input.noteText?.trim() ?? '',
        input.title,
        input.authorName,
        input.sourceUrl,
        input.sourceUpdatedAt ?? 0,
        now,
        now,
    );
    return {
        id,
        contentId: input.contentId,
        contentType: input.contentType,
        kind: input.kind,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        quoteText: input.quoteText,
        noteText: input.noteText?.trim() ?? '',
        title: input.title,
        authorName: input.authorName,
        sourceUrl: input.sourceUrl,
        sourceUpdatedAt: input.sourceUpdatedAt ?? 0,
        createdAt: now,
        updatedAt: now,
    } satisfies ContentAnnotation;
}

export async function deleteContentAnnotation(id: string) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM content_annotations WHERE id = ?', id);
}
