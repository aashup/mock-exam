import {getDb} from '../database';

function rows<T>(res: {rows: unknown[]}): T[] {
  return res.rows as T[];
}

export interface OverallStats {
  attempted: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number;
}

export interface SubjectStat {
  subjectId: number;
  subjectName: string;
  attempted: number;
  correct: number;
  accuracyPercent: number;
}

/**
 * Maintains the cumulative analytics rows keyed by subject + difficulty.
 * Updated whenever a session is completed. Marked is_dirty so it syncs.
 */
export const analyticsRepo = {
  /** All-time totals computed live from the attempts table. */
  async overall(): Promise<OverallStats> {
    const row = rows<{attempted: number; correct: number}>(
      await getDb().execute(
        `SELECT COUNT(*) AS attempted,
                COALESCE(SUM(is_correct), 0) AS correct
         FROM attempts;`,
      ),
    )[0];
    const attempted = row?.attempted ?? 0;
    const correct = row?.correct ?? 0;
    return {
      attempted,
      correct,
      incorrect: attempted - correct,
      accuracyPercent:
        attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0,
    };
  },

  /**
   * Per-subject accuracy, derived by joining attempts through to the owning
   * subject. Ordered worst-accuracy first so the weakest subjects surface.
   */
  async perSubject(): Promise<SubjectStat[]> {
    const res = await getDb().execute(
      `SELECT s.id AS subject_id, s.name AS subject_name,
              COUNT(a.id) AS attempted,
              COALESCE(SUM(a.is_correct), 0) AS correct
       FROM attempts a
       JOIN questions q ON q.id = a.question_id
       JOIN question_sets qs ON qs.id = q.set_id
       JOIN subjects s ON s.id = qs.subject_id
       GROUP BY s.id, s.name
       HAVING attempted > 0
       ORDER BY (CAST(correct AS REAL) / attempted) ASC;`,
    );
    return rows<{
      subject_id: number;
      subject_name: string;
      attempted: number;
      correct: number;
    }>(res).map(r => ({
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      attempted: r.attempted,
      correct: r.correct,
      accuracyPercent:
        r.attempted > 0 ? Math.round((r.correct / r.attempted) * 1000) / 10 : 0,
    }));
  },

  async recordSessionResult(params: {
    setId: number;
    attempted: number;
    correct: number;
  }): Promise<void> {
    const db = getDb();

    // Resolve the subject/course/difficulty for this set.
    const setRow = await db.execute(
      'SELECT subject_id, course_id, difficulty FROM question_sets WHERE id = ?;',
      [params.setId],
    );
    const meta = setRow.rows[0] as
      | {subject_id: number; course_id: number | null; difficulty: string}
      | undefined;
    if (!meta) {
      return;
    }

    // Find an existing analytics bucket for this subject/difficulty.
    const existing = await db.execute(
      `SELECT id, total_attempted, total_correct FROM analytics
       WHERE subject_id = ? AND difficulty = ?
         AND (course_id IS ? OR course_id = ?) LIMIT 1;`,
      [meta.subject_id, meta.difficulty, meta.course_id, meta.course_id],
    );
    const row = existing.rows[0] as
      | {id: number; total_attempted: number; total_correct: number}
      | undefined;

    if (row) {
      const attempted = row.total_attempted + params.attempted;
      const correct = row.total_correct + params.correct;
      const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
      await db.execute(
        `UPDATE analytics
           SET total_attempted = ?, total_correct = ?, accuracy_percent = ?,
               is_dirty = 1, updated_at = datetime('now')
         WHERE id = ?;`,
        [attempted, correct, accuracy, row.id],
      );
    } else {
      const accuracy = params.attempted > 0 ? (params.correct / params.attempted) * 100 : 0;
      await db.execute(
        `INSERT INTO analytics
           (subject_id, course_id, difficulty, total_attempted, total_correct,
            accuracy_percent, is_dirty, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'));`,
        [
          meta.subject_id,
          meta.course_id,
          meta.difficulty,
          params.attempted,
          params.correct,
          accuracy,
        ],
      );
    }
  },
};
