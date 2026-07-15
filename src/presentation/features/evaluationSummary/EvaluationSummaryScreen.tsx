import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import container from '../../../infrastructure/di/container';
import { EvaluationProfile, EvaluationOutput } from '../../../features/evaluation';
import { GoalsNotFoundError, ProfileNotFoundError } from '../../../features/goals';

// UI Components
import { tokens } from '../../../ui/theme';
import { ScreenContainer } from '../../../ui/components/ScreenContainer';
import { AppText } from '../../../ui/components/AppText';
import { PrimaryButton } from '../../../ui/components/PrimaryButton';
import { formatGoalProgressLabel, formatAssessment } from './evaluationSummaryDisplay';

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
  const [switchingProfileId, setSwitchingProfileId] = useState<string | null>(null);
  // DI-008: explicit state so the mount/reload gap between clearing the previous
  // result and setting the next one is never rendered as blank or stale.
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoadState('loading');

    const profileList = container.evaluationProfileRegistry.list();
    setProfiles(profileList);

    const currentActiveId = await container.evaluationProfileRegistry.getActiveProfileId();
    setActiveProfileId(currentActiveId);

    try {
      const input = await container.buildEvaluationInputForDateUseCase.execute(
        today,
        currentActiveId,
      );
      const result = await container.getActiveEvaluationOutputUseCase.execute(input);
      setOutput(result);
      setErrorMessage('');
      setLoadState('success');
    } catch (err) {
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

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectProfile = async (profileId: string) => {
    if (switchingProfileId || profileId === activeProfileId) return;

    setSwitchingProfileId(profileId);
    try {
      await container.evaluationProfileRegistry.setActiveProfileId(profileId);
      await load();
    } catch (err) {
      console.error('Failed to switch active evaluation profile:', err);
    } finally {
      setSwitchingProfileId(null);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.container}>
        <AppText variant="title" style={styles.title}>
          Auswertung
        </AppText>

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Ziel</AppText>
          <View style={styles.profilePicker}>
            {profiles.map((profile) => (
              <PrimaryButton
                key={profile.id}
                label={profile.name}
                onPress={() => handleSelectProfile(profile.id)}
                disabled={switchingProfileId !== null || profile.id === activeProfileId}
                style={
                  profile.id === activeProfileId ? styles.activeProfileButton : styles.profileButton
                }
              />
            ))}
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
            <View style={styles.section}>
              <AppText style={styles.sectionTitle}>Heutige Bewertung</AppText>
              <AppText variant="body">{formatAssessment(output.assessment)}</AppText>
            </View>

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
  profilePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  profileButton: {
    flexGrow: 1,
  },
  activeProfileButton: {
    flexGrow: 1,
    backgroundColor: tokens.colors.surface,
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
