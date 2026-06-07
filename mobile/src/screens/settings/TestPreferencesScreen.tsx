import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Divider, List, SegmentedButtons, Switch, Text, TextInput} from 'react-native-paper';
import type {Difficulty, FeedbackMode, TestMode} from '@/types/models';
import {useSettingsStore} from '@/store/settingsStore';

/** Editable defaults applied to each new test. Writes straight through to the
 *  settings store via update(). API keys are NOT handled here — they live only
 *  in the secure Keychain. */
export default function TestPreferencesScreen() {
  const settings = useSettingsStore();
  const {update} = settings;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="titleMedium" style={styles.label}>
        Questions per session
      </Text>
      <SegmentedButtons
        value={[5, 10, 20].includes(settings.questionsPerSession)
          ? String(settings.questionsPerSession)
          : 'custom'}
        onValueChange={v => {
          if (v !== 'custom') {
            update({questionsPerSession: parseInt(v, 10)});
          }
        }}
        buttons={[
          {value: '5', label: '5'},
          {value: '10', label: '10'},
          {value: '20', label: '20'},
          {value: 'custom', label: 'Custom'},
        ]}
      />
      <TextInput
        value={String(settings.questionsPerSession)}
        onChangeText={t => update({questionsPerSession: Math.max(1, parseInt(t, 10) || 1)})}
        keyboardType="number-pad"
        mode="outlined"
        dense
        style={styles.input}
      />

      <Text variant="titleMedium" style={styles.label}>
        Default difficulty
      </Text>
      <SegmentedButtons
        value={settings.defaultDifficulty}
        onValueChange={v => update({defaultDifficulty: v as Difficulty})}
        buttons={[
          {value: 'Easy', label: 'Easy'},
          {value: 'Medium', label: 'Medium'},
          {value: 'Hard', label: 'Hard'},
        ]}
      />

      <Text variant="titleMedium" style={styles.label}>
        Feedback mode
      </Text>
      <SegmentedButtons
        value={settings.feedbackMode}
        onValueChange={v => update({feedbackMode: v as FeedbackMode})}
        buttons={[
          {value: 'immediate', label: 'After each'},
          {value: 'end', label: 'At the end'},
        ]}
      />

      <Text variant="titleMedium" style={styles.label}>
        Test mode
      </Text>
      <SegmentedButtons
        value={settings.testMode}
        onValueChange={v => update({testMode: v as TestMode})}
        buttons={[
          {value: 'untimed', label: 'Untimed'},
          {value: 'timed', label: 'Timed'},
        ]}
      />

      {settings.testMode === 'timed' && (
        <>
          <Text variant="titleMedium" style={styles.label}>
            Default timer (minutes)
          </Text>
          <TextInput
            value={String(settings.defaultTimerMinutes)}
            onChangeText={t =>
              update({defaultTimerMinutes: Math.max(1, parseInt(t, 10) || 1)})
            }
            keyboardType="number-pad"
            mode="outlined"
            dense
            style={styles.input}
          />
        </>
      )}

      <Divider style={styles.divider} />

      <List.Item
        title="Auto-sync"
        description={`Sync every ${settings.syncIntervalMinutes} min`}
        right={() => (
          <Switch
            value={settings.autoSync}
            onValueChange={v => update({autoSync: v})}
          />
        )}
      />

      {settings.autoSync && (
        <View>
          <Text variant="titleMedium" style={styles.label}>
            Sync interval (minutes)
          </Text>
          <TextInput
            value={String(settings.syncIntervalMinutes)}
            onChangeText={t =>
              update({syncIntervalMinutes: Math.max(5, parseInt(t, 10) || 30)})
            }
            keyboardType="number-pad"
            mode="outlined"
            dense
            style={styles.input}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, paddingBottom: 40},
  label: {marginTop: 16, marginBottom: 8, fontWeight: '600'},
  input: {marginTop: 8},
  divider: {marginVertical: 16},
});
