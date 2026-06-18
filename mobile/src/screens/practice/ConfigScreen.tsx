import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Button, HelperText, SegmentedButtons, Text, TextInput} from 'react-native-paper';
import type {Difficulty, FeedbackMode, TestLanguage, TestMode} from '@/types/models';
import {AIService, MissingApiKeyError, OfflineError} from '@/services/ai/AIService';
import {questionRepo} from '@/db/repositories/questionRepo';
import {sessionRepo} from '@/db/repositories/sessionRepo';
import {useNetworkStatus} from '@/hooks/useNetworkStatus';
import {useSettingsStore} from '@/store/settingsStore';

/** Step 3: configure the session, then generate (or reuse) and start. */
export default function ConfigScreen() {
  const navigation = useNavigation<any>();
  const {params} = useRoute<any>();
  const settings = useSettingsStore();
  const online = useNetworkStatus();

  const [count, setCount] = useState(String(settings.questionsPerSession));
  const [language, setLanguage] = useState<TestLanguage>('hi');
  const [difficulty, setDifficulty] = useState<Difficulty>(settings.defaultDifficulty);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>(settings.feedbackMode);
  const [mode, setMode] = useState<TestMode>(settings.testMode);
  const [timerMinutes, setTimerMinutes] = useState(String(settings.defaultTimerMinutes));
  const [loading, setLoading] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = async (
    setId: number,
    totalQuestions: number,
    limit?: number,
    isOffline?: boolean,
  ) => {
    const duration = mode === 'timed' ? parseInt(timerMinutes, 10) * 60 : null;
    const sessionId = await sessionRepo.create({
      setId,
      mode,
      feedbackMode,
      totalQuestions,
      durationSeconds: duration,
      isOffline,
    });
    navigation.navigate('ExamPlayer', {sessionId, setId, limit});
  };

  const onStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const n = Math.max(1, parseInt(count, 10) || 10);

      // Reuse an existing matching set if available (avoids an AI call).
      const reusable = await questionRepo.findReusableSet(params.subjectId, difficulty, language);
      if (reusable) {
        await startSession(reusable.id, reusable.total_questions);
        return;
      }

      const setId = await AIService.generateAndStore({
        subjectId: params.subjectId,
        subjectName: params.subjectName,
        courseId: params.courseId,
        courseName: params.courseName,
        difficulty,
        count: n,
        language,
      });
      await startSession(setId, n);
    } catch (e: any) {
      if (e instanceof OfflineError) {
        setError(
          "You're offline. Generating new questions needs internet — reuse a stored set from the Question Library to practice offline.",
        );
      } else if (e instanceof MissingApiKeyError) {
        setError('No AI API key set. Add one under Profile → AI Configuration.');
      } else {
        setError(e?.message ?? 'Could not generate questions.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Offline Test — runs entirely from the local question bank (no AI / no
   * internet). Picks the best stored set for this subject and starts a session
   * over its first N questions.
   */
  const onStartOffline = async () => {
    setOfflineLoading(true);
    setError(null);
    try {
      const n = Math.max(1, parseInt(count, 10) || 10);
      const localSet = await questionRepo.bestLocalSet(params.subjectId, difficulty, params.courseId);
      if (!localSet) {
        setError(
          'No questions are stored on this device for this subject yet. Generate a set once while online — it is then saved for offline practice.',
        );
        return;
      }
      const limit = Math.min(n, localSet.total_questions);
      await startSession(localSet.id, limit, limit, true);
    } catch (e: any) {
      setError(e?.message ?? 'Could not start the offline test.');
    } finally {
      setOfflineLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="titleMedium" style={styles.label}>
        Number of questions
      </Text>
      <TextInput
        value={count}
        onChangeText={setCount}
        keyboardType="number-pad"
        mode="outlined"
        style={styles.input}
      />

      <Text variant="titleMedium" style={styles.label}>
        Language
      </Text>
      <SegmentedButtons
        value={language}
        onValueChange={v => setLanguage(v as TestLanguage)}
        buttons={[
          {value: 'en', label: 'English', icon: 'alphabetical'},
          {value: 'hi', label: 'हिन्दी', icon: 'translate'},
        ]}
      />

      <Text variant="titleMedium" style={styles.label}>
        Difficulty
      </Text>
      <SegmentedButtons
        value={difficulty}
        onValueChange={v => setDifficulty(v as Difficulty)}
        buttons={[
          {value: 'Easy', label: 'Easy'},
          {value: 'Medium', label: 'Medium'},
          {value: 'Hard', label: 'Hard'},
        ]}
      />

      <Text variant="titleMedium" style={styles.label}>
        Feedback
      </Text>
      <SegmentedButtons
        value={feedbackMode}
        onValueChange={v => setFeedbackMode(v as FeedbackMode)}
        buttons={[
          {value: 'immediate', label: 'After each'},
          {value: 'end', label: 'At the end'},
        ]}
      />

      <Text variant="titleMedium" style={styles.label}>
        Mode
      </Text>
      <SegmentedButtons
        value={mode}
        onValueChange={v => setMode(v as TestMode)}
        buttons={[
          {value: 'untimed', label: 'Untimed'},
          {value: 'timed', label: 'Timed'},
        ]}
      />

      {mode === 'timed' && (
        <View>
          <Text variant="titleMedium" style={styles.label}>
            Timer (minutes)
          </Text>
          <TextInput
            value={timerMinutes}
            onChangeText={setTimerMinutes}
            keyboardType="number-pad"
            mode="outlined"
            style={styles.input}
          />
        </View>
      )}

      {error && <HelperText type="error">{error}</HelperText>}

      {!online && (
        <HelperText type="info">
          Offline — new questions can't be generated. A matching stored set will
          be reused if one exists.
        </HelperText>
      )}

      <Button
        mode="contained"
        onPress={onStartOffline}
        loading={loading}
        disabled={loading || offlineLoading}
        style={styles.start}
        icon="play">
        Start Test
      </Button>

      {/* <Button
        mode="outlined"
        onPress={onStart}
        loading={offlineLoading}
        disabled={loading || offlineLoading}
        style={styles.offline}
        icon="cloud-outline">
        Online Test
      </Button> */}
      {/* <HelperText type="info">
        Uses the top {count || '?'} questions already stored on this device — no
        internet needed.
      </HelperText> */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, paddingBottom: 40},
  label: {marginTop: 16, marginBottom: 8, fontWeight: '600'},
  input: {marginBottom: 4},
  start: {marginTop: 28, borderRadius: 12, paddingVertical: 4},
  offline: {marginTop: 12, borderRadius: 12, paddingVertical: 4},
});
