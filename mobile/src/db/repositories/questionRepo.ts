import {getDb, transaction} from '../database';
import type {AIResponse} from '@/types/ai';
import type {Difficulty, Option, Question, QuestionSet, QuestionWithOptions, TestLanguage} from '@/types/models';

export interface SetWithSubject extends QuestionSet {
  subject_name: string | null;
}

export const questionRepo = {
  async saveGeneratedSet(params: {
    subjectId: number;
    courseId: number | null;
    difficulty: Difficulty;
    language: TestLanguage;
    questions: AIResponse;
  }): Promise<number> {
    const {subjectId, courseId, difficulty, language, questions} = params;
    let setId = 0;

    await transaction(async () => {
      const db = await getDb();
      const setResult = await db.runAsync(
        `INSERT INTO question_sets
           (subject_id, course_id, difficulty, language, total_questions, generated_at, is_dirty, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'));`,
        [subjectId, courseId, difficulty, language, questions.length],
      );
      setId = setResult.lastInsertRowId;

      for (const q of questions) {
        const qResult = await db.runAsync(
          `INSERT INTO questions (set_id, text, explanation, is_dirty, updated_at)
           VALUES (?, ?, ?, 1, datetime('now'));`,
          [setId, q.question, q.explanation ?? null],
        );
        const questionId = qResult.lastInsertRowId;

        for (const opt of q.options) {
          await db.runAsync(
            `INSERT INTO options (question_id, text, is_correct) VALUES (?, ?, ?);`,
            [questionId, opt.text, opt.is_correct ? 1 : 0],
          );
        }
      }
    });

    return setId;
  },

  async findReusableSet(
    subjectId: number,
    difficulty: Difficulty,
    language: TestLanguage,
  ): Promise<QuestionSet | null> {
    const db = await getDb();
    return db.getFirstAsync<QuestionSet>(
      `SELECT qs.* FROM question_sets qs
       WHERE qs.subject_id = ? AND qs.difficulty = ? AND qs.language = ?
         AND NOT EXISTS (
           SELECT 1 FROM sessions s WHERE s.set_id = qs.id AND s.status = 'completed'
         )
       ORDER BY qs.generated_at DESC LIMIT 1;`,
      [subjectId, difficulty, language],
    );
  },

  async bestLocalSet(subjectId: number, difficulty: Difficulty, courseId: number): Promise<QuestionSet | null> {
    const db = await getDb();
    return db.getFirstAsync<QuestionSet>(
      `SELECT * FROM question_sets
       WHERE subject_id = ? AND course_id = ? AND total_questions > 0
       ORDER BY (difficulty = ?) DESC, total_questions DESC, generated_at DESC
       LIMIT 1;`,
      [subjectId, courseId, difficulty], // Added subjectId here to match the updated WHERE clause
    );
  },

  async allSets(): Promise<SetWithSubject[]> {
    const db = await getDb();
    return db.getAllAsync<SetWithSubject>(
      `SELECT qs.*, s.name AS subject_name
       FROM question_sets qs
       LEFT JOIN subjects s ON s.id = qs.subject_id
       ORDER BY qs.generated_at DESC;`,
    );
  },

  async debugCounts(setId: number): Promise<{
    setId: number;
    questionsForSet: number;
    optionsForSet: number;
    totalSets: number;
    totalQuestions: number;
    setRow: QuestionSet | null;
  }> {
    const db = await getDb();
    // Fixed typing: Prevented forced 'string[]' cast on numeric bindings
    const one = async (sql: string, args: (string | number | null)[] = []): Promise<number> => {
      const r = await db.getFirstAsync<{c: number}>(sql, args);
      return r?.c ?? 0;
    };
    
    const setRow = await db.getFirstAsync<QuestionSet>(
      'SELECT * FROM question_sets WHERE id = ?;',
      [setId],
    );
    
    return {
      setId,
      questionsForSet: await one('SELECT COUNT(*) AS c FROM questions WHERE set_id = ?;', [setId]),
      optionsForSet: await one(
        `SELECT COUNT(*) AS c FROM options o
         JOIN questions q ON q.id = o.question_id WHERE q.set_id = ?;`,
        [setId],
      ),
      totalSets: await one('SELECT COUNT(*) AS c FROM question_sets;'),
      totalQuestions: await one('SELECT COUNT(*) AS c FROM questions;'),
      setRow: setRow ?? null,
    };
  },

  async loadSetQuestions(setId: number, limit?: number): Promise<QuestionWithOptions[]> {
    const db = await getDb();
    const limitClause = limit && limit > 0 ? ` LIMIT ${Math.floor(limit)}` : '';
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await db.getAllAsync<any>(
      `SELECT 
          q.*,
          (
            SELECT json_group_array(
              json_object(
                'id', o.id,
                'server_id', o.server_id,
                'question_id', o.question_id,
                'text', o.text,
                'is_correct', o.is_correct,
                'synced_at', o.synced_at
              )
            ) 
            FROM options o 
            WHERE o.question_id = q.id
            ORDER BY o.id
          ) AS options_json
      FROM questions q
      LEFT JOIN attempts a ON q.id = a.question_id
      WHERE q.set_id = ? 
        AND (a.id IS NULL OR a.is_correct = 0)
      GROUP BY q.id
      ORDER BY q.id
      ${limitClause};`,
      [setId],
    );

    return rows.map(row => {
      const { options_json, ...questionFields } = row;
      const parsedOptions = JSON.parse(options_json);
      
      return {
        ...questionFields,
        // Safely map SQLite integer 0/1 back to TypeScript boolean for 'is_correct'
        options: parsedOptions.map((opt: any) => ({
          ...opt,
          is_correct: Boolean(opt.is_correct) 
        })) as Option[]
      };
    });
  } 
};