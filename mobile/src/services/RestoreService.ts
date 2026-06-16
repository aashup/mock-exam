import {api} from '@/api/client';
import {getDb, isDatabaseEmpty, setMeta, transaction} from '@/db/database';

interface RestorePayload {
  subjects: any[];
  courses: any[];
  course_subjects: Array<{course_server_id: string; subject_server_id: string}>;
  question_sets: any[];
  questions: any[];
  options: any[];
  sessions: any[];
  attempts: any[];
  analytics: any[];
  app_usage: any[];
}

export const RestoreService = {
  async restoreIfFreshDevice(onProgress?: (pct: number) => void): Promise<boolean> {
    if (!(await isDatabaseEmpty())) return false;
    await RestoreService.fullRestore(onProgress);
    return true;
  },

  async fullRestore(onProgress?: (pct: number) => void): Promise<void> {
    const {data} = await api.get<RestorePayload>('/restore');

    const subjectMap = new Map<string, number>();
    const courseMap = new Map<string, number>();
    const setMap = new Map<string, number>();
    const questionMap = new Map<string, number>();
    const optionMap = new Map<string, number>();
    const sessionMap = new Map<string, number>();

    await transaction(async () => {
      const db = await getDb();

      for (const s of data.subjects ?? []) {
        const r = await db.runAsync(
          `INSERT INTO subjects (server_id, name, synced_at, updated_at)
           VALUES (?, ?, datetime('now'), ?);`,
          [s.id, s.name, s.updated_at],
        );
        subjectMap.set(s.id, r.lastInsertRowId);
      }
      onProgress?.(15);

      for (const c of data.courses ?? []) {
        const r = await db.runAsync(
          `INSERT INTO courses (server_id, name, exam_type, synced_at, updated_at)
           VALUES (?, ?, ?, datetime('now'), ?);`,
          [c.id, c.name, c.exam_type ?? null, c.updated_at],
        );
        courseMap.set(c.id, r.lastInsertRowId);
      }

      for (const link of data.course_subjects ?? []) {
        const cId = courseMap.get(link.course_server_id);
        const sId = subjectMap.get(link.subject_server_id);
        if (cId && sId) {
          await db.runAsync(
            `INSERT OR IGNORE INTO course_subjects (course_id, subject_id) VALUES (?, ?);`,
            [cId, sId],
          );
        }
      }
      onProgress?.(30);

      for (const qs of data.question_sets ?? []) {
        const r = await db.runAsync(
          `INSERT INTO question_sets
             (server_id, subject_id, course_id, difficulty, total_questions,
              generated_at, is_dirty, updated_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, datetime('now'));`,
          [
            qs.id,
            subjectMap.get(qs.subject_id) ?? null,
            qs.course_id ? courseMap.get(qs.course_id) ?? null : null,
            qs.difficulty,
            qs.total_questions,
            qs.generated_at,
            qs.updated_at,
          ],
        );
        setMap.set(qs.id, r.lastInsertRowId);
      }
      onProgress?.(50);

      for (const q of data.questions ?? []) {
        const r = await db.runAsync(
          `INSERT INTO questions (server_id, set_id, text, explanation, is_dirty, updated_at, synced_at)
           VALUES (?, ?, ?, ?, 0, ?, datetime('now'));`,
          [q.id, setMap.get(q.set_id) ?? null, q.text, q.explanation ?? null, q.updated_at],
        );
        questionMap.set(q.id, r.lastInsertRowId);
      }

      for (const o of data.options ?? []) {
        const r = await db.runAsync(
          `INSERT INTO options (server_id, question_id, text, is_correct, synced_at)
           VALUES (?, ?, ?, ?, datetime('now'));`,
          [o.id, questionMap.get(o.question_id) ?? null, o.text, o.is_correct ? 1 : 0],
        );
        optionMap.set(o.id, r.lastInsertRowId);
      }
      onProgress?.(70);

      for (const s of data.sessions ?? []) {
        const r = await db.runAsync(
          `INSERT INTO sessions
             (server_id, set_id, mode, feedback_mode, total_questions, duration_seconds,
              status, score, started_at, completed_at, is_dirty, updated_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'));`,
          [
            s.id,
            setMap.get(s.set_id) ?? null,
            s.mode, s.feedback_mode, s.total_questions,
            s.duration_seconds ?? null, s.status, s.score ?? null,
            s.started_at, s.completed_at ?? null, s.updated_at,
          ],
        );
        sessionMap.set(s.id, r.lastInsertRowId);
      }

      for (const a of data.attempts ?? []) {
        await db.runAsync(
          `INSERT INTO attempts
             (server_id, session_id, question_id, selected_option_id, is_correct,
              time_taken_seconds, answered_at, is_dirty, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'));`,
          [
            a.id,
            sessionMap.get(a.session_id) ?? null,
            questionMap.get(a.question_id) ?? null,
            a.selected_option_id ? optionMap.get(a.selected_option_id) ?? null : null,
            a.is_correct ? 1 : 0,
            a.time_taken_seconds ?? null,
            a.answered_at,
          ],
        );
      }
      onProgress?.(90);

      for (const an of data.analytics ?? []) {
        await db.runAsync(
          `INSERT INTO analytics
             (server_id, subject_id, course_id, difficulty, total_attempted, total_correct,
              accuracy_percent, avg_time_per_question, is_dirty, updated_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'));`,
          [
            an.id,
            an.subject_id ? subjectMap.get(an.subject_id) ?? null : null,
            an.course_id ? courseMap.get(an.course_id) ?? null : null,
            an.difficulty ?? null,
            an.total_attempted, an.total_correct, an.accuracy_percent,
            an.avg_time_per_question ?? null, an.updated_at,
          ],
        );
      }

      for (const u of data.app_usage ?? []) {
        await db.runAsync(
          `INSERT INTO app_usage (server_id, date, seconds_active, is_dirty, updated_at, synced_at)
           VALUES (?, ?, ?, 0, ?, datetime('now'))
           ON CONFLICT(date) DO UPDATE SET seconds_active = excluded.seconds_active;`,
          [u.id, u.date, u.seconds_active, u.updated_at],
        );
      }
    });

    await setMeta('last_synced_at', new Date().toISOString());
    onProgress?.(100);
  },
};
