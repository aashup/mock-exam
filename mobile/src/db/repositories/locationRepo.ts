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
    const db = await getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO locations (
        latitude, longitude, accuracy, altitude, speed, heading,
        recorded_at, location_source, battery_level, is_dirty, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        data.latitude,
        data.longitude,
        data.accuracy,
        data.altitude ?? null,
        data.speed ?? null,
        data.heading ?? null,
        data.recordedAt,
        data.locationSource,
        data.batteryLevel ?? null,
        now,
      ],
    );
  },

  async getAllDirty(): Promise<LocationRecord[]> {
    const db = await getDb();
    return db.getAllAsync<LocationRecord>(
      `SELECT id, server_id, latitude, longitude, accuracy, altitude, speed,
              heading, recorded_at, location_source, battery_level, updated_at
       FROM locations WHERE is_dirty = 1 ORDER BY recorded_at ASC`,
    );
  },

  async markSynced(localIds: number[]): Promise<void> {
    if (localIds.length === 0) return;
    const db = await getDb();
    const placeholders = localIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE locations SET is_dirty = 0 WHERE id IN (${placeholders})`,
      localIds,
    );
  },

  async getRecentLocations(minutes = 60): Promise<LocationRecord[]> {
    const db = await getDb();
    return db.getAllAsync<LocationRecord>(
      `SELECT id, server_id, latitude, longitude, accuracy, altitude, speed,
              heading, recorded_at, location_source, battery_level, updated_at
       FROM locations
       WHERE recorded_at > datetime('now', '-' || ? || ' minutes')
       ORDER BY recorded_at DESC`,
      [minutes],
    );
  },

  async getPendingSyncCount(): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{count: number}>(
      `SELECT COUNT(*) as count FROM locations WHERE is_dirty = 1`,
    );
    return row?.count ?? 0;
  },
};
