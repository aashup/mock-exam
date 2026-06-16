import {getDb} from '../database';
import type {DashboardStats} from '@/types/models';

export const dashboardRepo = {
  async stats(): Promise<DashboardStats> {
    const db = await getDb();

    const counts = await db.getFirstAsync<{
      tests: number;
      attempted: number;
      correct: number;
      wrong: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM sessions WHERE status = 'completed') AS tests,
         (SELECT COUNT(*) FROM attempts) AS attempted,
         (SELECT COUNT(*) FROM attempts WHERE is_correct = 1) AS correct,
         (SELECT COUNT(*) FROM attempts WHERE is_correct = 0) AS wrong;`,
    );

    const usage = await db.getFirstAsync<{seconds: number}>(
      `SELECT COALESCE(SUM(seconds_active), 0) AS seconds FROM app_usage;`,
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

  async streak(): Promise<number> {
    const db = await getDb();
    const days = await db.getAllAsync<{day: string}>(
      `SELECT DISTINCT date(completed_at) AS day
       FROM sessions WHERE status = 'completed'
       ORDER BY day DESC;`,
    );

    let streak = 0;
    const cursor = new Date();
    for (const {day} of days) {
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

  async recentAccuracy(limit = 7): Promise<number[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{score: number}>(
      `SELECT score FROM sessions WHERE status = 'completed'
       ORDER BY completed_at DESC LIMIT ?;`,
      [limit],
    );
    return rows.map(r => r.score ?? 0).reverse();
  },
};
