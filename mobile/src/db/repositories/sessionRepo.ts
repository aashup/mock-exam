import {getDb} from '../database';
import type {
  FeedbackMode,
  Option,
  Session,
  TestLanguage,
  TestMode,
} from '@/types/models';

function rows<T>(res: {rows: unknown[]}): T[] {
  return res.rows as T[];
}

/** One question's worth of review data: the question, its options, and the
 *  student's recorded answer for a given session. */
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
    /** 1 when started offline from the local bank; defaults to online (0). */
    isOffline?: boolean;
  }): Promise<number> {
    const res = await getDb().execute(
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
    return Number(res.insertId);
  },

  /** Records a single answer attempt. */
  async recordAttempt(params: {
    sessionId: number;
    questionId: number;
    selectedOptionId: number | null;
    isCorrect: boolean;
    timeTakenSeconds: number | null;
  }): Promise<void> {
    await getDb().execute(
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

  /** Persists resume state (current index + remaining time) for an active session. */
  async saveResumeState(sessionId: number, payload: object): Promise<void> {
    await getDb().execute(
      `UPDATE sessions SET resume_payload = ?, is_dirty = 1, updated_at = datetime('now')
       WHERE id = ?;`,
      [JSON.stringify(payload), sessionId],
    );
  },

  async complete(sessionId: number, score: number): Promise<void> {
    await getDb().execute(
      `UPDATE sessions
         SET status = 'completed', score = ?, completed_at = datetime('now'),
             resume_payload = NULL, is_dirty = 1, updated_at = datetime('now')
       WHERE id = ?;`,
      [score, sessionId],
    );
  },

  /** Returns any session left in 'active' state — used for the resume prompt. */
  async findActive(): Promise<Session | null> {
    const res = await getDb().execute(
      `SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1;`,
    );
    return rows<Session>(res)[0] ?? null;
  },

  async history(): Promise<Session[]> {
    const res = await getDb().execute(
      `SELECT * FROM sessions WHERE status = 'completed' ORDER BY completed_at DESC;`,
    );
    return rows<Session>(res);
  },

  /**
   * Full question-by-question review of a past session: the question + its
   * options, joined to the student's recorded attempt. Ordered by question id.
   */
  async reviewData(sessionId: number): Promise<SessionReview | null> {
    const db = getDb();

    const session = rows<Session>(
      await db.execute('SELECT * FROM sessions WHERE id = ?;', [sessionId]),
    )[0];
    if (!session) {
      return null;
    }

    // Questions for the session's set, with the attempt (if any) for this session.
    const qRows = rows<{
      id: number;
      text: string;
      explanation: string | null;
      selected_option_id: number | null;
      is_correct: number | null;
    }>(
      await db.execute(
        `SELECT q.id, q.text, q.explanation,
                a.selected_option_id, a.is_correct
         FROM questions q
         LEFT JOIN attempts a
           ON a.question_id = q.id AND a.session_id = ?
         WHERE q.set_id = ?
         ORDER BY q.id;`,
        [sessionId, session.set_id],
      ),
    );

    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    const items: ReviewItem[] = [];

    for (const q of qRows) {
      const options = rows<Option>(
        await db.execute(
          'SELECT * FROM options WHERE question_id = ? ORDER BY id;',
          [q.id],
        ),
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

  /**
   * The subject/course context + question count behind a finished session.
   * Used by the Results screen's "Next {n}" button to launch a follow-up test
   * on the SAME subject with the SAME number of questions (the student only
   * re-picks the difficulty). Joins session → set → subject/course.
   */
  async practiceContext(sessionId: number): Promise<{
    subjectId: number;
    subjectName: string | null;
    courseId: number | null;
    courseName: string | null;
    language: TestLanguage;
    count: number;
    isOffline: boolean;
  } | null> {
    const res = await getDb().execute(
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
    const row = rows<{
      subjectId: number;
      subjectName: string | null;
      courseId: number | null;
      courseName: string | null;
      language: TestLanguage;
      count: number;
      isOffline: number;
    }>(res)[0];
    return row ? {...row, isOffline: row.isOffline === 1} : null;
  },

  /**
   * Mints a fresh active session from an existing stored set (revision / mock),
   * reusing the set's metadata. Returns the new session id.
   */
  async startFromSet(
    setId: number,
    params: {
      mode: TestMode;
      feedbackMode: FeedbackMode;
      durationSeconds: number | null;
    },
  ): Promise<number> {
    const db = getDb();
    const total = rows<{total_questions: number}>(
      await db.execute(
        'SELECT total_questions FROM question_sets WHERE id = ?;',
        [setId],
      ),
    )[0];

    return sessionRepo.create({
      setId,
      mode: params.mode,
      feedbackMode: params.feedbackMode,
      totalQuestions: total?.total_questions ?? 0,
      durationSeconds: params.durationSeconds,
    });
  },
};
