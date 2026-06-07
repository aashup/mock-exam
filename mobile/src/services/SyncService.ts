import type {Scalar} from '@op-engineering/op-sqlite';
import {api} from '@/api/client';
import {getDb, getMeta, setMeta} from '@/db/database';
import {subjectRepo} from '@/db/repositories/subjectRepo';

const LAST_SYNCED_KEY = 'last_synced_at';

// Tables synced by the dirty flag, plus their server-id-enriched SELECTs.
// Each row carries its local `id`, its (nullable) `server_id`, and parent
// foreign keys as BOTH the local id and the resolved parent server id so the
// backend can map device-local ids to server ids.
const DIRTY_QUERIES: Record<string, string> = {
  question_sets: `
    SELECT qs.id, qs.server_id,
           subj.server_id AS subject_server_id,
           crs.server_id  AS course_server_id,
           qs.difficulty, qs.total_questions, qs.generated_at, qs.updated_at
    FROM question_sets qs
    LEFT JOIN subjects subj ON subj.id = qs.subject_id
    LEFT JOIN courses  crs  ON crs.id  = qs.course_id
    WHERE qs.is_dirty = 1;`,
  questions: `
    SELECT q.id, q.server_id, q.set_id, qs.server_id AS set_server_id,
           q.text, q.explanation, q.updated_at
    FROM questions q
    LEFT JOIN question_sets qs ON qs.id = q.set_id
    WHERE q.is_dirty = 1;`,
  // options has no is_dirty column (immutable once generated) → push unsynced.
  options: `
    SELECT o.id, o.server_id, o.question_id, q.server_id AS question_server_id,
           o.text, o.is_correct
    FROM options o
    LEFT JOIN questions q ON q.id = o.question_id
    WHERE o.server_id IS NULL;`,
  sessions: `
    SELECT s.id, s.server_id, s.set_id, qs.server_id AS set_server_id,
           s.mode, s.feedback_mode, s.total_questions, s.duration_seconds,
           s.score, s.status, s.started_at, s.completed_at, s.updated_at
    FROM sessions s
    LEFT JOIN question_sets qs ON qs.id = s.set_id
    WHERE s.is_dirty = 1;`,
  attempts: `
    SELECT a.id, a.server_id, a.session_id, s.server_id AS session_server_id,
           a.question_id, q.server_id AS question_server_id,
           a.selected_option_id, o.server_id AS selected_option_server_id,
           a.is_correct, a.time_taken_seconds, a.answered_at
    FROM attempts a
    LEFT JOIN sessions  s ON s.id = a.session_id
    LEFT JOIN questions q ON q.id = a.question_id
    LEFT JOIN options   o ON o.id = a.selected_option_id
    WHERE a.is_dirty = 1;`,
  analytics: `
    SELECT an.id, an.server_id,
           subj.server_id AS subject_server_id,
           crs.server_id  AS course_server_id,
           an.difficulty, an.total_attempted, an.total_correct,
           an.accuracy_percent, an.avg_time_per_question, an.updated_at
    FROM analytics an
    LEFT JOIN subjects subj ON subj.id = an.subject_id
    LEFT JOIN courses  crs  ON crs.id  = an.course_id
    WHERE an.is_dirty = 1;`,
  app_usage: `
    SELECT id, server_id, date, seconds_active, updated_at
    FROM app_usage WHERE is_dirty = 1;`,
  locations: `
    SELECT id, server_id, latitude, longitude, accuracy, altitude, speed, heading,
           recorded_at, location_source, battery_level, updated_at
    FROM locations WHERE is_dirty = 1 ORDER BY recorded_at ASC;`,
};

// Tables that have no is_dirty column — only their server_id is written back.
const TABLES_WITHOUT_DIRTY = new Set(['options']);

async function collectDirty(table: string): Promise<unknown[]> {
  const query = DIRTY_QUERIES[table];
  if (!query) {
    return [];
  }
  const res = await getDb().execute(query);
  return res.rows;
}

/** Parse a timestamp to epoch millis. Handles ISO-8601 (server) and SQLite
 * `YYYY-MM-DD HH:MM:SS` (local, UTC) by normalising the latter to ISO-UTC. */
