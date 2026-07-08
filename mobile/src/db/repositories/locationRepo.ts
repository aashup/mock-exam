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
    try {
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
    } catch (error) {
      console.error('Error recording location:', error);
      throw error;
    }
  },

  async getAllDirty(): Promise<LocationRecord[]> {
    try {
      const db = await getDb();
      return db.getAllAsync<LocationRecord>(
        `SELECT id, server_id, latitude, longitude, accuracy, altitude, speed,
                heading, recorded_at, location_source, battery_level, updated_at
         FROM locations WHERE is_dirty = 1 ORDER BY recorded_at ASC`,
      );
    } catch (error) {
      console.error('Error getting dirty locations:', error);
      return [];
    }
  },

  async markSynced(localIds: number[]): Promise<void> {
    try {
      if (localIds.length === 0) return;
      const db = await getDb();
      const placeholders = localIds.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE locations SET is_dirty = 0 WHERE id IN (${placeholders})`,
        localIds,
      );
    } catch (error) {
      console.error('Error marking locations as synced:', error);
    }
  },

  async getRecentLocations(minutes = 60): Promise<LocationRecord[]> {
    try {
      const db = await getDb();
      return db.getAllAsync<LocationRecord>(
        `SELECT id, server_id, latitude, longitude, accuracy, altitude, speed,
                heading, recorded_at, location_source, battery_level, updated_at
         FROM locations
         WHERE recorded_at > datetime('now', '-${minutes} minutes')
         ORDER BY recorded_at DESC`,
        [minutes],
      );
    } catch (error) {
      console.error('Error getting recent locations:', error);
      return [];
    }
  },

  async getPendingSyncCount(): Promise<number> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) as count FROM locations WHERE is_dirty = 1`,
      );
      return row?.count ?? 0;
    } catch (error) {
      console.error('Database error in getPendingSyncCount:', error);
      // Return 0 instead of crashing to prevent app from breaking
      return 0;
    }
  },
};
