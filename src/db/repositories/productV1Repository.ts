import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase, withSerializedTransaction } from '../database';
import type { CandidateArticle } from '@/src/product-v1/core/candidateAcquisition';
import { supplyInterestV3 } from '@/src/product-v1/core/candidateInventoryV3';
import { PRODUCT_V1_VERSION } from '@/src/product-v1/constants';
import type { ProductV1CandidateRecord, ProductV1Trace } from '@/src/product-v1/types';

type StateRow = { schema_version: number; product_version: string; payload_json: string };
type CandidateRow = { namespace: string; candidate_json: string; embedding: Uint8Array | null };

function embeddingToBlob(embedding: number[] | null | undefined) {
  if (!embedding) return null;
  return new Uint8Array(Float32Array.from(embedding).buffer);
}

function blobToEmbedding(blob: Uint8Array | null) {
  if (!blob) return null;
  const copy = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
  return Array.from(new Float32Array(copy));
}

export async function loadProductState<T>(component: string): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<StateRow>(
    'SELECT schema_version, product_version, payload_json FROM product_v1_state WHERE component = ?',
    component,
  );
  if (!row || row.product_version !== PRODUCT_V1_VERSION) return null;
  try {
    return JSON.parse(row.payload_json) as T;
  } catch {
    await db.runAsync('DELETE FROM product_v1_state WHERE component = ?', component);
    return null;
  }
}

async function saveStateInTransaction(db: SQLiteDatabase, component: string, schemaVersion: number, payload: unknown) {
  await db.runAsync(
    `INSERT INTO product_v1_state(component, schema_version, product_version, payload_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(component) DO UPDATE SET schema_version=excluded.schema_version,
       product_version=excluded.product_version, payload_json=excluded.payload_json, updated_at=excluded.updated_at`,
    component, schemaVersion, PRODUCT_V1_VERSION, JSON.stringify(payload), Date.now(),
  );
}

export async function saveProductState(component: string, schemaVersion: number, payload: unknown) {
  await withSerializedTransaction((db) => saveStateInTransaction(db, component, schemaVersion, payload));
}

export async function loadProductCandidates(namespaces: string[]): Promise<Record<string, ProductV1CandidateRecord[]>> {
  const output = Object.fromEntries(namespaces.map((namespace) => [namespace, []])) as Record<string, ProductV1CandidateRecord[]>;
  if (!namespaces.length) return output;
  const db = await getDatabase();
  const placeholders = namespaces.map(() => '?').join(',');
  const rows = await db.getAllAsync<CandidateRow>(
    `SELECT namespace, candidate_json, embedding FROM product_v1_candidates WHERE namespace IN (${placeholders})`,
    ...namespaces,
  );
  for (const row of rows) {
    try {
      const record = JSON.parse(row.candidate_json) as ProductV1CandidateRecord;
      record.candidate.encoderEmbedding = blobToEmbedding(row.embedding);
      output[row.namespace]?.push(record);
    } catch {
      // Corruption is isolated to the candidate row and pruned on next commit.
    }
  }
  return output;
}

async function replaceCandidates(db: SQLiteDatabase, namespace: string, records: ProductV1CandidateRecord[]) {
  await db.runAsync('DELETE FROM product_v1_candidates WHERE namespace = ?', namespace);
  for (const record of records) {
    const candidate: CandidateArticle = { ...record.candidate, encoderEmbedding: null };
    const payload = JSON.stringify({ ...record, candidate });
    await db.runAsync(
      `INSERT INTO product_v1_candidates(namespace, duplicate_key, interest_id, candidate_json, embedding, retrieved_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      namespace,
      record.candidate.duplicateKey,
      supplyInterestV3(record.candidate),
      payload,
      embeddingToBlob(record.candidate.encoderEmbedding),
      Date.parse(record.candidate.retrievedAt) || Date.now(),
      Date.now(),
    );
  }
}

export async function commitProductCycle(options: {
  trace: ProductV1Trace;
  active: ProductV1CandidateRecord[];
  reserve: ProductV1CandidateRecord[];
  states: { component: string; schemaVersion: number; payload: unknown }[];
}) {
  await withSerializedTransaction(async (db) => {
    await replaceCandidates(db, options.trace.mode === 'shadow' ? 'shadow_active' : 'active', options.active);
    await replaceCandidates(db, options.trace.mode === 'shadow' ? 'shadow_reserve' : 'reserve', options.reserve);
    for (const state of options.states) {
      await saveStateInTransaction(db, state.component, state.schemaVersion, state.payload);
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO product_v1_cycles(cycle_id, mode, status, trace_json, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      options.trace.cycleId,
      options.trace.mode,
      options.trace.status,
      JSON.stringify(options.trace),
      options.trace.startedAt,
      options.trace.completedAt ?? null,
    );
  });
}

export async function saveProductFeedback(event: {
  eventId: string;
  articleId: string;
  feedSessionId: string;
  exposureId: string;
  eventType: string;
  payload: unknown;
}) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO product_v1_feedback(event_id, article_id, feed_session_id, exposure_id, event_type, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    event.eventId, event.articleId, event.feedSessionId, event.exposureId, event.eventType, JSON.stringify(event.payload), Date.now(),
  );
}

export async function commitProductFeedback(options: {
  event: {
    eventId: string;
    articleId: string;
    feedSessionId: string;
    exposureId: string;
    eventType: string;
    payload: unknown;
  };
  states: { component: string; schemaVersion: number; payload: unknown }[];
}) {
  await withSerializedTransaction(async (db) => {
    await db.runAsync(
      `INSERT OR IGNORE INTO product_v1_feedback(event_id, article_id, feed_session_id, exposure_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      options.event.eventId,
      options.event.articleId,
      options.event.feedSessionId,
      options.event.exposureId,
      options.event.eventType,
      JSON.stringify(options.event.payload),
      Date.now(),
    );
    for (const state of options.states) {
      await saveStateInTransaction(db, state.component, state.schemaVersion, state.payload);
    }
  });
}

export async function getLatestProductTrace(): Promise<ProductV1Trace | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ trace_json: string }>('SELECT trace_json FROM product_v1_cycles ORDER BY started_at DESC LIMIT 1');
  if (!row) return null;
  try { return JSON.parse(row.trace_json) as ProductV1Trace; } catch { return null; }
}

export async function clearProductV1Data() {
  await withSerializedTransaction(async (db) => {
    await db.runAsync('DELETE FROM product_v1_state');
    await db.runAsync('DELETE FROM product_v1_candidates');
    await db.runAsync('DELETE FROM product_v1_feedback');
    await db.runAsync('DELETE FROM product_v1_cycles');
  });
}
