import {useEffect, useRef, useState} from 'react';
import {LocationService} from '@/services/LocationService';
import {useSettingsStore} from '@/store/settingsStore';
import {locationRepo} from '@/db/repositories/locationRepo';

export function useLocationTracking() {
  const {locationTrackingEnabled} = useSettingsStore();
  const [isTracking, setIsTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  // Track whether this is the first render — we never auto-prompt on mount.
  const isMounted = useRef(false);

  useEffect(() => {
    initializeTracking();
  }, []);

  useEffect(() => {
    // Skip on initial mount — only react to explicit user-driven changes.
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    updateTrackingState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationTrackingEnabled]);

  useEffect(() => {
    const interval = setInterval(updatePendingCount, 3000);
    return () => clearInterval(interval);
  }, []);

  const initializeTracking = async () => {
    try {
      // Only initialize the SDK — do NOT request permissions here.
      await LocationService.initialize();
      const {enabled} = await LocationService.getStatus();
      setIsTracking(enabled);
      updatePendingCount();
    } catch (error) {
      console.error('Failed to initialize location tracking:', error);
    }
  };

  const updateTrackingState = async () => {
    if (!locationTrackingEnabled) {
      await LocationService.stop();
      setIsTracking(false);
      setPermissionDenied(false);
      return;
    }

    // User explicitly enabled tracking — safe to ask for permission now.
    const hasPermission = await LocationService.requestPermissions();
    if (!hasPermission) {
      setPermissionDenied(true);
      await LocationService.stop();
      setIsTracking(false);
      return;
    }

    await LocationService.start();
    setIsTracking(true);
    setPermissionDenied(false);
  };

  const updatePendingCount = async () => {
    try {
      const count = await locationRepo.getPendingSyncCount();
      setPendingSyncCount(count);
    } catch (error) {
      console.error('Failed to get pending sync count:', error);
    }
  };

  const enable = async () => {
    const hasPermission = await LocationService.requestPermissions();
    if (!hasPermission) {
      setPermissionDenied(true);
      return;
    }
    await LocationService.start();
    setIsTracking(true);
    setPermissionDenied(false);
  };

  const disable = async () => {
    await LocationService.stop();
    setIsTracking(false);
  };

  return {
    enabled: locationTrackingEnabled,
    isTracking,
    permissionDenied,
    pendingSyncCount,
    enable,
    disable,
  };
}
