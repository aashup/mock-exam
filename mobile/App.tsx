import React, {useEffect, useState} from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider as PaperProvider} from 'react-native-paper';

import {initDatabase} from '@/db/database';
import {useAuthStore} from '@/store/authStore';
import {useSettingsStore} from '@/store/settingsStore';
import {KeychainService} from '@/services/ai/KeychainService';
import {useAppTheme} from '@/theme/useAppTheme';
import {useAutoSync} from '@/hooks/useAutoSync';
import {useAppUsageTracker} from '@/hooks/useAppUsageTracker';
import RootNavigator from '@/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {queries: {retry: 1, staleTime: 60_000}},
});

function AppInner() {
  useAutoSync();
  useAppUsageTracker();
  const {paperTheme, navTheme} = useAppTheme();
  return (
    <PaperProvider theme={paperTheme}>
      <RootNavigator navTheme={navTheme} />
    </PaperProvider>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore(s => s.hydrate);
  const hydrateTheme = useSettingsStore(s => s.hydrateTheme);
  const hydrateLocationSettings = useSettingsStore(s => s.hydrateLocationSettings);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await Promise.all([hydrate(), hydrateTheme(), hydrateLocationSettings()]);
        await KeychainService.seedDevKeys();
      } catch (e) {
        console.error('[App] bootstrap error', e);
      } finally {
        setReady(true);
      }
    })();
  }, [hydrate, hydrateTheme, hydrateLocationSettings]);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
