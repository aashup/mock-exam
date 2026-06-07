import {getDb, transaction} from '../database';
import type {AIResponse} from '@/types/ai';
import type {
  Difficulty,
  Option,
  Question,
  QuestionSet,
  QuestionWithOptions,
  TestLanguage,
} from '@/types/models';

function rows<T>(res: {rows: unknown[]}): T[] {
  return res.rows as T[];
}

/** A stored set with its subject name joined in, for the reuse library. */
export interface SetWithSubject extends QuestionSet {
  subject_name: string | null;
}

export const questionRepo = {
  /**
   * Persists an AI-generated batch as a new question_set with its questions
   * and options. Returns the new local set id. All rows are marked is_dirty=1
   * so the SyncService uploads them on the next cycle.
   */
  async saveGeneratedSet(params: {
    subjectId: number;
    courseId: number | null;
    difficulty: Difficulty;
    language: TestLanguage;
    questions: AIResponse;
  }): Promise<number> {
    const {subjectId, courseId, difficulty, language, questions} = params;
    let setId = 0;

    await transaction(async db => {
      const setRes = await db.execute(
        `INSERT INTO question_sets
           (subject_id, course_id, difficulty, language, total_questions, generated_at, is_dirty, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'));`,
        [subjectId, courseId, difficulty, language, questions.length],
      );
      setId = Number(setRes.insertId);

      for (const q of questions) {
        const qRes = await db.execute(
          `INSERT INTO questions (set_id, text, explanation, is_dirty, updated_at)
           VALUES (?, ?, ?, 1, datetime('now'));`,
          [setId, q.question, q.explanation ?? null],
        );
        const questionId = Number(qRes.insertId);

        for (const opt of q.options) {
          await db.execute(
            `INSERT INTO options (question_id, text, is_correct) VALUES (?, ?, ?);`,
            [questionId, opt.text, opt.is_correct ? 1 : 0],
          );
        }
      }
    });

    return setId;
  },

  /** Finds an existing un-attempted set matching subject + difficulty + language (dedupe/reuse). */
  async findReusableSet(
    subjectId: number,
    difficulty: Difficulty,
    language: TestLanguage,
  ): Promise<QuestionSet | null> {
    const res = await getDb().execute(
      `SELECT qs.* FROM question_sets qs
       WHERE qs.subject_id = ? AND qs.difficulty = ? AND qs.language = ?
         AND NOT EXISTS (
           SELECT 1 FROM sessions s WHERE s.set_id = qs.id AND s.status = 'completed'
         )
       ORDER BY qs.generated_at DESC LIMIT 1;`,
      [subjectId, difficulty, language],
    );
    return rows<QuestionSet>(res)[0] ?? null;
  },

  /**
   * Best locally-stored set to drive an OFFLINE test for a subject — no AI/
   * internet needed. Prefers a set matching the requested difficulty, then the
   * one with the most questions, then the newest. Unlike findReusableSet this
   * does NOT require the set to be un-attempted (offline practice may repeat).
   */
  async bestLocalSet(
    subjectId: number,
    difficulty: Difficulty,
  ): Promise<QuestionSet | null> {
    const res = await getDb().execute(
      `SELECT * FROM question_sets
       WHERE subject_id = ? AND total_questions > 0
       ORDER BY (difficulty = ?) DESC, total_questions DESC, generated_at DESC
       LIMIT 1;`,
      [subjectId, difficulty],
    );
    return rows<QuestionSet>(res)[0] ?? null;
  },

  /**
   * All stored sets for the reuse library, newest first, with the subject name
   * joined in for display/grouping.
   */
  async allSets(): Promise<SetWithSubject[]> {
    const res = await getDb().execute(
      `SELECT qs.*, s.name AS subject_name
       FROM question_sets qs
       LEFT JOIN subjects s ON s.id = qs.subject_id
       ORDER BY qs.generated_at DESC;`,
    );
    return rows<SetWithSubject>(res);
  },

  /**
   * Diagnostic counts for troubleshooting an empty test screen: how many
   * questions/options exist for a given set, plus device-wide totals.
   */
  async debugCounts(setId: number): Promise<{
    setId: number;
    questionsForSet: number;
    optionsForSet: number;
    totalSets: number;
    totalQuestions: number;
    setRow: QuestionSet | null;
  }> {
    const db = getDb();
    const one = async (sql: string, args: unknown[] = []): Promise<number> => {
      const r = await db.execute(sql, args as never);
      return Number((r.rows[0] as {c: number} | undefined)?.c ?? 0);
    };
    const setRow =
      rows<QuestionSet>(
        await db.execute('SELECT * FROM question_sets WHERE id = ?;', [setId]),
      )[0] ?? null;
    return {
      setId,
      questionsForSet: await one(
        'SELECT COUNT(*) AS c FROM questions WHERE set_id = ?;',
        [setId],
      ),
      optionsForSet: await one(
        `SELECT COUNT(*) AS c FROM options o
         JOIN questions q ON q.id = o.question_id WHERE q.set_id = ?;`,
        [setId],
      ),
      totalSets: await one('SELECT COUNT(*) AS c FROM question_sets;'),
      totalQuestions: await one('SELECT COUNT(*) AS c FROM questions;'),
      setRow,
    };
  },

  /**
   * Loads a set's questions with their options for the exam engine. Pass
   * `limit` to load only the top-N questions (used by the Offline Test, which
   * runs the first N stored questions of the best local set).
   */
  async loadSetQuestions(
    setId: number,
    limit?: number,
  ): Promise<QuestionWithOptions[]> {
    const db = getDb();
    const limitClause =
      limit && limit > 0 ? ` LIMIT ${Math.floor(limit)}` : '';
    const qRes = await db.execute(
      `SELECT * FROM questions WHERE set_id = ? ORDER BY id${limitClause};`,
      [setId],
    );
    const questions = rows<Question>(qRes);

    const result: QuestionWithOptions[] = [];
    for (const q of questions) {
      const oRes = await db.execute(
        'SELECT * FROM options WHERE question_id = ? ORDER BY id;',
        [q.id],
      );
      result.push({...q, options: rows<Option>(oRes)});
    }
    return result;
  },
};
