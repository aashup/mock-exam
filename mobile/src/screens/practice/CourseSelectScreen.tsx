import React, {useCallback, useState} from 'react';
import {FlatList, StyleSheet} from 'react-native';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import {Button, List, Text} from 'react-native-paper';
import {subjectRepo} from '@/db/repositories/subjectRepo';
import type {Course} from '@/types/models';

/**
 * Step 2 (optional): pick a course linked to the chosen subject.
 * Course is optional — a "Skip / All Courses" action proceeds without one.
 */
export default function CourseSelectScreen() {
  const navigation = useNavigation<any>();
  const {params} = useRoute<any>();
  const {subjectId, subjectName} = params;
  const [courses, setCourses] = useState<Course[]>([]);

  useFocusEffect(
    useCallback(() => {
      void subjectRepo.coursesForSubject(subjectId).then(setCourses);
    }, [subjectId]),
  );

  const goToConfig = (course: Course | null) =>
    navigation.navigate('Config', {
      subjectId,
      subjectName,
      courseId: course?.id ?? null,
      courseName: course?.name ?? null,
    });

  return (
    <FlatList
      data={courses}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Button mode="outlined" style={styles.skip} onPress={() => goToConfig(null)}>
          Skip / All Courses
        </Button>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No courses linked to {subjectName}.</Text>
      }
      renderItem={({item}) => (
        <List.Item
          title={item.name}
          description={item.exam_type ?? undefined}
          left={p => <List.Icon {...p} icon="book-outline" />}
          onPress={() => goToConfig(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {padding: 8},
  skip: {marginBottom: 12, borderRadius: 10},
  empty: {textAlign: 'center', marginTop: 24, opacity: 0.6},
});
