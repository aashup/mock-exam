import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ActivityIndicator, Button, Card, RadioButton, Text} from 'react-native-paper';
import * as Progress from 'react-native-progress';
import {useExamStore} from '@/store/examStore';
import {questionRepo} from '@/db/repositories/questionRepo';
import {sessionRepo} from '@/db/repositories/sessionRepo';
import {useSettingsStore} from '@/store/settingsStore';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Core exam engine UI: renders the current question, handles answers + timer. */
export default function ExamPlayerScreen() {
  const navigation = useNavigation<any>();
  const {params} = useRoute<any>();
  const feedbackMode = useSettingsStore(s => s.feedbackMode);

  const {
    questions,
    currentIndex,
    answers,
    timeRemaining,
    mode,
    status,
    start,
    saveAnswer,
    goToNext,
    goToPrev,
    tick,
    submit,
  } = useExamStore();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load the set's questions and start the session.
  useEffect(() => {
    (async () => {
      try {
        console.log('[ExamPlayer] load start', {
          sessionId: params.sessionId,
          setId: params.setId,
          limit: params.limit,
        });
        const diag = await questionRepo.debugCounts(params.setId);
        console.log('[ExamPlayer] local DB counts', diag);

        const qs = await questionRepo.loadSetQuestions(params.setId, params.limit);
        console.log('[ExamPlayer] loaded questions', {
          requestedSetId: params.setId,
          loaded: qs.length,
          firstQuestionId: qs[0]?.id,
          firstOptionCount: qs[0]?.options.length,
        });
        if (qs.length === 0) {
          setLoadError(
            `No questions are stored on this device for set #${params.setId} ` +
              `(sets on device: ${diag.totalSets}, questions: ${diag.totalQuestions}). ` +
              'Open Profile → Sync now while online to download the question bank.',
          );
          return;
        }
        const session = await sessionRepo.findActive();
        const duration = session?.duration_seconds ?? null;
        start({
          sessionId: params.sessionId,
          setId: params.setId,
          questions: qs,
          mode: session?.mode ?? 'untimed',
          feedbackMode: session?.feedback_mode ?? feedbackMode,
          durationSeconds: duration,
        });
      } catch (e: any) {
        console.error('[ExamPlayer] load failed', e);
        setLoadError(e?.message ?? 'Could not load this test.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1-second timer for timed mode.
  useEffect(() => {
    if (mode !== 'timed') {
      return;
    }
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [mode, tick]);

  // Navigate to results once submitted.
  useEffect(() => {
    if (status === 'submitted') {
      (async () => {
        const score = await submit();
        navigation.replace('Results', {sessionId: params.sessionId, score});
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (loadError) {
    return (
      <View style={styles.errorBox}>
        <Text variant="titleMedium" style={styles.errorText}>
          {loadError}
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  if (loading || questions.length === 0) {
    return <ActivityIndicator style={styles.center} size="large" />;
  }

  const q = questions[currentIndex];
  if (!q) {
    return <ActivityIndicator style={styles.center} size="large" />;
  }
  const selected = answers[q.id];
  const showFeedback = feedbackMode === 'immediate' && selected != null;
  const isLast = currentIndex === questions.length - 1;

  const onSubmit = async () => {
    const score = await submit();
    navigation.replace('Results', {sessionId: params.sessionId, score});
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="labelLarge">
          Question {currentIndex + 1} / {questions.length}
        </Text>
        {mode === 'timed' && timeRemaining != null && (
          <Text variant="labelLarge" style={styles.timer}>
            ⏱ {formatTime(timeRemaining)}
          </Text>
        )}
      </View>
      <Progress.Bar
        progress={(currentIndex + 1) / questions.length}
        width={null}
        color="#4F46E5"
        style={styles.progress}
      />

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.question}>
            {q.text}
          </Text>

          <RadioButton.Group
            onValueChange={val => saveAnswer(q.id, Number(val))}
            value={selected != null ? String(selected) : ''}>
            {q.options.map(opt => {
              const correct = opt.is_correct === 1;
              const highlight = showFeedback
                ? correct
                  ? styles.correct
                  : selected === opt.id
                  ? styles.wrong
                  : undefined
                : undefined;
              return (
                <View key={opt.id} style={[styles.option, highlight]}>
                  <RadioButton.Item
                    label={opt.text}
                    value={String(opt.id)}
                    disabled={showFeedback}
                  />
                </View>
              );
            })}
          </RadioButton.Group>

          {showFeedback && q.explanation ? (
            <Text variant="bodySmall" style={styles.explanation}>
              💡 {q.explanation}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      <View style={styles.nav}>
        <Button onPress={goToPrev} disabled={currentIndex === 0}>
          Previous
        </Button>
        {isLast ? (
          <Button mode="contained" onPress={onSubmit}>
            Submit
          </Button>
        ) : (
          <Button mode="contained" onPress={goToNext}>
            Next
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1},
  errorBox: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20},
  errorText: {textAlign: 'center'},
  container: {padding: 16},
  header: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  timer: {color: '#DC2626'},
  progress: {marginBottom: 16},
  card: {borderRadius: 14},
  question: {marginBottom: 12},
  option: {borderRadius: 8, marginVertical: 2},
  correct: {backgroundColor: '#DCFCE7'},
  wrong: {backgroundColor: '#FEE2E2'},
  explanation: {marginTop: 12, fontStyle: 'italic', opacity: 0.8},
  nav: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 20},
});
