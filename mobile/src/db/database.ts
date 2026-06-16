import * as SQLite from 'expo-sqlite';
import {CREATE_INDEXES, CREATE_TABLES, SCHEMA_VERSION} from './schema';

const DB_NAME = 'exam_practice.db';

let _db: SQLite.SQLiteDatabase | null = null;

/** Opens (once) and returns the shared database handle. */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync(DB_NAME);
    await _db.execAsync('PRAGMA journal_mode = WAL;');
    await _db.runAsync('PRAGMA foreign_keys = ON;', []);
  }
  return _db;
}

/**
 * Creates all tables/indexes and records the schema version.
 * Idempotent — safe to call on every app launch.
 */
export async function initDatabase(): Promise<void> {
  const db = await getDb();

  for (const stmt of CREATE_TABLES) {
    await db.execAsync(stmt);
  }
  for (const stmt of CREATE_INDEXES) {
    await db.execAsync(stmt);
  }

  await runMigrations(db);

  await db.runAsync(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [String(SCHEMA_VERSION)],
  );
}

/**
 * Idempotent, additive migrations for DBs created by an older schema version.
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(
    db,
    'question_sets',
    'language',
    `ALTER TABLE question_sets ADD COLUMN language TEXT NOT NULL DEFAULT 'en';`,
  );
  await addColumnIfMissing(
    db,
    'sessions',
    'is_offline',
    `ALTER TABLE sessions ADD COLUMN is_offline INTEGER NOT NULL DEFAULT 0;`,
  );
}

/** Runs `alterSql` only if `table` doesn't already have `column`. */
async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  alterSql: string,
): Promise<void> {
  const cols = await db.getAllAsync<{name: string}>(`PRAGMA table_info(${table});`);
  const exists = cols.some(r => r.name === column);
  if (!exists) {
    await db.execAsync(alterSql);
  }
}

/** Returns true when the local DB has no question sets — i.e. a fresh device. */
export async function isDatabaseEmpty(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{total: number}>(
    `SELECT
       (SELECT COUNT(*) FROM question_sets) +
       (SELECT COUNT(*) FROM sessions) AS total;`,
  );
  return (row?.total ?? 0) === 0;
}

/** Reads a value from the meta key/value table. */
export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{value: string}>(
    'SELECT value FROM meta WHERE key = ?;',
    [key],
  );
  return row?.value ?? null;
}

/** Writes a value to the meta key/value table. */
export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value],
  );
}

/** Runs a set of statements inside a transaction. */
export async function transaction(work: () => Promise<void>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(work);
}
