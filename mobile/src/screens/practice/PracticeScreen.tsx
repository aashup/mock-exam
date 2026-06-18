import React, {useCallback, useState} from 'react';
import {FlatList, StyleSheet} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {Card, Text} from 'react-native-paper';

export default function PracticeScreen() {
  const navigation = useNavigation<any>();
  const [subjects, setSubjects] = useState<{name: string, id: number, route: string}[]>([
    {name: "Subject Wise Test", id: 1, route: 'SubjectSelect'},
    {name: "Course Wise Test", id: 2, route: 'CourseSelect'},
  ]);

  // Use useCallback to memoize the navigate function
  const handleNavigateToCourseSelect = useCallback(
    ({route}: {route: string}) => {
      navigation.navigate(route);
    },
    [navigation]
  );

  return (
    <FlatList
      data={subjects}
      keyExtractor={item => String(item.id)}
    //   numColumns={2}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <Text style={styles.empty}>No subjects yet. Pull from the server via Sync.</Text>
      }
      renderItem={({item}) => (
        <Card
          style={styles.card}
          onPress={() => handleNavigateToCourseSelect({route: item.route})}>
          <Card.Content>
            <Text variant="titleMedium">{item.name}</Text>
          </Card.Content>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {padding: 4},
  card: {flex: 1, margin: 6, minHeight: 90, justifyContent: 'center'},
  empty: {textAlign: 'center', marginTop: 40, opacity: 0.6},
});
