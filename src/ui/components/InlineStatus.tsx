import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { AppText } from './AppText';
import { tokens } from '../theme';

export type InlineStatusState = 'idle' | 'processing' | 'done' | 'error';

interface InlineStatusProps {
  state: InlineStatusState;
  message?: string;
}

export const InlineStatus: React.FC<InlineStatusProps> = ({ state, message }) => {
  const [visibleState, setVisibleState] = useState<InlineStatusState>(state);

  // Auto-hide 'done' state after 2.5s
  useEffect(() => {
    setVisibleState(state);

    if (state === 'done') {
      const timer = setTimeout(() => {
        setVisibleState('idle');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  if (visibleState === 'idle') {
    // Return empty view that holds the height to prevent layout jumps
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {visibleState === 'processing' && (
        <ActivityIndicator size="small" color={tokens.colors.textMuted} style={styles.spinner} />
      )}
      <AppText
        variant="meta"
        tone={visibleState === 'error' ? 'danger' : visibleState === 'done' ? 'primary' : 'muted'}
      >
        {message}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24, // Keep stable height
    marginTop: tokens.spacing.s,
  },
  spinner: {
    marginRight: tokens.spacing.xs,
  },
});
