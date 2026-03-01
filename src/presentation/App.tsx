import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import AppNavigator from './navigation/AppNavigator';
import container from '../infrastructure/di/container';

export default function App() {
  React.useEffect(() => {
    if (__DEV__ && process.env.EXPO_PUBLIC_RESET_ON_LAUNCH === 'true') {
      container.foodEntryRepository.clearAll().catch((err: unknown) => {
        console.warn('Failed to clear repo on dev launch:', err);
      });
    }
  }, []);
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
