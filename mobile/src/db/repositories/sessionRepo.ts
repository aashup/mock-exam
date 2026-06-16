import {getDb} from '../database';
import type {FeedbackMode, Option, Session, TestLanguage, TestMode} from '@/types/models';

export interface ReviewItem {
  questionId: number;
  text: string;
  explanation: string | null;
  options: Option[];
  selectedOptionId: number | null;
  isCorrect: boolean;
}

export interface SessionReview {
  session: Session;
  items: ReviewItem[];
  correct: number;
  incorrect: number;
  skipped: number;
}

export const sessionRepo = {
  async create(params: {
    setId: number;
    mode: TestMode;
    feedbackMode: FeedbackMode;
    totalQuestions: number;
    durationSeconds: number | null;
    isOffline?: boolean;
  }): Promise<number> {
    const db = await getDb();
    const result = await db.runAsync(
      `INSERT INTO sessions
         (set_id, mode, feedback_mode, total_questions, duration_seconds, is_offline, status, started_at, is_dirty, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), 1, datetime('now'));`,
      [
        params.setId,
        params.mode,
        params.feedbackMode,
        params.totalQuestions,
        params.durationSeconds,
        params.isOffline ? 1 : 0,
      ],
    );
    return result.lastInsertRowId;
  },

  async recordAttempt(params: {
    sessionId: number;
    questionId: number;
    selectedOptionId: number | null;
    isCorrect: boolean;
    timeTakenSeconds: number | null;
  }): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO attempts
         (session_id, question_id, selected_option_id, is_correct, time_taken_seconds, answered_at, is_dirty)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 1);`,
      [
        params.sessionId,
        params.questionId,
        params.selectedOptionId,
        params.isCorrect ? 1 : 0,
        params.timeTakenSeconds,
      ],
    );
  },

  async saveResumeState(sessionId: number, payload: object): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE sessions SET resume_payload = ?, is_dirty = 1, updated_at = datetime('now')
       WHERE id = ?;`,
      [JSON.stringify(payload), sessionId],
    );
  },

  async complete(sessionId: number, score: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE sessions
         SET status = 'completed', score = ?, completed_at = datetime('now'),
             resume_payload = NULL, is_dirty = 1, updated_at = datetime('now')
       WHERE id = ?;`,
      [score, sessionId],
    );
  },

  async findActive(): Promise<Session | null> {
    const db = await getDb();
    return db.getFirstAsync<Session>(
      `SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1;`,
    );
  },

  async history(): Promise<Session[]> {
    const db = await getDb();
    return db.getAllAsync<Session>(
      `SELECT * FROM sessions WHERE status = 'completed' ORDER BY completed_at DESC;`,
    );
  },

  async reviewData(sessionId: number): Promise<SessionReview | null> {
    const db = await getDb();

    const session = await db.getFirstAsync<Session>(
      'SELECT * FROM sessions WHERE id = ?;',
      [sessionId],
    );
    if (!session) return null;

    const qRows = await db.getAllAsync<{
      id: number;
      text: string;
      explanation: string | null;
      selected_option_id: number | null;
      is_correct: number | null;
    }>(
      `SELECT q.id, q.text, q.explanation,
              a.selected_option_id, a.is_correct
       FROM questions q
       LEFT JOIN attempts a
         ON a.question_id = q.id AND a.session_id = ?
       WHERE q.set_id = ?
       ORDER BY q.id;`,
      [sessionId, session.set_id],
    );

    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    const items: ReviewItem[] = [];

    for (const q of qRows) {
      const options = await db.getAllAsync<Option>(
        'SELECT * FROM options WHERE question_id = ? ORDER BY id;',
        [q.id],
      );

      if (q.selected_option_id == null) {
        skipped += 1;
      } else if (q.is_correct === 1) {
        correct += 1;
      } else {
        incorrect += 1;
      }

      items.push({
        questionId: q.id,
        text: q.text,
        explanation: q.explanation,
        options,
        selectedOptionId: q.selected_option_id,
        isCorrect: q.is_correct === 1,
      });
    }

    return {session, items, correct, incorrect, skipped};
  },

  async practiceContext(sessionId: number): Promise<{
    subjectId: number;
    subjectName: string | null;
    courseId: number | null;
    courseName: string | null;
    language: TestLanguage;
    count: number;
    isOffline: boolean;
  } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{
      subjectId: number;
      subjectName: string | null;
      courseId: number | null;
      courseName: string | null;
      language: TestLanguage;
      count: number;
      isOffline: number;
    }>(
      `SELECT qs.subject_id AS subjectId,
              sub.name      AS subjectName,
              qs.course_id  AS courseId,
              c.name        AS courseName,
              qs.language   AS language,
              s.total_questions AS count,
              s.is_offline  AS isOffline
       FROM sessions s
       JOIN question_sets qs ON qs.id = s.set_id
       LEFT JOIN subjects sub ON sub.id = qs.subject_id
       LEFT JOIN courses  c   ON c.id  = qs.course_id
       WHERE s.id = ?;`,
      [sessionId],
    );
    return row ? {...row, isOffline: row.isOffline === 1} : null;
  },

  async startFromSet(
    setId: number,
    params: {
      mode: TestMode;
      feedbackMode: FeedbackMode;
      durationSeconds: number | null;
    },
  ): Promise<number> {
    const db = await getDb();
    const total = await db.getFirstAsync<{total_questions: number}>(
      'SELECT total_questions FROM question_sets WHERE id = ?;',
      [setId],
    );
    return sessionRepo.create({
      setId,
      mode: params.mode,
      feedbackMode: params.feedbackMode,
      totalQuestions: total?.total_questions ?? 0,
      durationSeconds: params.durationSeconds,
    });
  },
};
