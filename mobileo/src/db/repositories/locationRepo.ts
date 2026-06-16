import {getDb} from '../database';

export interface LocationRecord {
  id: number;
  server_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  recorded_at: string;
  location_source: 'gps' | 'network' | 'fused';
  battery_level?: number;
  updated_at: string;
}

export const locationRepo = {
  async recordLocation(data: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    recordedAt: string;
    locationSource: 'gps' | 'network' | 'fused';
    batteryLevel?: number;
  }): Promise<void> {
    const now = new Date().toISOString();
    await getDb().execute(
      `INSERT INTO locations (
        latitude, longitude, accuracy, altitude, speed, heading,
        recorded_at, location_source, battery_level, is_dirty, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        data.latitude,
        data.longitude,
        data.accuracy,
        data.altitude || null,
        data.speed || null,
        data.heading || null,
        data.recordedAt,
        data.locationSource,
        data.batteryLevel || null,
        now,
      ],
    );
  },

  async getAllDirty(): Promise<LocationRecord[]> {
    const res = await getDb().execute(
      `SELECT id, server_id, latitude, longitude, accuracy, altitude, speed,
              heading, recorded_at, location_source, battery_level, updated_at
       FROM locations WHERE is_dirty = 1 ORDER BY recorded_at ASC`,
    );
    return res.rows as unknown as LocationRecord[];
  },

  async markSynced(localIds: number[]): Promise<void> {
    if (localIds.length === 0) return;
    const placeholders = localIds.map(() => '?').join(',');
    await getDb().execute(
      `UPDATE locations SET is_dirty = 0 WHERE id IN (${placeholders})`,
      localIds,
    );
  },

  async getRecentLocations(minutes: number = 60): Promise<LocationRecord[]> {
    const res = await getDb().execute(
      `SELECT id, server_id, latitude, longitude, accuracy, altitude, speed,
              heading, recorded_at, location_source, battery_level, updated_at
       FROM locations
       WHERE recorded_at > datetime('now', '-' || ? || ' minutes')
       ORDER BY recorded_at DESC`,
      [minutes],
    );
    return res.rows as unknown as LocationRecord[];
  },

  async getPendingSyncCount(): Promise<number> {
    const res = await getDb().execute(
      `SELECT COUNT(*) as count FROM locations WHERE is_dirty = 1`,
    );
    return (res.rows[0] as any)?.count || 0;
  },
};
