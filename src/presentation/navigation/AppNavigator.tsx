import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Screen-Komponenten importieren
import DashboardScreen from '../features/dashboard/DashboardScreen';
import JournalScreen from '../features/journal/JournalScreen';
import GoalsScreen from '../features/goals/GoalsScreen';
import NutritionScreen from '../features/nutrition/NutritionScreen';
import RecoveryScreen from '../features/recovery/RecoveryScreen';
import VoiceScreen from '../features/voice/VoiceScreen';

// Typdefinition für die Tab-Parameter
export type RootTabParamList = {
  Dashboard: undefined;
  Journal: undefined;
  Goals: undefined;
  Nutrition: undefined;
  Recovery: undefined;
};

// Typdefinition für die Stack-Parameter
export type RootStackParamList = {
  MainTabs: undefined;
  Voice: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Journal') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Goals') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Nutrition') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'Recovery') {
            iconName = focused ? 'bed' : 'bed-outline';
          } else {
            iconName = 'help-circle';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4a90e2',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Journal"
        component={JournalScreen}
        options={{
          title: 'Tagebuch',
        }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          title: 'Ziele',
        }}
      />
      <Tab.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{
          title: 'Ernährung',
        }}
      />
      <Tab.Screen
        name="Recovery"
        component={RecoveryScreen}
        options={{
          title: 'Erholung',
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen
        name="Voice"
        component={VoiceScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
