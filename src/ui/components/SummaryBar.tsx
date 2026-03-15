import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { tokens } from '../theme';

interface MacroStackProps {
  label: string;
  value: string;
}

export const MacroStack: React.FC<MacroStackProps> = ({ label, value }) => (
  <View style={styles.macroStack}>
    <AppText variant="meta">{label}</AppText>
    <AppText variant="numeric">{value}</AppText>
  </View>
);

interface SummaryBarProps {
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const SummaryBar: React.FC<SummaryBarProps> = ({ children, style }) => {
  return <View style={[styles.container, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tokens.colors.transparent,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.divider,
    paddingVertical: tokens.spacing.m,
  },
  macroStack: {
    alignItems: 'flex-end',
  },
});
