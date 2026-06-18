import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {PracticeStackParamList} from './types';

import SubjectSelectScreen from '@/screens/practice/SubjectSelectScreen';
import CourseSelectScreen from '@/screens/practice/CourseSelectScreen';
import ConfigScreen from '@/screens/practice/ConfigScreen';
import ExamPlayerScreen from '@/screens/practice/ExamPlayerScreen';
import ResultsScreen from '@/screens/practice/ResultsScreen';
import PracticeScreen from '@/screens/practice/PracticeScreen';

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export default function PracticeNavigator() {
  return (
    <Stack.Navigator initialRouteName='Practice'>
      <Stack.Screen
        name="SubjectSelect"
        component={SubjectSelectScreen}
        options={{title: 'Choose Subject'}}
      />
      <Stack.Screen
        name="CourseSelect"
        component={CourseSelectScreen}
        options={{title: 'Choose Course'}}
      />
      <Stack.Screen name="Config" component={ConfigScreen} options={{title: 'Test Setup'}} />
      <Stack.Screen
        name="ExamPlayer"
        component={ExamPlayerScreen}
        options={{title: 'Test', headerBackVisible: false}}
      />
      <Stack.Screen
        name="Results"
        component={ResultsScreen}
        options={{title: 'Results', headerBackVisible: false}}
      />
      <Stack.Screen
        name="Practice"
        component={PracticeScreen}
        options={{title: 'Available', headerBackVisible: false}}
      />
    </Stack.Navigator>
  );
}
