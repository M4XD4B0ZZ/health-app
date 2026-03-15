import React from 'react';
import { StyleSheet, View, ViewStyle, TouchableOpacity } from 'react-native';
import { AppText } from './AppText';
import { tokens } from '../theme';

interface EntryRowProps {
  title: string;
  subtitle?: string;
  kcal: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export const EntryRow: React.FC<EntryRowProps> = ({ title, subtitle, kcal, onPress, style }) => {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={[styles.container, style]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <AppText variant="body">{title}</AppText>
        {subtitle && (
          <AppText variant="meta" tone="muted" style={styles.subtitle}>
            {subtitle}
          </AppText>
        )}
      </View>
      <View style={styles.right}>
        <AppText variant="numeric">{kcal} kcal</AppText>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.transparent,
    paddingVertical: tokens.spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.divider,
  },
  left: {
    flex: 1,
    paddingRight: tokens.spacing.s,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
  },
});
