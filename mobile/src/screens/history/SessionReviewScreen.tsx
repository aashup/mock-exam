import React, {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect, useRoute} from '@react-navigation/native';
import {ActivityIndicator, Card, Chip, Divider, Text} from 'react-native-paper';
import {sessionRepo} from '@/db/repositories/sessionRepo';
import type {SessionReview} from '@/db/repositories/sessionRepo';

/** Question-by-question review of a completed session. */
export default function SessionReviewScreen() {
  const {params} = useRoute<any>();
  const sessionId: number = params.sessionId;
  const [review, setReview] = useState<SessionReview | null>(null);
  const [loading, setLoading] = useState(true);

  // useFocusEffect(
  //   useCallback(() => {
  //     let active = true;
  //     setLoading(true);
  //     void sessionRepo.reviewData(sessionId).then(r => {
  //       if (active) {
  //         setReview(r);
  //         setLoading(false);
  //       }
  //     });
  //     return () => {
  //       active = false;
  //     };
  //   }, [sessionId]),
  // );

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" />;
  }
  if (!review) {
    return <Text style={styles.empty}>Session not found.</Text>;
  }

  const {session, items, correct, incorrect, skipped} = review;
  const duration = session.duration_seconds;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.summary}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.score}>
            {session.score ?? 0}%
          </Text>
          <View style={styles.chips}>
            <Chip icon="check-circle" style={styles.okChip}>
              {correct} correct
            </Chip>
            <Chip icon="close-circle" style={styles.badChip}>
              {incorrect} wrong
            </Chip>
            <Chip icon="debug-step-over">{skipped} skipped</Chip>
          </View>
          {duration != null && (
            <Text variant="bodySmall" style={styles.meta}>
              Time allotted: {Math.round(duration / 60)} min
            </Text>
          )}
        </Card.Content>
      </Card>

      {items.map((item, idx) => (
        <Card key={item.questionId} style={styles.qCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.question}>
              {idx + 1}. {item.text}
            </Text>

            {item.options.map(opt => {
              const isAnswer = opt.is_correct === 1;
              const isPick = item.selectedOptionId === opt.id;
              const tint = isAnswer
                ? styles.correct
                : isPick
                ? styles.wrong
                : undefined;
              const suffix = isAnswer
                ? '  ✓ correct'
                : isPick
                ? '  ✗ your pick'
                : '';
              return (
                <View key={opt.id} style={[styles.option, tint]}>
                  <Text>
                    {opt.text}
                    {suffix ? <Text style={styles.tag}>{suffix}</Text> : null}
                  </Text>
                </View>
              );
            })}

            {item.selectedOptionId == null && (
              <Text variant="bodySmall" style={styles.skipped}>
                Not answered
              </Text>
            )}

            {item.explanation ? (
              <>
                <Divider style={styles.divider} />
                <Text variant="bodySmall" style={styles.explanation}>
                  💡 {item.explanation}
                </Text>
              </>
            ) : null}
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1},
  empty: {textAlign: 'center', marginTop: 40, opacity: 0.6},
  container: {padding: 16, paddingBottom: 40},
  summary: {borderRadius: 14, marginBottom: 16},
  score: {textAlign: 'center', fontWeight: '700'},
  chips: {flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12},
  okChip: {backgroundColor: '#DCFCE7'},
  badChip: {backgroundColor: '#FEE2E2'},
  meta: {textAlign: 'center', marginTop: 12, opacity: 0.7},
  qCard: {borderRadius: 14, marginBottom: 12},
  question: {marginBottom: 10},
  option: {borderRadius: 8, padding: 10, marginVertical: 3, backgroundColor: '#F3F4F6'},
  correct: {backgroundColor: '#DCFCE7'},
  wrong: {backgroundColor: '#FEE2E2'},
  tag: {fontWeight: '700', opacity: 0.7},
  skipped: {marginTop: 6, fontStyle: 'italic', opacity: 0.6},
  divider: {marginVertical: 10},
  explanation: {fontStyle: 'italic', opacity: 0.8},
});
