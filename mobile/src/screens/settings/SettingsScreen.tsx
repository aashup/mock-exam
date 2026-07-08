import React, {useRef, useState} from 'react';
import {Alert, Linking, ScrollView, StyleSheet, TouchableWithoutFeedback, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, Divider, List, SegmentedButtons, Snackbar, Switch} from 'react-native-paper';
import {useAuthStore} from '@/store/authStore';
import {useSettingsStore, type ThemeMode} from '@/store/settingsStore';
import {useLocationTracking} from '@/hooks/useLocationTracking';
import {SyncService} from '@/services/SyncService';
import {isOnline} from '@/hooks/useNetworkStatus';
import {getDeviceId} from '@/utils/device';
import {wipeDatabase} from '@/db/database';

/** Profile / settings hub. Hosts appearance + test preferences. */
export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const logout = useAuthStore(s => s.logout);
  const user = useAuthStore(s => s.user);
  const settings = useSettingsStore();
  const setThemeMode = useSettingsStore(s => s.setThemeMode);

  const {isTracking, permissionDenied, pendingSyncCount, enable, disable} = useLocationTracking();

  const [syncing, setSyncing] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const onSyncNow = async () => {
    setSyncing(true);
    try {
      if (!(await isOnline())) {
        setSnack("You're offline — connect to the internet to sync.");
        return;
      }
      const deviceId = await getDeviceId();
      await SyncService.run(deviceId);
      setSnack('Sync complete.');
    } catch (e: any) {
      setSnack(e?.message ? 'Sync failed: ' + e.message : 'Sync failed. Try again.');
    } finally {
      setSyncing(false);
    }
  };

  const onReset = async () => {
    setSyncing(true);
    try {
      if (!(await isOnline())) {
        setSnack("You're offline — connect to the internet to reset.");
        return;
      }
      
      // Wipe local database
      await wipeDatabase();
      
      // Pull fresh data from server
      await SyncService.pull();
      
      setSnack('Database reset complete. Fresh data pulled from server.');
    } catch (e: any) {
      setSnack(e?.message ? 'Reset failed: ' + e.message : 'Reset failed. Try again.');
    } finally {
      setSyncing(false);
    }
  };

  // Refs to keep track of taps and the timer without causing re-renders
  const tapCount = useRef(0);
  const tapTimer = useRef<NodeJS.Timeout | number>(0);

  const handleSecretTap = () => {
    tapCount.current += 1;

    // Clear the previous timeout so the count doesn't reset if they keep tapping
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }

    if (tapCount.current >= 3) {
      // 3 taps reached! Reset the counter and navigate.
      tapCount.current = 0;
      navigation.navigate('LocationDetails');
    } else {
      // If less than 3 taps, set a timer to reset the count after 500ms of inactivity
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
      }, 500); 
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <List.Section>
        <List.Subheader>Account</List.Subheader>
        <List.Item title={user?.name ?? 'Guest'} description={user?.email ?? ''} />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <View style={styles.themeRow}>
          <SegmentedButtons
            value={settings.themeMode}
            onValueChange={v => setThemeMode(v as ThemeMode)}
            buttons={[
              {value: 'light', label: 'Light', icon: 'white-balance-sunny'},
              {value: 'dark', label: 'Dark', icon: 'weather-night'},
              {value: 'system', label: 'System', icon: 'cellphone'},
            ]}
          />
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Performance</List.Subheader>
        <List.Item
          title="Analytics"
          description="Accuracy, per-subject breakdown, streak"
          left={p => <List.Icon {...p} icon="chart-bar" />}
          right={p => <List.Icon {...p} icon="chevron-right" />}
          onPress={() => navigation.navigate('Analytics')}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Test Preferences</List.Subheader>
        <List.Item
          title="Test preferences"
          description={`${settings.questionsPerSession} questions · ${settings.defaultDifficulty} · ${
            settings.autoSync ? `auto-sync every ${settings.syncIntervalMinutes} min` : 'auto-sync off'
          }`}
          left={p => <List.Icon {...p} icon="tune" />}
          right={p => <List.Icon {...p} icon="chevron-right" />}
          onPress={() => navigation.navigate('TestPreferences')}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <TouchableWithoutFeedback onPress={handleSecretTap}>
          <View>
            <List.Subheader>Location Tracking</List.Subheader>
          </View>
        </TouchableWithoutFeedback>
        <List.Item
          title="Track my location"
          description={
            permissionDenied
              ? 'Permission denied — tap to open Settings'
              : isTracking
              ? 'Active · ' + pendingSyncCount + ' record' + (pendingSyncCount !== 1 ? 's' : '') + ' pending sync'
              : 'Location tracking is off'
          }
          left={p => <List.Icon {...p} icon="map-marker" />}
          right={() => (
            <Switch
              value={isTracking}
              onValueChange={on => {
                if (on) {
                  void enable();
                } else {
                  void disable();
                }
              }}
            />
          )}
          onPress={() => {
            if (permissionDenied) {
              Alert.alert(
                'Location Permission Required',
                'Open Settings → Location → Allow all the time to enable background tracking.',
                [
                  {text: 'Cancel', style: 'cancel'},
                  {text: 'Open Settings', onPress: () => void Linking.openSettings()},
                ],
              );
            }
          }}
        />
        {permissionDenied && (
          <List.Item
            title="Permission required"
            description="Go to Settings → Apps → ExamApp → Permissions → Location → Allow all the time"
            titleStyle={{color: '#ef4444', fontSize: 13}}
            descriptionStyle={{fontSize: 12}}
            left={p => <List.Icon {...p} icon="alert-circle" color="#ef4444" />}
          />
        )}
      </List.Section>

      <Divider />

      {/* --- ADDED SCAN PAPER SECTION --- */}
      <List.Section>
        <List.Subheader>Tools</List.Subheader>
        <List.Item
          title="Scan Paper"
          description="Extract text from physical documents using AI OCR"
          left={p => <List.Icon {...p} icon="camera-document" />}
          right={p => <List.Icon {...p} icon="chevron-right" />}
          onPress={() => navigation.navigate('ScanPaper')}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Sync</List.Subheader>
        <List.Item
          title="Sync now"
          description="Upload your progress and pull the latest data"
          left={p => <List.Icon {...p} icon="cloud-sync" />}
        />
        <View style={styles.syncRow}>
          <Button
            mode="contained"
            icon="cloud-upload"
            onPress={onSyncNow}
            loading={syncing}
            disabled={syncing}>
            Sync now
          </Button>
        </View>
        <View style={styles.syncRow}>
          <Button
            mode="outlined"
            icon="refresh"
            onPress={onReset}
            loading={syncing}
            disabled={syncing}>
            Reset
          </Button>
        </View>
      </List.Section>

      <Button mode="outlined" style={styles.logout} onPress={() => logout()}>
        Log Out
      </Button>

      <Snackbar
        visible={snack != null}
        onDismiss={() => setSnack(null)}
        duration={3000}>
        {snack ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {paddingBottom: 40},
  themeRow: {paddingHorizontal: 16, paddingTop: 4},
  syncRow: {paddingHorizontal: 16, paddingTop: 4},
  logout: {margin: 16, borderRadius: 10},
});
