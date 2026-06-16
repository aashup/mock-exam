import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {appUsageRepo} from '@/db/repositories/appUsageRepo';

/**
 * Tracks time-on-app. Starts counting when the app is foregrounded and flushes
 * the elapsed seconds to today's app_usage row when it is backgrounded.
 * Mount this once near the app root.
 */
export function useAppUsageTracker(): void {
  const activeSince = useRef<number | null>(Date.now());

  useEffect(() => {
    const flush = () => {
      if (activeSince.current != null) {
        const elapsed = (Date.now() - activeSince.current) / 1000;
        void appUsageRepo.addSeconds(elapsed);
        activeSince.current = null;
      }
    };

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        activeSince.current = Date.now();
      } else {
        flush();
      }
    });

    return () => {
      flush();
      sub.remove();
    };
  }, []);
}
