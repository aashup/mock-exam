import {api} from '@/api/client';
import {getDb, getMeta, setMeta} from '@/db/database';
import {subjectRepo} from '@/db/repositories/subjectRepo';

const LAST_SYNCED_KEY = 'last_synced_at';

type BindValue = string | number | boolean | null;

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

const TABLES_WITHOUT_DIRTY = new Set(['options']);

async function collectDirty(table: string): Promise<unknown[]> {
  const query = DIRTY_QUERIES[table];
  if (!query) return [];
  const db = await getDb();
  return db.getAllAsync(query);
}

function toMillis(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) return 0;
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

async function localIdForServerId(table: string, serverId: unknown): Promise<number | null> {
  if (serverId === null || serverId === undefined) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<{id: number}>(
    `SELECT id FROM ${table} WHERE server_id = ?;`,
    [serverId as string],
  );
  return row?.id ?? null;
}

async function lwwUpsert(
  table: string,
  serverId: string,
  incomingUpdatedAt: unknown,
  columns: Record<string, BindValue>,
  hasDirty = true,
): Promise<number | null> {
  const db = await getDb();
  const existingRow = await db.getFirstAsync<{id: number; updated_at?: string}>(
    `SELECT id, updated_at FROM ${table} WHERE server_id = ?;`,
    [serverId],
  );

  const cols = Object.keys(columns);
  const vals = Object.values(columns);

  if (existingRow) {
    if (
      toMillis(existingRow.updated_at) >= toMillis(incomingUpdatedAt) &&
      toMillis(incomingUpdatedAt) > 0
    ) {
      return existingRow.id;
    }
    const setClause = cols.map(c => `${c} = ?`).join(', ');
    const dirty = hasDirty ? ', is_dirty = 0' : '';
    await db.runAsync(
      `UPDATE ${table} SET ${setClause}${dirty}, synced_at = datetime('now') WHERE id = ?;`,
      [...vals, existingRow.id],
    );
    return existingRow.id;
  }

  const dirtyCol = hasDirty ? ', is_dirty' : '';
  const dirtyVal = hasDirty ? ', 0' : '';
  const placeholders = cols.map(() => '?').join(', ');
  const result = await db.runAsync(
    `INSERT INTO ${table} (server_id, ${cols.join(', ')}${dirtyCol}, synced_at)
     VALUES (?, ${placeholders}${dirtyVal}, datetime('now'));`,
    [serverId, ...vals],
  );
  return result.lastInsertRowId;
}

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
      continue;
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

  const setIdMap = new Map<string, number>();
  {
    const db = await getDb();
    const rows = await db.getAllAsync<{id: number; server_id: string}>(
      'SELECT id, server_id FROM question_sets WHERE server_id IS NOT NULL;',
    );
    for (const r of rows) setIdMap.set(r.server_id, r.id);
  }

  const questionIdMap = new Map<string, number>();
  let qApplied = 0;
  let qSkipped = 0;
  for (const q of data.questions ?? []) {
    const setId = setIdMap.get(q.set_id);
    if (!setId) {qSkipped++; continue;}
    const localId = await lwwUpsert('questions', q.id, q.updated_at, {
      set_id: setId,
      text: q.text ?? '',
      explanation: q.explanation ?? null,
      updated_at: q.updated_at ?? null,
    });
    if (localId) questionIdMap.set(q.id, localId);
    qApplied++;
  }

  const db = await getDb();
  let oApplied = 0;
  let oSkipped = 0;
  for (const o of data.options ?? []) {
    let questionId = questionIdMap.get(o.question_id);
    if (!questionId) {
      questionId = (await localIdForServerId('questions', o.question_id)) ?? undefined;
    }
    if (!questionId) {oSkipped++; continue;}

    const existing = await db.getFirstAsync<{id: number}>(
      'SELECT id FROM options WHERE server_id = ?;',
      [o.id],
    );
    if (existing) {
      await db.runAsync(
        `UPDATE options SET question_id = ?, text = ?, is_correct = ?, synced_at = datetime('now')
         WHERE id = ?;`,
        [questionId, o.text ?? '', o.is_correct ? 1 : 0, existing.id],
      );
    } else {
      await db.runAsync(
        `INSERT INTO options (server_id, question_id, text, is_correct, synced_at)
         VALUES (?, ?, ?, ?, datetime('now'));`,
        [o.id, questionId, o.text ?? '', o.is_correct ? 1 : 0],
      );
    }
    oApplied++;
  }

  console.log('[Sync] applyDelta', {setsApplied, qApplied, qSkipped, oApplied, oSkipped});

  for (const s of data.sessions ?? []) {
    const setId = await localIdForServerId('question_sets', s.set_id);
    if (!setId) continue;
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

  for (const u of data.app_usage ?? []) {
    const row = await db.getFirstAsync<{id: number; updated_at?: string}>(
      `SELECT id, updated_at FROM app_usage WHERE date = ?;`,
      [u.date],
    );
    if (row) {
      if (toMillis(row.updated_at) >= toMillis(u.updated_at) && toMillis(u.updated_at) > 0) continue;
      await db.runAsync(
        `UPDATE app_usage SET server_id = ?, seconds_active = ?, is_dirty = 0,
           updated_at = ?, synced_at = datetime('now') WHERE id = ?;`,
        [u.id, u.seconds_active ?? 0, u.updated_at ?? null, row.id],
      );
    } else {
      await db.runAsync(
        `INSERT INTO app_usage (server_id, date, seconds_active, is_dirty, updated_at, synced_at)
         VALUES (?, ?, ?, 0, ?, datetime('now'));`,
        [u.id, u.date, u.seconds_active ?? 0, u.updated_at ?? null],
      );
    }
  }

  for (const loc of data.locations ?? []) {
    const serverId = String(loc.id ?? loc.server_id ?? '');
    if (!serverId) continue;
    const row = await db.getFirstAsync<{id: number; updated_at?: string}>(
      `SELECT id, updated_at FROM locations WHERE server_id = ?;`,
      [serverId],
    );
    if (row) {
      if (toMillis(row.updated_at) >= toMillis(loc.updated_at) && toMillis(loc.updated_at) > 0) continue;
      await db.runAsync(
        `UPDATE locations SET latitude = ?, longitude = ?, accuracy = ?, altitude = ?,
           speed = ?, heading = ?, recorded_at = ?, location_source = ?,
           battery_level = ?, is_dirty = 0, updated_at = ?, synced_at = datetime('now')
         WHERE id = ?;`,
        [loc.latitude, loc.longitude, loc.accuracy, loc.altitude ?? null,
          loc.speed ?? null, loc.heading ?? null, loc.recorded_at,
          loc.location_source ?? 'fused', loc.battery_level ?? null, loc.updated_at, row.id],
      );
    } else {
      await db.runAsync(
        `INSERT INTO locations (server_id, latitude, longitude, accuracy, altitude, speed,
           heading, recorded_at, location_source, battery_level, is_dirty, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'));`,
        [serverId, loc.latitude, loc.longitude, loc.accuracy, loc.altitude ?? null,
          loc.speed ?? null, loc.heading ?? null, loc.recorded_at,
          loc.location_source ?? 'fused', loc.battery_level ?? null, loc.updated_at],
      );
    }
  }
}

