import {getDb} from '../database';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Tracks time-on-app, aggregated per calendar day. */
export const appUsageRepo = {
  /** Adds elapsed foreground seconds to today's row (upsert by date). */
  async addSeconds(seconds: number): Promise<void> {
    if (seconds <= 0) {
      return;
    }
    await getDb().execute(
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
    const res = await getDb().execute(
      'SELECT COALESCE(SUM(seconds_active), 0) AS total FROM app_usage;',
    );
    return (res.rows[0]?.total as number) ?? 0;
  },
};
