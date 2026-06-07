import {useEffect} from 'react';
import {AppState} from 'react-native';
import {SyncService} from '@/services/SyncService';
import {isOnline} from '@/hooks/useNetworkStatus';
import {useAuthStore} from '@/store/authStore';
import {useSettingsStore} from '@/store/settingsStore';
import {getDeviceId} from '@/utils/device';

/**
 * Runs the SyncService on an interval (default 30 min) and whenever the app
 * returns to the foreground — but only while authenticated and auto-sync on.
 */
export function useAutoSync(): void {
  const token = useAuthStore(s => s.token);
  const autoSync = useSettingsStore(s => s.autoSync);
  const intervalMin = useSettingsStore(s => s.syncIntervalMinutes);

  useEffect(() => {
    if (!token || !autoSync) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        // Skip the cycle entirely when offline — nothing can be pushed/pulled.
        if (!(await isOnline())) {
          return;
        }
        const deviceId = await getDeviceId();
        await SyncService.run(deviceId);
      } catch {
        // swallow — offline-first; we retry next tick
      }
    };

    void sync(); // sync on mount / login
    const id = setInterval(() => {
      if (!cancelled) {
        void sync();
      }
    }, intervalMin * 60 * 1000);

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void sync();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(id);
      appStateSub.remove();
    };
  }, [token, autoSync, intervalMin]);
}
