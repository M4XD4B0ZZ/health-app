import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Screen-Komponenten importieren
import DashboardScreen from '../features/dashboard/DashboardScreen';
import NutritionScreen from '../features/nutrition/NutritionScreen';
import RecoveryScreen from '../features/recovery/RecoveryScreen';

// Typdefinition für die Tab-Parameter
export type RootTabParamList = {
  Dashboard: undefined;
  Nutrition: undefined;
  Recovery: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const AppNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
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

export default AppNavigator;