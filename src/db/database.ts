import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_VERSION, MIGRATION_1 } from './schema';

const DATABASE_NAME = 'newhu.db';
let databasePromise: Promise<SQLiteDatabase> | null = null;
type SerializedTransactionTask = (db: SQLiteDatabase) => Promise<void>;
let serializedTransactionQueue: Promise<void> = Promise.resolve();

async function migrate(db: SQLiteDatabase) {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const currentVersion = Number(row?.user_version ?? 0);
    if (currentVersion >= DATABASE_VERSION) return;

    await db.withTransactionAsync(async () => {
        if (currentVersion < 1) {
            await db.execAsync(MIGRATION_1);
        }
        await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });
}

async function openDatabase() {
    const db = await openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA foreign_keys = ON;');
    try {
        await db.execAsync('PRAGMA journal_mode = WAL;');
    } catch {
        // WAL is an optimization; some older Android SQLite builds may reject it.
    }
    await migrate(db);
    return db;
}

export function getDatabase() {
    if (!databasePromise) databasePromise = openDatabase();
    return databasePromise;
}

/**
 * Keep all application transactions on the single shared connection and
 * serialize them. This prevents concurrent cache workers from interleaving
 * BEGIN/COMMIT/ROLLBACK while still allowing their network work to run in
 * parallel.
 */
export function withSerializedTransaction(task: SerializedTransactionTask) {
    const run = serializedTransactionQueue.then(async () => {
        const db = await getDatabase();
        await db.withTransactionAsync(async () => {
            await task(db);
        });
    });
    serializedTransactionQueue = run.then(() => undefined, () => undefined);
    return run;
}

export async function initializeDatabase() {
    await getDatabase();
}

export function resetDatabaseConnectionForTests() {
    databasePromise = null;
}