let syncing = false;

export const SyncService = {
  async run(deviceId: string): Promise<void> {
    if (syncing) {console.log('[Sync] skip — already running'); return;}
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
    if (!hasDirty) return;

    const {data} = await api.post('/sync', payload);
    const mappings: Record<string, Array<{local_id: number; server_id: string}>> =
      data?.mappings ?? {};
    const db = await getDb();
    for (const [table, list] of Object.entries(mappings)) {
      for (const m of list) {
        if (TABLES_WITHOUT_DIRTY.has(table)) {
          await db.runAsync(
            `UPDATE ${table} SET server_id = ?, synced_at = datetime('now') WHERE id = ?;`,
            [m.server_id, m.local_id],
          );
        } else {
          await db.runAsync(
            `UPDATE ${table} SET server_id = ?, is_dirty = 0, synced_at = datetime('now') WHERE id = ?;`,
            [m.server_id, m.local_id],
          );
        }
      }
    }
  },

  async pull(): Promise<void> {
    const since = (await getMeta(LAST_SYNCED_KEY)) ?? '';
    const {data} = await api.get('/sync/pull', {params: {since}});

    console.log('[Sync] pull received', {
      since,
      subjects: data?.subjects?.length ?? 0,
      courses: data?.courses?.length ?? 0,
      question_sets: data?.question_sets?.length ?? 0,
      questions: data?.questions?.length ?? 0,
    });

    if (data?.subjects) await subjectRepo.upsertSubjects(data.subjects);
    if (data?.courses) await subjectRepo.upsertCourses(data.courses);

    try {
      await applyDelta(data ?? {});
    } catch (e) {
      console.error('[Sync] applyDelta threw', e);
      throw e;
    }

    const db = await getDb();
    const after = await db.getFirstAsync<{sets: number; qs: number}>(
      'SELECT (SELECT COUNT(*) FROM question_sets) AS sets, (SELECT COUNT(*) FROM questions) AS qs;',
    );
    console.log('[Sync] local DB after pull', after);
    await setMeta(LAST_SYNCED_KEY, new Date().toISOString());
  },
};
