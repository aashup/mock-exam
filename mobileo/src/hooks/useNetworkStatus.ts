import {useEffect, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * React hook returning the current connectivity state. Starts optimistic
 * (true) and updates on every NetInfo change event.
 */
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state =>
      setIsOnline(!!state.isConnected),
    );
    return unsubscribe;
  }, []);
  return isOnline;
}

/** One-shot connectivity check for non-React call sites (services). */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
}
