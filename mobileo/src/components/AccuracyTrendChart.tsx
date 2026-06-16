import React from 'react';
import {StyleSheet, View} from 'react-native';
import {LineChart} from 'react-native-gifted-charts';
import {Text} from 'react-native-paper';

interface Props {
  /** Scores (0–100) of the last N sessions, oldest → newest. */
  scores: number[];
}

/** Accuracy trend line for the dashboard. */
export default function AccuracyTrendChart({scores}: Props) {
  if (scores.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="bodyMedium" style={styles.emptyText}>
          Complete a test to see your accuracy trend.
        </Text>
      </View>
    );
  }

  const data = scores.map(value => ({value}));

  return (
    <View style={styles.wrap}>
      <Text variant="titleMedium" style={styles.title}>
        Accuracy Trend
      </Text>
      <LineChart
        data={data}
        maxValue={100}
        noOfSections={4}
        color="#4F46E5"
        thickness={3}
        hideDataPoints={false}
        yAxisTextStyle={styles.axis}
        xAxisColor="#ddd"
        yAxisColor="#ddd"
        curved
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {padding: 12},
  title: {marginBottom: 8, fontWeight: '600'},
  axis: {fontSize: 10, color: '#888'},
  empty: {padding: 24, alignItems: 'center'},
  emptyText: {opacity: 0.6},
});
