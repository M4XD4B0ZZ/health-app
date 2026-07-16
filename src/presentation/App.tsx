import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import AppNavigator from './navigation/AppNavigator';
import container from '../infrastructure/di/container';
import { supabaseConfigError } from '../infrastructure/supabase/supabaseClient';
import { tokens } from '../ui/theme';
import { AppText } from '../ui/components/AppText';

export default function App() {
  React.useEffect(() => {
    if (__DEV__ && process.env.EXPO_PUBLIC_RESET_ON_LAUNCH === 'true') {
      container.foodEntryRepository.clearAll().catch((err: unknown) => {
        console.warn('Failed to clear repo on dev launch:', err);
      });
    }
  }, []);

  // NATIVE-001 / P2-001: a build without valid Supabase configuration must never reach
  // the app — but it must fail visibly instead of dying before the first frame.
  if (supabaseConfigError) {
    return (
      <SafeAreaProvider>
        <View style={styles.fatalContainer}>
          <AppText variant="title" style={styles.fatalTitle}>
            Konfigurationsfehler
          </AppText>
          <AppText variant="body" style={styles.fatalBody}>
            Diese App wurde ohne gültige Server-Konfiguration gebaut und kann nicht gestartet
            werden. Bitte den Build mit gesetzten Umgebungsvariablen neu erstellen.
          </AppText>
          <AppText variant="meta" tone="muted">
            {supabaseConfigError}
          </AppText>
        </View>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fatalContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: tokens.spacing.m,
    backgroundColor: tokens.colors.background,
    gap: tokens.spacing.s,
  },
  fatalTitle: {
    color: tokens.colors.danger,
  },
  fatalBody: {
    marginBottom: tokens.spacing.xs,
  },
});
