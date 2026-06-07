import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {ProfileStackParamList} from './types';

import SettingsScreen from '@/screens/settings/SettingsScreen';
import AnalyticsScreen from '@/screens/settings/AnalyticsScreen';
import TestPreferencesScreen from '@/screens/settings/TestPreferencesScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Profile'}}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{title: 'Analytics'}}
      />
      <Stack.Screen
        name="TestPreferences"
        component={TestPreferencesScreen}
        options={{title: 'Test Preferences'}}
      />
    </Stack.Navigator>
  );
}
