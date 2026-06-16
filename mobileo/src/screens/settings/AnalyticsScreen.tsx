import React, {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {BarChart} from 'react-native-gifted-charts';
import {Card, Divider, List, Text} from 'react-native-paper';
import {analyticsRepo} from '@/db/repositories/analyticsRepo';
import type {OverallStats, SubjectStat} from '@/db/repositories/analyticsRepo';
import {dashboardRepo} from '@/db/repositories/dashboardRepo';

/** Aggregated performance analytics: overall accuracy, per-subject bars,
 *  streak, and weakest topic. All computed locally from SQLite. */
export default function AnalyticsScreen() {
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [subjects, setSubjects] = useState<SubjectStat[]>([]);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        analyticsRepo.overall(),
        analyticsRepo.perSubject(),
        dashboardRepo.streak(),
      ]).then(([o, s, st]) => {
        if (active) {
          setOverall(o);
          setSubjects(s);
          setStreak(st);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  // perSubject() returns worst-first, so the first entry is the weakest topic.
  const weakest = subjects[0];
  const barData = subjects.map(s => ({
    value: s.accuracyPercent,
    label: s.subjectName?.slice(0, 6) ?? '',
    frontColor: '#4F46E5',
  }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.heading}>
            Overall
          </Text>
          <Text variant="displaySmall" style={styles.bigStat}>
            {overall?.accuracyPercent ?? 0}%
          </Text>
          <Text variant="bodySmall" style={styles.subtle}>
            accuracy across {overall?.attempted ?? 0} questions
          </Text>
          <Divider style={styles.divider} />
          <View style={styles.statRow}>
            <Stat label="Attempted" value={overall?.attempted ?? 0} />
            <Stat label="Correct" value={overall?.correct ?? 0} />
            <Stat label="Wrong" value={overall?.incorrect ?? 0} />
            <Stat label="Streak" value={`${streak}d`} />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.heading}>
            Accuracy by subject
          </Text>
          {barData.length > 0 ? (
            <BarChart
              data={barData}
              maxValue={100}
              noOfSections={4}
              barWidth={28}
              spacing={24}
              frontColor="#4F46E5"
              yAxisTextStyle={styles.axis}
              xAxisLabelTextStyle={styles.axis}
            />
          ) : (
            <Text style={styles.subtle}>Complete a test to see analytics.</Text>
          )}
        </Card.Content>
      </Card>

      {weakest && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.heading}>
              Weakest topic
            </Text>
            <List.Item
              title={weakest.subjectName}
              description={`${weakest.accuracyPercent}% over ${weakest.attempted} questions`}
              left={p => <List.Icon {...p} icon="alert-circle" color="#DC2626" />}
            />
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

function Stat({label, value}: {label: string; value: number | string}) {
  return (
    <View style={styles.stat}>
      <Text variant="titleLarge" style={styles.statValue}>
        {value}
      </Text>
      <Text variant="labelSmall" style={styles.subtle}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, paddingBottom: 40},
  card: {borderRadius: 14, marginBottom: 16},
  heading: {fontWeight: '700', marginBottom: 8},
  bigStat: {fontWeight: '800'},
  subtle: {opacity: 0.6},
  divider: {marginVertical: 12},
  statRow: {flexDirection: 'row', justifyContent: 'space-between'},
  stat: {alignItems: 'center', flex: 1},
  statValue: {fontWeight: '700'},
  axis: {fontSize: 10, color: '#888'},
});
