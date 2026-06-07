import {open, type DB} from '@op-engineering/op-sqlite';
import {CREATE_INDEXES, CREATE_TABLES, SCHEMA_VERSION} from './schema';

const DB_NAME = 'exam_practice.sqlite';

let db: DB | null = null;

/** Opens (once) and returns the shared database handle. */
export function getDb(): DB {
  if (!db) {
    db = open({name: DB_NAME});
  }
  return db;
}

/**
 * Creates all tables/indexes and records the schema version.
 * Idempotent — safe to call on every app launch.
 */
export async function initDatabase(): Promise<void> {
  const database = getDb();
  await database.execute('PRAGMA foreign_keys = ON;');

  for (const stmt of CREATE_TABLES) {
    await database.execute(stmt);
  }
  for (const stmt of CREATE_INDEXES) {
    await database.execute(stmt);
  }

  await runMigrations(database);

  await database.execute(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [String(SCHEMA_VERSION)],
  );
}

/**
 * Idempotent, additive migrations for DBs created by an older schema version.
 * `CREATE TABLE IF NOT EXISTS` won't add columns to an existing table, so any
 * column added after v1 must be backfilled here with an ADD COLUMN guard.
 */
async function runMigrations(database: DB): Promise<void> {
  await addColumnIfMissing(
    database,
    'question_sets',
    'language',
    `ALTER TABLE question_sets ADD COLUMN language TEXT NOT NULL DEFAULT 'en';`,
  );
  await addColumnIfMissing(
    database,
    'sessions',
    'is_offline',
    `ALTER TABLE sessions ADD COLUMN is_offline INTEGER NOT NULL DEFAULT 0;`,
  );
}

/** Runs `alterSql` only if `table` doesn't already have `column`. */
async function addColumnIfMissing(
  database: DB,
  table: string,
  column: string,
  alterSql: string,
): Promise<void> {
  const info = await database.execute(`PRAGMA table_info(${table});`);
  const exists = info.rows.some(r => (r as {name?: string}).name === column);
  if (!exists) {
    await database.execute(alterSql);
  }
}

/** Returns true when the local DB has no question sets — i.e. a fresh device. */
export async function isDatabaseEmpty(): Promise<boolean> {
  const database = getDb();
  const res = await database.execute(
    `SELECT
       (SELECT COUNT(*) FROM question_sets) +
       (SELECT COUNT(*) FROM sessions) AS total;`,
  );
  const total = (res.rows[0]?.total as number) ?? 0;
  return total === 0;
}

/** Reads a value from the meta key/value table. */
export async function getMeta(key: string): Promise<string | null> {
  const res = await getDb().execute('SELECT value FROM meta WHERE key = ?;', [key]);
  return (res.rows[0]?.value as string | undefined) ?? null;
}

/** Writes a value to the meta key/value table. */
export async function setMeta(key: string, value: string): Promise<void> {
  await getDb().execute(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value],
  );
}

/** Runs a set of statements inside a transaction. */
export async function transaction(work: (tx: DB) => Promise<void>): Promise<void> {
  const database = getDb();
  await database.execute('BEGIN;');
  try {
    await work(database);
    await database.execute('COMMIT;');
  } catch (err) {
    await database.execute('ROLLBACK;');
    throw err;
  }
}
