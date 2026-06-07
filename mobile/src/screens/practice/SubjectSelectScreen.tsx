import React, {useCallback, useState} from 'react';
import {FlatList, StyleSheet} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {Card, Text} from 'react-native-paper';
import {subjectRepo} from '@/db/repositories/subjectRepo';
import type {Subject} from '@/types/models';

/** Step 1: pick a subject (the PRIMARY driver of question content). */
export default function SubjectSelectScreen() {
  const navigation = useNavigation<any>();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useFocusEffect(
    useCallback(() => {
      void subjectRepo.all().then(setSubjects);
    }, []),
  );

  return (
    <FlatList
      data={subjects}
      keyExtractor={item => String(item.id)}
      numColumns={2}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <Text style={styles.empty}>No subjects yet. Pull from the server via Sync.</Text>
      }
      renderItem={({item}) => (
        <Card
          style={styles.card}
          onPress={() =>
            navigation.navigate('CourseSelect', {
              subjectId: item.id,
              subjectName: item.name,
            })
          }>
          <Card.Content>
            <Text variant="titleMedium">{item.name}</Text>
          </Card.Content>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {padding: 8},
  card: {flex: 1, margin: 6, minHeight: 90, justifyContent: 'center'},
  empty: {textAlign: 'center', marginTop: 40, opacity: 0.6},
});
