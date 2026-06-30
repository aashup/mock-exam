import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {ProfileStackParamList} from './types';

import SettingsScreen from '@/screens/settings/SettingsScreen';
import AnalyticsScreen from '@/screens/settings/AnalyticsScreen';
import TestPreferencesScreen from '@/screens/settings/TestPreferencesScreen';
import ScannerScreen from '@/screens/settings/ScannerScreen';
import LocationDetailsScreen from '@/screens/settings/LocationDetailsScreen';

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
      <Stack.Screen
        name="LocationDetails"
        component={LocationDetailsScreen}
        options={{title: 'Locations'}}
      />
      <Stack.Screen
        name="ScanPaper"
        component={ScannerScreen}
        options={{title: 'Scan'}}
      />
    </Stack.Navigator>
  );
}
