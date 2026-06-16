import React from 'react';
import {NavigationContainer, type Theme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useAuthStore} from '@/store/authStore';
import type {AuthStackParamList, MainTabParamList} from './types';

import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import PracticeNavigator from './PracticeNavigator';
import HistoryNavigator from './HistoryNavigator';
import ProfileNavigator from './ProfileNavigator';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: 'view-dashboard',
  Practice: 'pencil',
  History: 'history',
  Profile: 'account',
};

function MainNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={({route}) => ({
        headerShown: true,
        tabBarIcon: ({color, size}) => (
          <MaterialCommunityIcons name={TAB_ICONS[route.name]} color={color} size={size} />
        ),
      })}>
      <Tabs.Screen name="Home" component={DashboardScreen} options={{title: 'Dashboard'}} />
      <Tabs.Screen
        name="Practice"
        component={PracticeNavigator}
        options={{headerShown: false}}
      />
      <Tabs.Screen name="History" component={HistoryNavigator} options={{headerShown: false}} />
      <Tabs.Screen name="Profile" component={ProfileNavigator} options={{headerShown: false}} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator({navTheme}: {navTheme?: Theme}) {
  const token = useAuthStore(s => s.token);
  return (
    <NavigationContainer theme={navTheme}>
      {token ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
