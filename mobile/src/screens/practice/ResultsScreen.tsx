import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Button, Card, Menu, Snackbar, Text} from 'react-native-paper';
import * as Progress from 'react-native-progress';
import type {Difficulty} from '@/types/models';
import {AIService, MissingApiKeyError, OfflineError} from '@/services/ai/AIService';
import {questionRepo} from '@/db/repositories/questionRepo';
import {sessionRepo} from '@/db/repositories/sessionRepo';
import {useNetworkStatus} from '@/hooks/useNetworkStatus';
import {useSettingsStore} from '@/store/settingsStore';

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

type Ctx = {
  subjectId: number;
  subjectName: string | null;
  courseId: number | null;
  courseName: string | null;
  language: import('@/types/models').TestLanguage;
  count: number;
  isOffline: boolean;
};

/** Post-submission score summary. */
export default function ResultsScreen() {
  const navigation = useNavigation<any>();
  const {params} = useRoute<any>();
  const settings = useSettingsStore();
  const online = useNetworkStatus();

  const score: number = params.score ?? 0;
  const passed = score >= 50;

  // Recover the subject + question count behind this session so we can offer a
  // follow-up test on the same subject with the same number of questions.
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (params.sessionId != null) {
        setCtx((await sessionRepo.practiceContext(params.sessionId)) as Ctx | null);
      }
    })();
  }, [params.sessionId]);

  // Launch another test immediately: same subject, same count, same mode as the
  // test just finished — only the difficulty changes. If the previous test was
  // OFFLINE we stay offline (local bank); otherwise we run the online path
  // (reuse a stored set, else generate via AI).
  const startNext = async (difficulty: Difficulty) => {
    setMenuVisible(false);
    if (!ctx || starting) {
      return;
    }
    setStarting(true);
    setError(null);
    try {
      let setId: number;
      let totalQuestions = ctx.count;
      let limit: number | undefined;

      if (ctx.isOffline) {
        // Offline test → use the best locally-stored set, capped to the count.
        const localSet = await questionRepo.bestLocalSet(ctx.subjectId, difficulty);
        if (!localSet) {
          setError(
            'No stored set matches this difficulty on this device yet. Generate one once while online.',
          );
          return;
        }
        setId = localSet.id;
        limit = Math.min(ctx.count, localSet.total_questions);
        totalQuestions = limit;
      } else {
        // Online test → reuse an un-attempted matching set, else generate.
        const reusable = await questionRepo.findReusableSet(
          ctx.subjectId,
          difficulty,
          ctx.language,
        );
        if (reusable) {
          setId = reusable.id;
          totalQuestions = reusable.total_questions;
        } else {
          if (!online) {
            setError(
              "You're offline — reconnect to generate new questions, or run an Offline Test.",
            );
            return;
          }
          setId = await AIService.generateAndStore({
            subjectId: ctx.subjectId,
            subjectName: ctx.subjectName ?? '',
            courseId: ctx.courseId,
            courseName: ctx.courseName,
            difficulty,
            count: ctx.count,
            language: ctx.language,
          });
        }
      }

      const durationSeconds =
        settings.testMode === 'timed' ? settings.defaultTimerMinutes * 60 : null;
      const sessionId = await sessionRepo.create({
        setId,
        mode: settings.testMode,
        feedbackMode: settings.feedbackMode,
        totalQuestions,
        durationSeconds,
        isOffline: ctx.isOffline,
      });
      navigation.navigate('ExamPlayer', {sessionId, setId, limit});
    } catch (e: any) {
      if (e instanceof OfflineError) {
        setError("You're offline — connect to the internet to generate new questions.");
      } else if (e instanceof MissingApiKeyError) {
        setError('No AI API key set. Add one under Profile → AI Configuration.');
      } else {
        setError(e?.message ?? 'Could not start the next test.');
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <Progress.Circle
            size={160}
            progress={score / 100}
            showsText
            formatText={() => `${score}%`}
            color={passed ? '#16A34A' : '#DC2626'}
            thickness={10}
            textStyle={styles.scoreText}
          />
          <Text variant="headlineSmall" style={styles.verdict}>
            {passed ? 'Great job! 🎉' : 'Keep practicing 💪'}
          </Text>
        </Card.Content>
      </Card>

      {ctx && (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="contained"
              style={styles.btn}
              icon="arrow-right-circle"
              loading={starting}
              disabled={starting}
              onPress={() => setMenuVisible(true)}>
              Next {ctx.count}
            </Button>
          }>
          <Menu.Item disabled title="Pick difficulty" />
          {DIFFICULTIES.map(d => (
            <Menu.Item key={d} onPress={() => startNext(d)} title={d} />
          ))}
        </Menu>
      )}

      <Button
        mode="contained"
        style={styles.btn}
        disabled={starting}
        onPress={() => navigation.navigate('SubjectSelect')}>
        New Test
      </Button>
      <Button
        style={styles.btn}
        disabled={starting}
        onPress={() => navigation.navigate('Home')}>
        Back to Dashboard
      </Button>

      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={5000}>
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 24, justifyContent: 'center'},
  card: {borderRadius: 16, marginBottom: 24},
  content: {alignItems: 'center', paddingVertical: 24},
  scoreText: {fontSize: 28, fontWeight: '700'},
  verdict: {marginTop: 20, fontWeight: '600'},
  btn: {marginTop: 8, borderRadius: 10},
});
