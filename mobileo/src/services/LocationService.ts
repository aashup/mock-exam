import BackgroundGeolocation from 'react-native-background-geolocation';
import {locationRepo} from '@/db/repositories/locationRepo';
import {useSettingsStore} from '@/store/settingsStore';
import {SyncService} from './SyncService';
import {getDeviceId} from '@/utils/device';
import {isOnline} from '@/hooks/useNetworkStatus';

interface LocationConfig {
  interval: number;
  accuracy: 'high' | 'balanced' | 'low';
  enabled: boolean;
}

let isInitialized = false;

export const LocationService = {
  async initialize(): Promise<void> {
    if (isInitialized) return;

    try {
      const config = getLocationConfig();

      const intervalMs = config.interval * 60 * 1000;
      await BackgroundGeolocation.ready({
        desiredAccuracy: getDesiredAccuracy(config.accuracy) as any,
        distanceFilter: 0,          // record every interval regardless of movement
        stopOnTerminate: false,
        startOnBoot: true,
        locationUpdateInterval: intervalMs,
        fastestLocationUpdateInterval: intervalMs,
        activityRecognitionInterval: 10000,
        foregroundService: true,
        // Use the notification object (notificationTitle/Text are deprecated in v4)
        notification: {
          title: 'Location Tracking Active',
          text: 'Tracking your location for study analytics',
          channelName: 'location-tracking',
        },
        allowIdenticalLocations: false,
        maxRecordsToPersist: 500,
        locationsOrderDirection: 'DESC',
        geofenceInitialTriggerEntry: true,
        debug: false,
        logLevel: BackgroundGeolocation.LOG_LEVEL_INFO,
      });

      // onLocation(successFn, errorFn) — there is no standalone onError in v4
      BackgroundGeolocation.onLocation(onLocationReceived, onLocationError);

      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize LocationService:', error);
    }
  },

  async requestPermissions(): Promise<boolean> {
    try {
      // ready() must be called before requestPermission() — initialize if needed.
      await LocationService.initialize();
      const status = await BackgroundGeolocation.requestPermission();
      return status === BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS ||
             status === BackgroundGeolocation.AUTHORIZATION_STATUS_WHEN_IN_USE;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  },

  async start(): Promise<void> {
    try {
      await LocationService.initialize();
      const isRunning = await BackgroundGeolocation.getState();
      if (!isRunning?.enabled) {
        await BackgroundGeolocation.start();
      }
    } catch (error) {
      console.error('Failed to start location tracking:', error);
    }
  },

  async stop(): Promise<void> {
    try {
      const isRunning = await BackgroundGeolocation.getState();
      if (isRunning?.enabled) {
        await BackgroundGeolocation.stop();
      }
    } catch (error) {
      console.error('Failed to stop location tracking:', error);
    }
  },

  async getStatus(): Promise<{enabled: boolean; isTracking: boolean}> {
    try {
      const state = await BackgroundGeolocation.getState();
      return {
        enabled: state?.enabled || false,
        isTracking: state?.enabled || false,
      };
    } catch {
      return {enabled: false, isTracking: false};
    }
  },

  async updateConfig(config: Partial<LocationConfig>): Promise<void> {
    try {
      await LocationService.initialize();

      const updatePayload: Record<string, any> = {};
      if (config.accuracy) {
        updatePayload.desiredAccuracy = getDesiredAccuracy(config.accuracy);
        updatePayload.distanceFilter = getDistanceFilter(config.accuracy);
      }
      if (config.interval) {
        const intervalMs = config.interval * 60 * 1000;
        updatePayload.locationUpdateInterval = intervalMs;
        updatePayload.fastestLocationUpdateInterval = intervalMs;
      }

      if (Object.keys(updatePayload).length > 0) {
        await BackgroundGeolocation.setConfig(updatePayload);
      }
    } catch (error) {
      console.error('Failed to update location config:', error);
    }
  },
};

function getLocationConfig(): LocationConfig {
  const settings = useSettingsStore.getState();
  return {
    interval: settings.locationTrackingInterval || 15,
    accuracy: settings.locationAccuracy || 'balanced',
    enabled: settings.locationTrackingEnabled || false,
  };
}

function getDesiredAccuracy(accuracy: 'high' | 'balanced' | 'low'): number {
  switch (accuracy) {
    case 'high':
      return BackgroundGeolocation.DESIRED_ACCURACY_HIGH;
    case 'balanced':
      return BackgroundGeolocation.DESIRED_ACCURACY_MEDIUM;
    case 'low':
      return BackgroundGeolocation.DESIRED_ACCURACY_LOW;
    default:
      return BackgroundGeolocation.DESIRED_ACCURACY_MEDIUM;
  }
}

function getDistanceFilter(accuracy: 'high' | 'balanced' | 'low'): number {
  switch (accuracy) {
    case 'high':
      return 10;
    case 'balanced':
      return 50;
    case 'low':
      return 100;
    default:
      return 50;
  }
}

async function onLocationReceived(location: any): Promise<void> {
  try {
    // v4 shape: { coords: { latitude, longitude, accuracy, altitude, speed, heading }, timestamp, extras, battery }
    const coords = location.coords ?? location;
    const {latitude, longitude, accuracy, altitude, speed, heading} = coords;
    const timestamp: string = location.timestamp;
    // In react-native-background-geolocation v4, `location.provider` is an
    // OBJECT ({ gps, network, enabled, status }), not a string. `extras.provider`
    // (if set by us) is a string. Pass the raw value through and let
    // getLocationSource normalise both shapes.
    const provider: unknown = location.extras?.provider ?? location.provider;

    if (!validateLocation(latitude, longitude, accuracy)) {
      return;
    }

    const recordedAt = new Date(timestamp).toISOString();
    const locationSource = getLocationSource(provider);

    await locationRepo.recordLocation({
      latitude,
      longitude,
      accuracy,
      altitude: altitude || undefined,
      speed: speed || undefined,
      heading: heading || undefined,
      recordedAt,
      locationSource,
      batteryLevel: (location.battery?.level as number) || undefined,
    });

    const pendingCount = await locationRepo.getPendingSyncCount();
    if (pendingCount >= 50 && (await isOnline())) {
      const deviceId = await getDeviceId();
      await SyncService.push(deviceId);
    }
  } catch (error) {
    console.error('Error processing location:', error);
  }
}

function onLocationError(error: any): void {
  console.warn('Location error:', error);
}

function validateLocation(latitude: number, longitude: number, accuracy: number): boolean {
  if (!isFinite(latitude) || !isFinite(longitude) || !isFinite(accuracy)) {
    return false;
  }
  if (accuracy > 5000) {
    return false;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }
  return true;
}

function getLocationSource(provider: unknown): 'gps' | 'network' | 'fused' {
  if (!provider) return 'fused';

  // v4 object shape: { gps: boolean, network: boolean, ... }
  if (typeof provider === 'object') {
    const p = provider as {gps?: boolean; network?: boolean};
    if (p.gps) return 'gps';
    if (p.network) return 'network';
    return 'fused';
  }

  // Legacy/string shape (e.g. 'gps', 'network', 'fused', 'wifi').
  if (typeof provider === 'string') {
    const lowerProvider = provider.toLowerCase();
    if (lowerProvider.includes('gps')) return 'gps';
    if (lowerProvider.includes('network') || lowerProvider.includes('wifi')) return 'network';
  }

  return 'fused';
}
