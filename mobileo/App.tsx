import React, {useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PaperProvider} from 'react-native-paper';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {initDatabase} from '@/db/database';
import {KeychainService} from '@/services/ai/KeychainService';
import {useAuthStore} from '@/store/authStore';
import {useSettingsStore} from '@/store/settingsStore';
import {useAppUsageTracker} from '@/hooks/useAppUsageTracker';
import {useAutoSync} from '@/hooks/useAutoSync';
import {useLocationTracking} from '@/hooks/useLocationTracking';
import {useAppTheme} from '@/theme/useAppTheme';
import RootNavigator from '@/navigation/RootNavigator';

const queryClient = new QueryClient();

export default function App() {
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore(s => s.hydrate);
  const hydrateTheme = useSettingsStore(s => s.hydrateTheme);
  const hydrateLocationSettings = useSettingsStore(s => s.hydrateLocationSettings);
  const {paperTheme, navTheme} = useAppTheme();

  // Time-on-app tracking + periodic background sync + location tracking.
  useAppUsageTracker();
  useAutoSync();
  useLocationTracking();

  useEffect(() => {
    (async () => {
      await initDatabase();
      await Promise.all([hydrate(), hydrateTheme(), hydrateLocationSettings(), KeychainService.seedDevKeys()]);
      setReady(true);
    })();
  }, [hydrate, hydrateTheme, hydrateLocationSettings]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: paperTheme.colors.background,
        }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <RootNavigator navTheme={navTheme} />
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
