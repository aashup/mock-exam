import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text} from 'react-native-paper';

interface Props {
  label: string;
  value: string | number;
  accent?: string;
}

/** Single metric tile used in the dashboard stat grid. */
export default function StatCard({label, value, accent = '#4F46E5'}: Props) {
  return (
    <Card style={styles.card} mode="elevated">
      <View style={styles.inner}>
        <Text variant="headlineMedium" style={[styles.value, {color: accent}]}>
          {value}
        </Text>
        <Text variant="labelMedium" style={styles.label}>
          {label}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {flex: 1, margin: 6, borderRadius: 14},
  inner: {padding: 16, alignItems: 'center', justifyContent: 'center'},
  value: {fontWeight: '700'},
  label: {marginTop: 4, opacity: 0.7, textAlign: 'center'},
});
