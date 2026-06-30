import React, {useCallback, useLayoutEffect, useState} from 'react';
import {FlatList, StyleSheet} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {Appbar, List, Text} from 'react-native-paper';
import {sessionRepo} from '@/db/repositories/sessionRepo';
import type {Session} from '@/types/models';

/** Lists completed test sessions with their scores. */
export default function HistoryListScreen() {
  const navigation = useNavigation<any>();
  const [sessions, setSessions] = useState<Session[]>([]);

  useFocusEffect(
    useCallback(() => {
      void sessionRepo.history().then(setSessions);
    }, []),
  );

  // useLayoutEffect(() => {
  //   navigation.setOptions({
  //     headerRight: () => (
  //       <Appbar.Action
  //         icon="bookshelf"
  //         accessibilityLabel="Question Library"
  //         onPress={() => navigation.navigate('QuestionSetLibrary')}
  //       />
  //     ),
  //   });
  // }, [navigation]);

  return (
    <FlatList
      data={sessions}
      keyExtractor={item => String(item.id)}
      ListEmptyComponent={<Text style={styles.empty}>No completed tests yet.</Text>}
      renderItem={({item}) => (
        <List.Item
          title={`Test #${item.id} — ${item.score ?? 0}%`}
          description={`${item.total_questions} questions · ${
            item.completed_at?.slice(0, 10) ?? ''
          }`}
          onPress={() => navigation.navigate('SessionReview', {sessionId: item.id})}
          left={p => (
            <List.Icon
              {...p}
              icon={(item.score ?? 0) >= 50 ? 'check-circle' : 'close-circle'}
              color={(item.score ?? 0) >= 50 ? '#16A34A' : '#DC2626'}
            />
          )}
          right={p => <List.Icon {...p} icon="chevron-right" />}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: {textAlign: 'center', marginTop: 40, opacity: 0.6},
});
