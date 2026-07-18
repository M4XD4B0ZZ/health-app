import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import container from '../../../infrastructure/di/container';
import { EvaluationProfile, EvaluationOutput } from '../../../features/evaluation';
import { GoalsNotFoundError, ProfileNotFoundError } from '../../../features/goals';
import type { RootTabParamList } from '../../navigation/AppNavigator';

// UI Components
import { tokens } from '../../../ui/theme';
import { ScreenContainer } from '../../../ui/components/ScreenContainer';
import { AppText } from '../../../ui/components/AppText';
import { formatGoalProgressLabel, buildAssessmentSummary } from './evaluationSummaryDisplay';

/**
 * DI-002: first real consumer of the Evaluation Engine (GE-001-GE-005 + DI-001) — shows
 * the active profile's evaluation output for today, computed from real Journal data.
 * Explicitly nutrition-only (Product Bible §9); the legacy mock-data-backed Dashboard tab
 * was retired in DI-005 once this screen existed as its replacement.
 */
type LoadState = 'loading' | 'success' | 'error';

const EvaluationSummaryScreen: React.FC = () => {
  const [profiles, setProfiles] = useState<EvaluationProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [output, setOutput] = useState<EvaluationOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  // DI-008: explicit state so the mount/reload gap between clearing the previous
  // result and setting the next one is never rendered as blank or stale.
  const [loadState, setLoadState] = useState<LoadState>('loading');

  // DI-010: the active evaluation goal is changed ONLY in the Ziele tab. This screen shows it
  // read-only and links there — it holds no independently mutable goal state.
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const today = new Date().toISOString().split('T')[0];

  // DI-009: guards against an in-flight load that resolves after a newer one has already
  // started (e.g. rapid tab switching, or a switch fired mid-load) from overwriting the
  // newer result with stale data.
  const loadRequestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoadState('loading');

    const profileList = container.evaluationProfileRegistry.list();
    setProfiles(profileList);

    const currentActiveId = await container.evaluationProfileRegistry.getActiveProfileId();
    if (loadRequestIdRef.current !== requestId) return;
    setActiveProfileId(currentActiveId);

    try {
      const input = await container.buildEvaluationInputForDateUseCase.execute(
        today,
        currentActiveId,
      );
      const result = await container.getActiveEvaluationOutputUseCase.execute(input);
      if (loadRequestIdRef.current !== requestId) return;
      setOutput(result);
      setErrorMessage('');
      setLoadState('success');
    } catch (err) {
      if (loadRequestIdRef.current !== requestId) return;
      setOutput(null);
      if (err instanceof GoalsNotFoundError) {
        setErrorMessage('Bitte zuerst im Ziele-Tab Ziele festlegen.');
      } else if (err instanceof ProfileNotFoundError) {
        setErrorMessage('Bitte zuerst im Ziele-Tab ein Metabolismus-Profil anlegen.');
      } else {
        console.error('Failed to load evaluation summary:', err);
        setErrorMessage('Auswertung konnte nicht geladen werden.');
      }
      setLoadState('error');
    }
  }, [today]);

  // DI-009: reload on every tab focus (not just mount) so a profile switch made from the
  // Ziele tab's "Ziel wählen" card is picked up on return, without a full app reload.
  // Reuses the same load()/loadState machinery as the existing in-screen profile switch
  // (handleSelectProfile below) — loadState flips to 'loading' synchronously at the top of
  // load(), so stale content is hidden immediately, before any new data arrives.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // DI-010: navigate to the Ziele tab, the single place the evaluation goal can be changed.
  const handleChangeGoal = () => {
    navigation.navigate('Goals');
  };

  const activeProfileName =
    profiles.find((profile) => profile.id === activeProfileId)?.name ?? null;

  // GE-010: nutrient-specific summary composed from the domain-computed assessmentDetail —
  // the screen never re-derives corridor status.
  const assessmentSummary = output ? buildAssessmentSummary(output.assessmentDetail) : null;

  return (
    <ScreenContainer scroll>
      <View style={styles.container}>
        <AppText variant="title" style={styles.title}>
          Auswertung
        </AppText>

        {/* DI-010: active evaluation goal shown read-only. It is changed only in the Ziele tab;
            "Ziel ändern" navigates there. No second, inverted selector lives here. */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Aktives Bewertungsziel</AppText>
          <View style={styles.goalRow}>
            <AppText variant="body">{activeProfileName ?? '—'}</AppText>
            <TouchableOpacity
              onPress={handleChangeGoal}
              accessibilityRole="button"
              accessibilityLabel="Bewertungsziel ändern – wechselt zum Ziele-Tab"
              style={styles.changeGoalButton}
            >
              <AppText tone="accent">Ziel ändern</AppText>
            </TouchableOpacity>
          </View>
        </View>

        {loadState === 'loading' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tokens.colors.accent} />
            <AppText variant="meta" tone="muted" style={styles.loadingText}>
              Auswertung wird geladen…
            </AppText>
          </View>
        )}

        {loadState === 'error' && !!errorMessage && (
          <AppText tone="danger" style={styles.errorMessage}>
            {errorMessage}
          </AppText>
        )}

        {loadState === 'success' && output && (
          <>
            {assessmentSummary && (
              <View
                style={styles.section}
                accessibilityLabel={`Heutige Bewertung: ${assessmentSummary.announcement}`}
              >
                <AppText style={styles.sectionTitle}>Heutige Bewertung</AppText>
                <AppText variant="body">{assessmentSummary.primary}</AppText>
                {assessmentSummary.secondary.map((line) => (
                  <AppText
                    key={line}
                    variant="meta"
                    tone="muted"
                    style={styles.assessmentSecondary}
                  >
                    {line}
                  </AppText>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <AppText style={styles.sectionTitle}>Fortschritt</AppText>
              {output.goalProgress.map((progress) => (
                <View key={progress.label} style={styles.progressRow}>
                  <AppText variant="body">{formatGoalProgressLabel(progress.label)}</AppText>
                  <AppText variant="meta" tone="muted">
                    {Math.round(progress.consumed)} / {Math.round(progress.target)} (noch{' '}
                    {Math.round(progress.remaining)})
                  </AppText>
                </View>
              ))}
            </View>

            {output.insights.length > 0 && (
              <View style={styles.section}>
                <AppText style={styles.sectionTitle}>Einordnung</AppText>
                {output.insights.map((insight) => (
                  <AppText key={insight} variant="body" style={styles.insightText}>
                    {insight}
                  </AppText>
                ))}
              </View>
            )}

            {output.recommendations.length > 0 && (
              <View style={styles.section}>
                <AppText style={styles.sectionTitle}>Empfehlungen</AppText>
                {output.recommendations.map((recommendation) => (
                  <AppText
                    key={recommendation}
                    variant="body"
                    tone="accent"
                    style={styles.recommendationText}
                  >
                    {recommendation}
                  </AppText>
                ))}
              </View>
            )}

            {output.warnings.length > 0 && (
              <View style={styles.section}>
                <AppText style={styles.sectionTitle}>Hinweise</AppText>
                {output.warnings.map((warning) => (
                  <AppText key={warning} tone="danger" style={styles.warningText}>
                    {warning}
                  </AppText>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: tokens.colors.background,
  },
  title: {
    marginBottom: tokens.spacing.m,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  assessmentSecondary: {
    marginTop: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.s,
  },
  changeGoalButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.s,
  },
  errorMessage: {
    marginTop: tokens.spacing.s,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: tokens.spacing.l,
  },
  loadingText: {
    marginTop: tokens.spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.divider,
  },
  warningText: {
    marginTop: 4,
  },
  insightText: {
    marginTop: 4,
  },
  recommendationText: {
    marginTop: 4,
  },
});

export default EvaluationSummaryScreen;
