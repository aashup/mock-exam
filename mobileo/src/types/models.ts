/**
 * Shared domain types. These mirror the SQLite schema (see src/db/schema.ts)
 * and the Laravel backend tables. Sync metadata columns are included on every
 * syncable entity.
 */

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
/** Language the AI generates the question content in. */
export type TestLanguage = 'en' | 'hi';
export type TestMode = 'timed' | 'untimed';
export type FeedbackMode = 'immediate' | 'end';
export type SessionStatus = 'active' | 'completed' | 'abandoned';
export type AIProvider = 'gemini' | 'chatgpt';

/** Columns present on every syncable row. */
export interface SyncMeta {
  /** Backend id (UUID); null until the row has been synced at least once. */
  server_id: string | null;
  /** 1 when the row has local changes pending upload. */
  is_dirty: number;
  /** ISO timestamp of last local modification (last-write-wins). */
  updated_at: string;
  /** ISO timestamp of last successful sync, or null. */
  synced_at: string | null;
}

export interface Subject {
  id: number;
  server_id: string | null;
  name: string;
  synced_at: string | null;
  updated_at: string;
}

export interface Course {
  id: number;
  server_id: string | null;
  name: string;
  exam_type: string | null;
  synced_at: string | null;
  updated_at: string;
}

export interface QuestionSet extends SyncMeta {
  id: number;
  /** PRIMARY driver of the question content. */
  subject_id: number;
  /** OPTIONAL context only — questions depend mainly on the subject. */
  course_id: number | null;
  difficulty: Difficulty;
  /** Language the questions were generated in. */
  language: TestLanguage;
  total_questions: number;
  generated_at: string;
}

export interface Question extends Omit<SyncMeta, 'is_dirty'> {
  id: number;
  is_dirty: number;
  set_id: number;
  text: string;
  explanation: string | null;
}

export interface Option {
  id: number;
  server_id: string | null;
  question_id: number;
  text: string;
  is_correct: number;
  synced_at: string | null;
}

export interface Session extends SyncMeta {
  id: number;
  set_id: number;
  mode: TestMode;
  feedback_mode: FeedbackMode;
  total_questions: number;
  duration_seconds: number | null;
  status: SessionStatus;
  score: number | null;
  /** 1 = started from the local bank offline (device-local only, not synced). */
  is_offline: number;
  started_at: string;
  completed_at: string | null;
  /** JSON blob: { currentIndex, timeRemaining }. */
  resume_payload: string | null;
}

export interface Attempt {
  id: number;
  server_id: string | null;
  session_id: number;
  question_id: number;
  selected_option_id: number | null;
  is_correct: number;
  time_taken_seconds: number | null;
  answered_at: string;
  is_dirty: number;
  synced_at: string | null;
}

export interface Analytics extends SyncMeta {
  id: number;
  subject_id: number | null;
  course_id: number | null;
  difficulty: Difficulty | null;
  total_attempted: number;
  total_correct: number;
  accuracy_percent: number;
  avg_time_per_question: number | null;
}

export interface AppUsage extends SyncMeta {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  seconds_active: number;
}

/** A question with its options, as used by the exam engine UI. */
export interface QuestionWithOptions extends Question {
  options: Option[];
}

/** Aggregated metrics for the student dashboard. */
export interface DashboardStats {
  testsTaken: number;
  questionsAttempted: number;
  correct: number;
  wrong: number;
  accuracyPercent: number;
  timeOnAppSeconds: number;
  currentStreak: number;
}
