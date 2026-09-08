import type { FeedType } from '@/src/types/zhihu';
import type { KnowledgeCard, KnowledgeReviewState } from '../types';
import { getDatabase } from '../database';
import {
    normalizeKnowledgeTags,
    parseKnowledgeTagsJson,
    stringifyKnowledgeTags,
} from '@/src/utils/knowledgeCard';

type KnowledgeCardRow = {
    id: string;
    annotation_id: string | null;
    content_id: string;
    content_type: FeedType;
    quote_text: string;
    understanding_text: string;
    tags_json: string;
    review_state: KnowledgeReviewState;
    title: string;
    author_name: string;
    source_url: string;
    source_updated_at: number;
    created_at: number;
    updated_at: number;
    last_reviewed_at: number | null;
};

function rowToKnowledgeCard(row: KnowledgeCardRow): KnowledgeCard {
    return {
        id: row.id,
        annotationId: row.annotation_id || null,
        contentId: row.content_id,
        contentType: row.content_type,
        quoteText: row.quote_text || '',
        understandingText: row.understanding_text || '',
        tags: parseKnowledgeTagsJson(row.tags_json || '[]'),
        reviewState: row.review_state || 'new',
        title: row.title || '',
        authorName: row.author_name || '',
        sourceUrl: row.source_url || '',
        sourceUpdatedAt: Number(row.source_updated_at || 0),
        createdAt: Number(row.created_at || 0),
        updatedAt: Number(row.updated_at || 0),
        lastReviewedAt: row.last_reviewed_at == null
            ? null
            : Number(row.last_reviewed_at),
    };
}

async function getKnowledgeCardById(id: string) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<KnowledgeCardRow>(
        'SELECT * FROM knowledge_cards WHERE id = ?',
        id,
    );
    return row ? rowToKnowledgeCard(row) : null;
}

export async function getKnowledgeCardByAnnotation(annotationId: string) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<KnowledgeCardRow>(
        'SELECT * FROM knowledge_cards WHERE annotation_id = ?',
        annotationId,
    );
    return row ? rowToKnowledgeCard(row) : null;
}

export async function listKnowledgeCards() {
    const db = await getDatabase();
    const rows = await db.getAllAsync<KnowledgeCardRow>(
        'SELECT * FROM knowledge_cards ORDER BY updated_at DESC, created_at DESC',
    );
    return rows.map(rowToKnowledgeCard);
}

export async function saveKnowledgeCard(input: {
    id?: string;
    annotationId?: string | null;
    contentId: string;
    contentType: FeedType;
    quoteText: string;
    understandingText?: string;
    tags?: string[];
    reviewState: KnowledgeReviewState;
    title: string;
    authorName: string;
    sourceUrl: string;
    sourceUpdatedAt?: number;
}) {
    const db = await getDatabase();
    const now = Date.now();
    let existing = input.id ? await getKnowledgeCardById(input.id) : null;
    if (!existing && input.annotationId) {
        existing = await getKnowledgeCardByAnnotation(input.annotationId);
    }

    const id = existing?.id
        ?? `card-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const tags = normalizeKnowledgeTags(input.tags ?? []);
    const understandingText = input.understandingText?.trim() ?? '';
    const lastReviewedAt = input.reviewState === 'new'
        ? null
        : existing?.reviewState === input.reviewState
            ? existing.lastReviewedAt ?? now
            : now;

    if (existing) {
        await db.runAsync(
            `UPDATE knowledge_cards SET
                annotation_id = ?,
                content_id = ?,
                content_type = ?,
                quote_text = ?,
                understanding_text = ?,
                tags_json = ?,
                review_state = ?,
                title = ?,
                author_name = ?,
                source_url = ?,
                source_updated_at = ?,
                updated_at = ?,
                last_reviewed_at = ?
             WHERE id = ?`,
            input.annotationId ?? existing.annotationId,
            input.contentId,
            input.contentType,
            input.quoteText,
            understandingText,
            stringifyKnowledgeTags(tags),
            input.reviewState,
            input.title,
            input.authorName,
            input.sourceUrl,
            input.sourceUpdatedAt ?? 0,
            now,
            lastReviewedAt,
            id,
        );
    } else {
        await db.runAsync(
            `INSERT INTO knowledge_cards (
                id, annotation_id, content_id, content_type, quote_text,
                understanding_text, tags_json, review_state, title, author_name,
                source_url, source_updated_at, created_at, updated_at, last_reviewed_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id,
            input.annotationId ?? null,
            input.contentId,
            input.contentType,
            input.quoteText,
            understandingText,
            stringifyKnowledgeTags(tags),
            input.reviewState,
            input.title,
            input.authorName,
            input.sourceUrl,
            input.sourceUpdatedAt ?? 0,
            now,
            now,
            lastReviewedAt,
        );
    }

    return {
        id,
        annotationId: input.annotationId ?? existing?.annotationId ?? null,
        contentId: input.contentId,
        contentType: input.contentType,
        quoteText: input.quoteText,
        understandingText,
        tags,
        reviewState: input.reviewState,
        title: input.title,
        authorName: input.authorName,
        sourceUrl: input.sourceUrl,
        sourceUpdatedAt: input.sourceUpdatedAt ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastReviewedAt,
    } satisfies KnowledgeCard;
}

export async function deleteKnowledgeCard(id: string) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM knowledge_cards WHERE id = ?', id);
}
