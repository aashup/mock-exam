import {getDb} from '../database';
import type {Course, Subject} from '@/types/models';

export const subjectRepo = {
  async all(): Promise<Subject[]> {
    const db = await getDb();
    return db.getAllAsync<Subject>('SELECT * FROM subjects ORDER BY name;');
  },

  async coursesForSubject(subjectId: number): Promise<Course[]> {
    const db = await getDb();
    return db.getAllAsync<Course>(
      `SELECT c.* FROM courses c
       JOIN course_subjects cs ON cs.course_id = c.id
       WHERE cs.subject_id = ?
       ORDER BY c.name;`,
      [subjectId],
    );
  },

  async upsertSubjects(subjects: Array<{server_id: string; name: string}>): Promise<void> {
    const db = await getDb();
    for (const s of subjects) {
      const existing = await db.getFirstAsync<{id: number}>(
        'SELECT id FROM subjects WHERE server_id = ?;',
        [s.server_id],
      );
      if (existing) {
        await db.runAsync(
          `UPDATE subjects SET name = ?, synced_at = datetime('now') WHERE server_id = ?;`,
          [s.name, s.server_id],
        );
      } else {
        await db.runAsync(
          `INSERT INTO subjects (server_id, name, synced_at, updated_at)
           VALUES (?, ?, datetime('now'), datetime('now'));`,
          [s.server_id, s.name],
        );
      }
    }
  },

  async upsertCourses(
    courses: Array<{
      server_id: string;
      name: string;
      exam_type: string | null;
      subject_server_ids: string[];
    }>,
  ): Promise<void> {
    const db = await getDb();
    for (const c of courses) {
      const existing = await db.getFirstAsync<{id: number}>(
        'SELECT id FROM courses WHERE server_id = ?;',
        [c.server_id],
      );
      if (existing) {
        await db.runAsync(
          `UPDATE courses SET name = ?, exam_type = ?, synced_at = datetime('now')
           WHERE server_id = ?;`,
          [c.name, c.exam_type ?? null, c.server_id],
        );
      } else {
        await db.runAsync(
          `INSERT INTO courses (server_id, name, exam_type, synced_at, updated_at)
           VALUES (?, ?, ?, datetime('now'), datetime('now'));`,
          [c.server_id, c.name, c.exam_type ?? null],
        );
      }

      const courseRow = await db.getFirstAsync<{id: number}>(
        'SELECT id FROM courses WHERE server_id = ?;',
        [c.server_id],
      );
      if (!courseRow) continue;

      await db.runAsync('DELETE FROM course_subjects WHERE course_id = ?;', [courseRow.id]);
      for (const subjServerId of c.subject_server_ids) {
        const subjRow = await db.getFirstAsync<{id: number}>(
          'SELECT id FROM subjects WHERE server_id = ?;',
          [subjServerId],
        );
        if (subjRow) {
          await db.runAsync(
            `INSERT OR IGNORE INTO course_subjects (course_id, subject_id) VALUES (?, ?);`,
            [courseRow.id, subjRow.id],
          );
        }
      }
    }
  },
};