function toMillis(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Resolve a server reference id to its local row id (NULL-safe). */
async function localIdForServerId(table: string, serverId: unknown): Promise<number | null> {
  if (serverId === null || serverId === undefined) {
    return null;
  }
  const res = await getDb().execute(`SELECT id FROM ${table} WHERE server_id = ?;`, [
    serverId as Scalar,
  ]);
  return (res.rows[0]?.id as number | undefined) ?? null;
}

/**
 * server_id-keyed last-write-wins upsert. Returns the local row id. `columns`
 * are written on both insert and update; the row is marked clean (is_dirty=0).
 * `hasDirty=false` for tables (options) that lack an is_dirty column.
 */
async function lwwUpsert(
  table: string,
  serverId: string,
  incomingUpdatedAt: unknown,
  columns: Record<string, Scalar>,
  hasDirty = true,
): Promise<number | null> {
  const db = getDb();
  const existing = await db.execute(
    `SELECT id, updated_at FROM ${table} WHERE server_id = ?;`,
    [serverId],
  );
  const existingRow = existing.rows[0] as {id: number; updated_at?: string} | undefined;

  const cols = Object.keys(columns);
  const vals = Object.values(columns);

  if (existingRow) {
    // Local copy wins if it is the same or newer (last-write-wins).
    if (toMillis(existingRow.updated_at) >= toMillis(incomingUpdatedAt) && toMillis(incomingUpdatedAt) > 0) {
      return existingRow.id;
    }
    const setClause = cols.map(c => `${c} = ?`).join(', ');
    const dirty = hasDirty ? ', is_dirty = 0' : '';
    await db.execute(
      `UPDATE ${table} SET ${setClause}${dirty}, synced_at = datetime('now') WHERE id = ?;`,
      [...vals, existingRow.id],
    );
    return existingRow.id;
  }

  const dirtyCol = hasDirty ? ', is_dirty' : '';
  const dirtyVal = hasDirty ? ', 0' : '';
  const placeholders = cols.map(() => '?').join(', ');
  const res = await db.execute(
    `INSERT INTO ${table} (server_id, ${cols.join(', ')}${dirtyCol}, synced_at)
     VALUES (?, ${placeholders}${dirtyVal}, datetime('now'));`,
    [serverId, ...vals],
  );
  return Number(res.insertId);
}

/**
 * Merge server-side deltas into local SQLite. Reference data (subjects/courses)
 * is upserted separately before this runs. Foreign keys in the delta are SERVER
 * ids and are translated to local ids here. Processed parent-first so sessions
 * can resolve their set_id.
 */
async function applyDelta(data: {
  question_sets?: any[];
  questions?: any[];
  options?: any[];
  sessions?: any[];
  analytics?: any[];
  app_usage?: any[];
  locations?: any[];
}): Promise<void> {
  let setsApplied = 0;
  for (const qs of data.question_sets ?? []) {
    const subjectId = await localIdForServerId('subjects', qs.subject_id);
    if (!subjectId) {
      console.warn('[Sync] skip set — subject not local', {set: qs.id, subject: qs.subject_id});
      continue; // subject must exist locally (NOT NULL FK)
    }
    const courseId = await localIdForServerId('courses', qs.course_id);
    await lwwUpsert('question_sets', qs.id, qs.updated_at, {
      subject_id: subjectId,
      course_id: courseId,
      difficulty: qs.difficulty,
      total_questions: qs.total_questions ?? 0,
      generated_at: qs.generated_at ?? null,
      updated_at: qs.updated_at ?? null,
    });
    setsApplied++;
  }

  // Build server_id -> local id maps ONCE so the questions/options loops don't
  // issue a SELECT per row (1500 questions × 6000 options would otherwise mean
  // tens of thousands of round-trips).
  const setIdMap = new Map<string, number>();
  {
    const res = await getDb().execute(
      'SELECT id, server_id FROM question_sets WHERE server_id IS NOT NULL;',
    );
    for (const r of res.rows as Array<{id: number; server_id: string}>) {
      setIdMap.set(r.server_id, r.id);
    }
  }

  // Questions for the delta's sets (incl. the shared/global bank).
  const questionIdMap = new Map<string, number>();
  let qApplied = 0;
  let qSkipped = 0;
  for (const q of data.questions ?? []) {
    const setId = setIdMap.get(q.set_id);
    if (!setId) {
      qSkipped++;
      continue;
    }
    const localId = await lwwUpsert('questions', q.id, q.updated_at, {
      set_id: setId,
      text: q.text ?? '',
      explanation: q.explanation ?? null,
      updated_at: q.updated_at ?? null,
    });
    if (localId) {
      questionIdMap.set(q.id, localId);
    }
    qApplied++;
  }

  // Options have no is_dirty / updated_at column — they are server-authoritative
  // and immutable, so upsert them directly keyed by server_id.
  const optDb = getDb();
  let oApplied = 0;
  let oSkipped = 0;
  for (const o of data.options ?? []) {
    let questionId = questionIdMap.get(o.question_id);
    if (!questionId) {
      questionId = (await localIdForServerId('questions', o.question_id)) ?? undefined;
    }
    if (!questionId) {
      oSkipped++;
      continue;
    }
    const existing = await optDb.execute(
      'SELECT id FROM options WHERE server_id = ?;',
      [o.id],
    );
    const row = existing.rows[0] as {id: number} | undefined;
    if (row) {
      await optDb.execute(
        `UPDATE options SET question_id = ?, text = ?, is_correct = ?, synced_at = datetime('now')
         WHERE id = ?;`,
        [questionId, o.text ?? '', o.is_correct ? 1 : 0, row.id],
      );
    } else {
      await optDb.execute(
        `INSERT INTO options (server_id, question_id, text, is_correct, synced_at)
         VALUES (?, ?, ?, ?, datetime('now'));`,
        [o.id, questionId, o.text ?? '', o.is_correct ? 1 : 0],
      );
    }
    oApplied++;
  }

  console.log('[Sync] applyDelta content', {
    setsApplied,
    qApplied,
    qSkipped,
    oApplied,
    oSkipped,
  });

  for (const s of data.sessions ?? []) {
    const setId = await localIdForServerId('question_sets', s.set_id);
    if (!setId) {
      continue; // session needs a local set (NOT NULL FK)
    }
    await lwwUpsert('sessions', s.id, s.updated_at, {
      set_id: setId,
      mode: s.mode,
      feedback_mode: s.feedback_mode,
      total_questions: s.total_questions ?? 0,
      duration_seconds: s.duration_seconds ?? null,
      status: s.status,
      score: s.score ?? null,
      started_at: s.started_at ?? null,
      completed_at: s.completed_at ?? null,
      updated_at: s.updated_at ?? null,
    });
  }

  for (const an of data.analytics ?? []) {
    const subjectId = await localIdForServerId('subjects', an.subject_id);
    const courseId = await localIdForServerId('courses', an.course_id);
    await lwwUpsert('analytics', an.id, an.updated_at, {
      subject_id: subjectId,
      course_id: courseId,
      difficulty: an.difficulty ?? null,
      total_attempted: an.total_attempted ?? 0,
      total_correct: an.total_correct ?? 0,
      accuracy_percent: an.accuracy_percent ?? 0,
      avg_time_per_question: an.avg_time_per_question ?? null,
      updated_at: an.updated_at ?? null,
    });
  }

  const db = getDb();
  for (const u of data.app_usage ?? []) {
    // app_usage is keyed by date locally (UNIQUE), and a locally-created row may
    // not yet have a server_id — so match on DATE, not server_id. The server
    // value (summed across devices) is authoritative.
    const existing = await db.execute(
      `SELECT id, updated_at FROM app_usage WHERE date = ?;`,
      [u.date],
    );
    const row = existing.rows[0] as {id: number; updated_at?: string} | undefined;
    if (row) {
      if (toMillis(row.updated_at) >= toMillis(u.updated_at) && toMillis(u.updated_at) > 0) {
        continue;
      }
      await db.execute(
        `UPDATE app_usage SET server_id = ?, seconds_active = ?, is_dirty = 0,
           updated_at = ?, synced_at = datetime('now') WHERE id = ?;`,
        [u.id, u.seconds_active ?? 0, u.updated_at ?? null, row.id],
      );
    } else {
      await db.execute(
        `INSERT INTO app_usage (server_id, date, seconds_active, is_dirty, updated_at, synced_at)
         VALUES (?, ?, ?, 0, ?, datetime('now'));`,
        [u.id, u.date, u.seconds_active ?? 0, u.updated_at ?? null],
      );
    }
  }

  // Locations in pull response come from the server with their own `id` as server_id.
  // These represent records from other devices of the same user. Apply last-write-wins.
  const locDb = getDb();
  for (const loc of data.locations ?? []) {
    const serverId = String(loc.id ?? loc.server_id ?? '');
    if (!serverId) continue;

    const existing = await locDb.execute(
      `SELECT id, updated_at FROM locations WHERE server_id = ?;`,
      [serverId],
    );
    const row = existing.rows[0] as {id: number; updated_at?: string} | undefined;

    if (row) {
      // Keep local if it is equal or newer (last-write-wins).
      if (toMillis(row.updated_at) >= toMillis(loc.updated_at) && toMillis(loc.updated_at) > 0) {
        continue;
      }
      await locDb.execute(
        `UPDATE locations SET latitude = ?, longitude = ?, accuracy = ?, altitude = ?,
           speed = ?, heading = ?, recorded_at = ?, location_source = ?,
           battery_level = ?, is_dirty = 0, updated_at = ?, synced_at = datetime('now')
         WHERE id = ?;`,
        [
          loc.latitude, loc.longitude, loc.accuracy,
          loc.altitude ?? null, loc.speed ?? null, loc.heading ?? null,
          loc.recorded_at, loc.location_source ?? 'fused',
          loc.battery_level ?? null, loc.updated_at, row.id,
        ],
      );
    } else {
      // New location from another device — insert locally.
      await locDb.execute(
        `INSERT INTO locations (server_id, latitude, longitude, accuracy, altitude, speed, heading,
           recorded_at, location_source, battery_level, is_dirty, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'));`,
        [
          serverId, loc.latitude, loc.longitude, loc.accuracy,
          loc.altitude ?? null, loc.speed ?? null, loc.heading ?? null,
          loc.recorded_at, loc.location_source ?? 'fused',
          loc.battery_level ?? null, loc.updated_at,
        ],
      );
    }
  }
}

/**
 * Offline-first sync. Runs every ~30 min (and on foreground) when auto-sync is
 * enabled. Pushes dirty rows, pulls server deltas, applies last-write-wins.
 */
// Guards against overlapping sync cycles. Auto-sync fires on a timer AND on app
// foreground, and the manual "Sync now" button can fire too — running several
// applyDelta passes concurrently against one SQLite file causes lock contention
// and writes that silently roll back. Only one cycle runs at a time.
let syncing = false;

export const SyncService = {
  async run(deviceId: string): Promise<void> {
    if (syncing) {
      console.log('[Sync] skip — a sync is already running');
      return;
    }
    syncing = true;
    try {
      await SyncService.push(deviceId);
      await SyncService.pull();
    } catch (e) {
      console.error('[Sync] run failed', e);
      throw e;
    } finally {
      syncing = false;
    }
  },

  /** Uploads all rows flagged is_dirty = 1. */
  async push(deviceId: string): Promise<void> {
    const lastSyncedAt = (await getMeta(LAST_SYNCED_KEY)) ?? null;

    const payload = {
      device_id: deviceId,
      last_synced_at: lastSyncedAt,
      question_sets: await collectDirty('question_sets'),
      questions: await collectDirty('questions'),
      options: await collectDirty('options'),
      sessions: await collectDirty('sessions'),
      attempts: await collectDirty('attempts'),
      analytics: await collectDirty('analytics'),
      app_usage: await collectDirty('app_usage'),
      locations: await collectDirty('locations'),
    };

    const hasDirty = Object.values(payload).some(v => Array.isArray(v) && v.length > 0);
    if (!hasDirty) {
      return;
    }

    const {data} = await api.post('/sync', payload);

    // Server returns id mappings { table: [{ local_id, server_id }] }. Only the
    // acknowledged rows are cleared; anything skipped (unknown parent) stays
    // dirty and is retried on the next sync.
    const mappings: Record<string, Array<{local_id: number; server_id: string}>> =
      data?.mappings ?? {};
    const db = getDb();
    for (const [table, list] of Object.entries(mappings)) {
      for (const m of list) {
        if (TABLES_WITHOUT_DIRTY.has(table)) {
          await db.execute(
            `UPDATE ${table} SET server_id = ?, synced_at = datetime('now') WHERE id = ?;`,
            [m.server_id, m.local_id],
          );
        } else {
          await db.execute(
            `UPDATE ${table} SET server_id = ?, is_dirty = 0, synced_at = datetime('now')
             WHERE id = ?;`,
            [m.server_id, m.local_id],
          );
        }
      }
    }
  },

  /** Pulls reference data + server-side changes since last sync. */
  async pull(): Promise<void> {
    const since = (await getMeta(LAST_SYNCED_KEY)) ?? '';
    const {data} = await api.get('/sync/pull', {params: {since}});

    console.log('[Sync] pull received', {
      since,
      subjects: data?.subjects?.length ?? 0,
      courses: data?.courses?.length ?? 0,
      question_sets: data?.question_sets?.length ?? 0,
      questions: data?.questions?.length ?? 0,
      options: data?.options?.length ?? 0,
      sessions: data?.sessions?.length ?? 0,
      locations: data?.locations?.length ?? 0,
    });

    // Reference data is server-authoritative — always overwrite first so that
    // delta foreign keys (subject_id/course_id) resolve to local ids.
    if (data?.subjects) {
      await subjectRepo.upsertSubjects(data.subjects);
    }
    if (data?.courses) {
      await subjectRepo.upsertCourses(data.courses);
    }

    // Merge server-side user-data deltas (last-write-wins by updated_at).
    try {
      await applyDelta(data ?? {});
    } catch (e) {
      console.error('[Sync] applyDelta threw', e);
      throw e;
    }

    const after = await getDb().execute(
      'SELECT (SELECT COUNT(*) FROM question_sets) AS sets, (SELECT COUNT(*) FROM questions) AS qs, (SELECT COUNT(*) FROM options) AS opts;',
    );
    console.log('[Sync] local DB after applyDelta', after.rows[0]);

    await setMeta(LAST_SYNCED_KEY, new Date().toISOString());
  },
};
