import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {HistoryStackParamList} from './types';

import HistoryListScreen from '@/screens/history/HistoryListScreen';
import SessionReviewScreen from '@/screens/history/SessionReviewScreen';
import QuestionSetLibraryScreen from '@/screens/history/QuestionSetLibraryScreen';

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export default function HistoryNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HistoryList"
        component={HistoryListScreen}
        options={{title: 'History'}}
      />
      <Stack.Screen
        name="SessionReview"
        component={SessionReviewScreen}
        options={{title: 'Review'}}
      />
      <Stack.Screen
        name="QuestionSetLibrary"
        component={QuestionSetLibraryScreen}
        options={{title: 'Question Library'}}
      />
    </Stack.Navigator>
  );
}
