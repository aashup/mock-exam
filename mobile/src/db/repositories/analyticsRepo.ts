import {getDb} from '../database';

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

export const analyticsRepo = {
  async overall(): Promise<OverallStats> {
    const db = await getDb();
    const row = await db.getFirstAsync<{attempted: number; correct: number}>(
      `SELECT COUNT(*) AS attempted,
              COALESCE(SUM(is_correct), 0) AS correct
       FROM attempts;`,
    );
    const attempted = row?.attempted ?? 0;
    const correct = row?.correct ?? 0;
    return {
      attempted,
      correct,
      incorrect: attempted - correct,
      accuracyPercent: attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0,
    };
  },

  async perSubject(): Promise<SubjectStat[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      subject_id: number;
      subject_name: string;
      attempted: number;
      correct: number;
    }>(
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
    return rows.map(r => ({
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
    const db = await getDb();

    const meta = await db.getFirstAsync<{
      subject_id: number;
      course_id: number | null;
      difficulty: string;
    }>(
      'SELECT subject_id, course_id, difficulty FROM question_sets WHERE id = ?;',
      [params.setId],
    );
    if (!meta) return;

    const row = await db.getFirstAsync<{
      id: number;
      total_attempted: number;
      total_correct: number;
    }>(
      `SELECT id, total_attempted, total_correct FROM analytics
       WHERE subject_id = ? AND difficulty = ?
         AND (course_id IS ? OR course_id = ?) LIMIT 1;`,
      [meta.subject_id, meta.difficulty, meta.course_id, meta.course_id],
    );

    if (row) {
      const attempted = row.total_attempted + params.attempted;
      const correct = row.total_correct + params.correct;
      const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
      await db.runAsync(
        `UPDATE analytics
           SET total_attempted = ?, total_correct = ?, accuracy_percent = ?,
               is_dirty = 1, updated_at = datetime('now')
         WHERE id = ?;`,
        [attempted, correct, accuracy, row.id],
      );
    } else {
      const accuracy = params.attempted > 0 ? (params.correct / params.attempted) * 100 : 0;
      await db.runAsync(
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
