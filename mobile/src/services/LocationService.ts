import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {locationRepo} from '@/db/repositories/locationRepo';
import {SyncService} from '@/services/SyncService';
import {isOnline} from '@/hooks/useNetworkStatus';
import {getDeviceId} from '@/utils/device';
import {getDb} from '@/db/database';

const LOCATION_TASK = 'exam-x-location-task';

// ─── Background task ────────────────────────────────────────────────────────
// Must be defined at module top-level (before any React tree mounts) so the
// OS can invoke it even when the app is not in the foreground.
TaskManager.defineTask(
  LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{locations: Location.LocationObject[]}>) => {
    if (error) {
      console.warn('[Location] background task error:', error.message);
      return;
    }
    for (const loc of (data as {locations: Location.LocationObject[]})?.locations ?? []) {
      await processLocation(loc);
    }
  },
);

async function processLocation(location: Location.LocationObject): Promise<void> {
  try {
    const {latitude, longitude, accuracy, altitude, speed, heading} = location.coords;

    // Basic sanity checks (mirrors the old validateLocation helper).
    if (!isFinite(latitude) || !isFinite(longitude)) return;
    if ((accuracy ?? 0) > 5000) return;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

    // expo-location timestamp is epoch milliseconds.
    const recordedAt = new Date(location.timestamp).toISOString();

    await locationRepo.recordLocation({
      latitude,
      longitude,
      accuracy: accuracy ?? 0,
      altitude: altitude ?? undefined,
      speed: speed ?? undefined,
      heading: heading ?? undefined,
      recordedAt,
      // expo-location does not expose a provider object; default to 'fused'.
      locationSource: 'fused',
    });

    // Add safety check before getting pending count
    try {
      const pending = await locationRepo.getPendingSyncCount();
      if (pending >= 50 && (await isOnline())) {
        const deviceId = await getDeviceId();
        await SyncService.push(deviceId);
      }
    } catch (syncError) {
      console.warn('[Location] Sync check failed:', syncError);
    }
  } catch (err) {
    console.error('[Location] processLocation error:', err);
  }
}

// ─── Public service ──────────────────────────────────────────────────────────
export const LocationService = {
  /** No-op — task is registered at module level; kept for API compatibility. */
  async initialize(): Promise<void> {
    // Ensure database is initialized before using location service
    try {
      await getDb(); // This will initialize the database if needed
    } catch (error) {
      console.error('[LocationService] Failed to initialize database:', error);
    }
  },

  async requestPermissions(): Promise<boolean> {
    try {
      const {status: fg} = await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') return false;
      const {status: bg} = await Location.requestBackgroundPermissionsAsync();
      return bg === 'granted';
    } catch (error) {
      console.error('[LocationService] Permission request error:', error);
      return false;
    }
  },

  async start(): Promise<void> {
    try {
      const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(
        () => false,
      );
      if (already) return;

      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60_000, // 1 minute
        distanceInterval: 50, // 50 metres
        foregroundService: {
          notificationTitle: 'Exam X',
          notificationBody: 'Tracking your study location in the background.',
          notificationColor: '#2563EB',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
    } catch (error) {
      console.error('[LocationService] Failed to start location updates:', error);
    }
  },

  async stop(): Promise<void> {
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(
        () => false,
      );
      if (running) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }
    } catch (error) {
      console.error('[LocationService] Failed to stop location updates:', error);
    }
  },

  async getStatus(): Promise<{enabled: boolean}> {
    try {
      const enabled = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(
        () => false,
      );
      return {enabled};
    } catch (error) {
      console.error('[LocationService] Failed to get status:', error);
      return {enabled: false};
    }
  },
};

// Export the function to make sure database is initialized
export async function initializeLocationService(): Promise<void> {
  try {
    await LocationService.initialize();
  } catch (error) {
    console.error('[App] Failed to initialize location service:', error);
  }
}
