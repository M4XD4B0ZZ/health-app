import React from 'react';
import { StyleSheet, View, ViewStyle, TouchableOpacity } from 'react-native';
import { AppText } from './AppText';
import { tokens } from '../theme';

interface EntryRowProps {
  title: string;
  subtitle?: string;
  kcal: number | null;
  onPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
  /**
   * J-012: opt-in expand/collapse affordance for a toggleable group header. Omitted (default)
   * for every other row — ordinary leaf entries, composite-dish headers, transient confirmation
   * rows, Saved Meal cards — so none of them gain a chevron. Hidden from the accessibility tree
   * (requirement 24): the caller's own `accessibilityLabel` on the wrapping touchable already
   * communicates the expanded/collapsed state, so this glyph would otherwise double-announce it.
   */
  chevron?: 'collapsed' | 'expanded';
}

export const EntryRow: React.FC<EntryRowProps> = ({
  title,
  subtitle,
  kcal,
  onPress,
  actionLabel,
  onActionPress,
  style,
  chevron,
}) => {
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
        {kcal !== null ? (
          <AppText variant="numeric">{kcal} kcal</AppText>
        ) : (
          <AppText variant="meta" tone="muted">
            nicht erkannt
          </AppText>
        )}
        {actionLabel && onActionPress ? (
          <TouchableOpacity onPress={onActionPress} style={styles.actionButton} activeOpacity={0.7}>
            <AppText variant="meta" style={styles.actionLabel}>
              {actionLabel}
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>
      {chevron && (
        // Fixed width so swapping the glyph on toggle never shifts surrounding layout
        // (requirement 14). Hidden from the accessibility tree on both platforms — the
        // touchable wrapper's own accessibilityLabel already states the expanded/collapsed
        // state (requirement 24/20: no duplicate announcement).
        <AppText
          variant="body"
          tone="muted"
          style={styles.chevron}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {chevron === 'expanded' ? '⌄' : '›'}
        </AppText>
      )}
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
  actionButton: {
    marginTop: tokens.spacing.xs,
    paddingVertical: 2,
  },
  actionLabel: {
    color: tokens.colors.danger,
  },
  subtitle: {
    marginTop: 2,
  },
  chevron: {
    width: 20,
    marginLeft: tokens.spacing.xs,
    textAlign: 'center',
  },
});
