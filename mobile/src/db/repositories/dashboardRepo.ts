import {getDb} from '../database';
import type {DashboardStats} from '@/types/models';

function first<T>(res: {rows: unknown[]}): T | undefined {
  return res.rows[0] as T | undefined;
}

/**
 * Computes the student dashboard metrics entirely from local SQLite so the
 * dashboard renders offline. Mirrors the backend GET /api/analytics/summary.
 */
export const dashboardRepo = {
  async stats(): Promise<DashboardStats> {
    const db = getDb();

    const counts = first<{
      tests: number;
      attempted: number;
      correct: number;
      wrong: number;
    }>(
      await db.execute(
        `SELECT
           (SELECT COUNT(*) FROM sessions WHERE status = 'completed') AS tests,
           (SELECT COUNT(*) FROM attempts) AS attempted,
           (SELECT COUNT(*) FROM attempts WHERE is_correct = 1) AS correct,
           (SELECT COUNT(*) FROM attempts WHERE is_correct = 0) AS wrong;`,
      ),
    );

    const usage = first<{seconds: number}>(
      await db.execute(`SELECT COALESCE(SUM(seconds_active), 0) AS seconds FROM app_usage;`),
    );

    const attempted = counts?.attempted ?? 0;
    const correct = counts?.correct ?? 0;

    return {
      testsTaken: counts?.tests ?? 0,
      questionsAttempted: attempted,
      correct,
      wrong: counts?.wrong ?? 0,
      accuracyPercent: attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0,
      timeOnAppSeconds: usage?.seconds ?? 0,
      currentStreak: await dashboardRepo.streak(),
    };
  },

  /** Counts consecutive days (ending today) that have a completed session. */
  async streak(): Promise<number> {
    const res = await getDb().execute(
      `SELECT DISTINCT date(completed_at) AS day
       FROM sessions WHERE status = 'completed'
       ORDER BY day DESC;`,
    );
    const days = res.rows.map(r => (r as {day: string}).day);

    let streak = 0;
    const cursor = new Date();
    for (const day of days) {
      const expected = cursor.toISOString().slice(0, 10);
      if (day === expected) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  },

  /** Accuracy of the last N completed sessions, oldest→newest (for the trend chart). */
  async recentAccuracy(limit = 7): Promise<number[]> {
    const res = await getDb().execute(
      `SELECT score FROM sessions WHERE status = 'completed'
       ORDER BY completed_at DESC LIMIT ?;`,
      [limit],
    );
    const scores = res.rows.map(r => (r as {score: number}).score ?? 0);
    return scores.reverse();
  },
};
