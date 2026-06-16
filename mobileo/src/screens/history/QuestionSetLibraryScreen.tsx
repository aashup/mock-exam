import React, {useCallback, useState} from 'react';
import {SectionList, StyleSheet, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {Button, Card, Chip, Text} from 'react-native-paper';
import {questionRepo} from '@/db/repositories/questionRepo';
import type {SetWithSubject} from '@/db/repositories/questionRepo';
import {sessionRepo} from '@/db/repositories/sessionRepo';
import {useSettingsStore} from '@/store/settingsStore';

interface Section {
  title: string;
  data: SetWithSubject[];
}

/** Groups stored sets by subject so they can be relaunched as fresh sessions. */
function groupBySubject(sets: SetWithSubject[]): Section[] {
  const map = new Map<string, SetWithSubject[]>();
  for (const s of sets) {
    const key = s.subject_name ?? 'Unknown subject';
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([title, data]) => ({title, data}));
}

/** Library of stored question sets — relaunch any as a new mock/revision session. */
export default function QuestionSetLibraryScreen() {
  const navigation = useNavigation<any>();
  const settings = useSettingsStore();
  const [sections, setSections] = useState<Section[]>([]);
  const [starting, setStarting] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      void questionRepo.allSets().then(sets => setSections(groupBySubject(sets)));
    }, []),
  );

  const startMock = async (set: SetWithSubject) => {
    setStarting(set.id);
    try {
      const duration =
        settings.testMode === 'timed' ? settings.defaultTimerMinutes * 60 : null;
      const sessionId = await sessionRepo.startFromSet(set.id, {
        mode: settings.testMode,
        feedbackMode: settings.feedbackMode,
        durationSeconds: duration,
      });
      // Cross-stack jump into the Practice tab's exam engine. No AI call — the
      // set is reused as-is.
      navigation.navigate('Practice', {
        screen: 'ExamPlayer',
        params: {sessionId, setId: set.id},
      });
    } finally {
      setStarting(null);
    }
  };

  return (
    <SectionList
      sections={sections}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.container}
      ListEmptyComponent={
        <Text style={styles.empty}>
          No stored sets yet. Generate a test to build your library.
        </Text>
      }
      renderSectionHeader={({section}) => (
        <Text variant="titleMedium" style={styles.section}>
          {section.title}
        </Text>
      )}
      renderItem={({item}) => (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <View style={styles.chips}>
                <Chip compact style={styles.chip}>
                  {item.difficulty}
                </Chip>
                <Chip compact icon="translate" style={styles.chip}>
                  {item.language === 'hi' ? 'हिन्दी' : 'English'}
                </Chip>
              </View>
              <Text variant="bodySmall" style={styles.date}>
                {item.generated_at?.slice(0, 10) ?? ''}
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.count}>
              {item.total_questions} questions
            </Text>
            <Button
              mode="contained-tonal"
              icon="play"
              loading={starting === item.id}
              disabled={starting != null}
              onPress={() => startMock(item)}
              style={styles.start}>
              Start mock
            </Button>
          </Card.Content>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, paddingBottom: 40},
  empty: {textAlign: 'center', marginTop: 40, opacity: 0.6},
  section: {marginTop: 16, marginBottom: 6, fontWeight: '700'},
  card: {borderRadius: 14, marginBottom: 10},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  chips: {flexDirection: 'row', gap: 6, flexWrap: 'wrap'},
  chip: {alignSelf: 'flex-start'},
  date: {opacity: 0.6},
  count: {marginTop: 8},
  start: {marginTop: 12, borderRadius: 10},
});
