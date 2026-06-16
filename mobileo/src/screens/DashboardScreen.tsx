import React, {useCallback, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {Button, Text} from 'react-native-paper';
import StatCard from '@/components/StatCard';
import AccuracyTrendChart from '@/components/AccuracyTrendChart';
import {dashboardRepo} from '@/db/repositories/dashboardRepo';
import {useAuthStore} from '@/store/authStore';
import type {DashboardStats} from '@/types/models';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

const emptyStats: DashboardStats = {
  testsTaken: 0,
  questionsAttempted: 0,
  correct: 0,
  wrong: 0,
  accuracyPercent: 0,
  timeOnAppSeconds: 0,
  currentStreak: 0,
};

/** Student performance overview — computed from local SQLite (offline-first). */
export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore(s => s.user);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [trend, setTrend] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([
      dashboardRepo.stats(),
      dashboardRepo.recentAccuracy(7),
    ]);
    setStats(s);
    setTrend(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text variant="headlineSmall" style={styles.greeting}>
        Hi {user?.name ?? 'there'} 👋
      </Text>
      <Text variant="bodyMedium" style={styles.sub}>
        Here's your performance so far.
      </Text>

      <View style={styles.grid}>
        <View style={styles.row}>
          <StatCard label="Tests Taken" value={stats.testsTaken} />
          <StatCard label="Questions" value={stats.questionsAttempted} accent="#0EA5E9" />
        </View>
        <View style={styles.row}>
          <StatCard label="Correct" value={stats.correct} accent="#16A34A" />
          <StatCard label="Wrong" value={stats.wrong} accent="#DC2626" />
        </View>
        <View style={styles.row}>
          <StatCard label="Accuracy" value={`${stats.accuracyPercent}%`} accent="#9333EA" />
          <StatCard
            label="Time on App"
            value={formatDuration(stats.timeOnAppSeconds)}
            accent="#F59E0B"
          />
        </View>
      </View>

      <Text variant="bodySmall" style={styles.streak}>
        🔥 Current streak: {stats.currentStreak} day(s)
      </Text>

      <AccuracyTrendChart scores={trend} />

      <Button
        mode="contained"
        style={styles.cta}
        onPress={() => navigation.navigate('Practice')}>
        Start New Test
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {padding: 12, paddingBottom: 40},
  greeting: {fontWeight: '700'},
  sub: {opacity: 0.7, marginBottom: 12},
  grid: {marginBottom: 8},
  row: {flexDirection: 'row'},
  streak: {textAlign: 'center', marginVertical: 8, opacity: 0.8},
  cta: {marginTop: 16, borderRadius: 12},
});
