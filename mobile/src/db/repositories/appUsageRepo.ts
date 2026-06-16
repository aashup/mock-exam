import {getDb} from '../database';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const appUsageRepo = {
  async addSeconds(seconds: number): Promise<void> {
    if (seconds <= 0) return;
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO app_usage (date, seconds_active, is_dirty, updated_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(date) DO UPDATE SET
         seconds_active = seconds_active + excluded.seconds_active,
         is_dirty = 1,
         updated_at = datetime('now');`,
      [today(), Math.round(seconds)],
    );
  },

  async totalSeconds(): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{total: number}>(
      'SELECT COALESCE(SUM(seconds_active), 0) AS total FROM app_usage;',
    );
    return row?.total ?? 0;
  },
};
