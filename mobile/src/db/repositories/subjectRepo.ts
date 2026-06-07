import {getDb} from '../database';
import type {Course, Subject} from '@/types/models';

function rows<T>(res: {rows: unknown[]}): T[] {
  return res.rows as T[];
}

export const subjectRepo = {
  async all(): Promise<Subject[]> {
    const res = await getDb().execute('SELECT * FROM subjects ORDER BY name;');
    return rows<Subject>(res);
  },

  async coursesForSubject(subjectId: number): Promise<Course[]> {
    const res = await getDb().execute(
      `SELECT c.* FROM courses c
       JOIN course_subjects cs ON cs.course_id = c.id
       WHERE cs.subject_id = ?
       ORDER BY c.name;`,
      [subjectId],
    );
    return rows<Course>(res);
  },

  /**
   * Upserts reference data pulled from the backend. Reference data is
   * server-authoritative, so we always overwrite the local copy.
   */
  async upsertSubjects(subjects: Array<{server_id: string; name: string}>): Promise<void> {
    const db = getDb();
    for (const s of subjects) {
      // server_id is the stable key for reference data. Update if present,
      // otherwise insert. (No ON CONFLICT: server_id is not a UNIQUE column.)
      const existing = await db.execute('SELECT id FROM subjects WHERE server_id = ?;', [
        s.server_id,
      ]);
      if (existing.rows.length > 0) {
        await db.execute(
          `UPDATE subjects SET name = ?, synced_at = datetime('now') WHERE server_id = ?;`,
          [s.name, s.server_id],
        );
      } else {
        await db.execute(
          `INSERT INTO subjects (server_id, name, synced_at, updated_at)
           VALUES (?, ?, datetime('now'), datetime('now'));`,
          [s.server_id, s.name],
        );
      }
    }
  },

  async upsertCourses(
    courses: Array<{server_id: string; name: string; exam_type: string | null; subject_server_ids: string[]}>,
  ): Promise<void> {
    const db = getDb();
    for (const c of courses) {
      const existing = await db.execute('SELECT id FROM courses WHERE server_id = ?;', [
        c.server_id,
      ]);
      if (existing.rows.length > 0) {
        await db.execute(
          `UPDATE courses SET name = ?, exam_type = ?, synced_at = datetime('now')
           WHERE server_id = ?;`,
          [c.name, c.exam_type ?? null, c.server_id],
        );
      } else {
        await db.execute(
          `INSERT INTO courses (server_id, name, exam_type, synced_at, updated_at)
           VALUES (?, ?, ?, datetime('now'), datetime('now'));`,
          [c.server_id, c.name, c.exam_type ?? null],
        );
      }

      const courseRow = await db.execute('SELECT id FROM courses WHERE server_id = ?;', [
        c.server_id,
      ]);
      const courseId = courseRow.rows[0]?.id as number | undefined;
      if (!courseId) {
        continue;
      }

      // rebuild M2M links for this course
      await db.execute('DELETE FROM course_subjects WHERE course_id = ?;', [courseId]);
      for (const subjServerId of c.subject_server_ids) {
        const subjRow = await db.execute('SELECT id FROM subjects WHERE server_id = ?;', [
          subjServerId,
        ]);
        const subjectId = subjRow.rows[0]?.id as number | undefined;
        if (subjectId) {
          await db.execute(
            `INSERT OR IGNORE INTO course_subjects (course_id, subject_id) VALUES (?, ?);`,
            [courseId, subjectId],
          );
        }
      }
    }
  },
};
