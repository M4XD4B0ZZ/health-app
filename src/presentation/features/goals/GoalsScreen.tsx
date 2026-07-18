import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import container from '../../../infrastructure/di/container';
import {
  MetabolismResult,
  MetabolismProfile,
  ActivityLevel,
  Sex,
  EffectiveGoals,
} from '../../../features/goals';
import { EvaluationProfile } from '../../../features/evaluation';
import { originLabel } from './goalsDisplay';
import {
  ENERGY_SECTION_TITLE,
  MAINTENANCE_LABEL,
  MAINTENANCE_EXPLANATION,
  BASAL_LABEL,
  BASAL_EXPLANATION,
  CALCULATION_DISCLOSURE_LABEL,
  INPUTS_HEADING,
  formatKcalPerDay,
  germanStepTitle,
  buildEnergyInputRows,
} from './goalsMetabolismDisplay';

const GoalsScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [metabolismResult, setMetabolismResult] = useState<MetabolismResult | null>(null);
  // GE-011: the persisted body-data inputs, read (not recomputed) for the „Eingaben" block of the
  // calculation disclosure. Kept separate from the edit-form fields below so viewing never
  // disturbs editing.
  const [profileInputs, setProfileInputs] = useState<MetabolismProfile | null>(null);
  // GE-011: the full formula/calculation path is collapsed by default (presentation-only state).
  const [calcDetailExpanded, setCalcDetailExpanded] = useState(false);
  const [effectiveGoals, setEffectiveGoals] = useState<EffectiveGoals | null>(null);

  // GE-008: "Ziel wählen" — active Evaluation Profile selection (Product Bible §4b:
  // "Evaluation Profile"/"Preset"/"Origin" stay internal; the user picks a "Ziel").
  const [zielOptions, setZielOptions] = useState<EvaluationProfile[]>([]);
  const [activeZielId, setActiveZielId] = useState<string | null>(null);
  const [switchingZielId, setSwitchingZielId] = useState<string | null>(null);

  // Profile form state
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');

  // Manual goals form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');

  useEffect(() => {
    loadGoalsData();
  }, []);

  const loadGoalsData = async () => {
    try {
      setLoading(true);

      // Try to load metabolism result
      try {
        const result = await container.computeMetabolismResultUseCase.execute();
        setMetabolismResult(result);
        // GE-011: surface the stored inputs for the disclosure's „Eingaben" block (read-only).
        setProfileInputs(await container.metabolismProfileRepository.get());
        setHasProfile(true);
      } catch {
        setHasProfile(false);
        setMetabolismResult(null);
        setProfileInputs(null);
      }

      // Try to load effective goals
      const goals = await container.effectiveGoalsRepository.get();
      setEffectiveGoals(goals);

      // GE-008: load the "Ziel" picker (registered Evaluation Profiles + active selection)
      setZielOptions(container.evaluationProfileRegistry.list());
      setActiveZielId(await container.evaluationProfileRegistry.getActiveProfileId());
    } catch (err) {
      console.error('Failed to load goals data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectZiel = async (profileId: string) => {
    if (switchingZielId || profileId === activeZielId) return;

    setSwitchingZielId(profileId);
    try {
      await container.evaluationProfileRegistry.setActiveProfileId(profileId);
      setActiveZielId(profileId);
    } catch (err) {
      console.error('Failed to switch active Ziel:', err);
    } finally {
      setSwitchingZielId(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!weightKg || !heightCm || !ageYears) {
      alert('Bitte alle Felder ausfüllen');
      return;
    }

    try {
      setLoading(true);

      await container.upsertMetabolismProfileUseCase.execute({
        weightKg: parseFloat(weightKg),
        heightCm: parseFloat(heightCm),
        ageYears: parseInt(ageYears, 10),
        sex,
        activityLevel,
      });

      await loadGoalsData();
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('Fehler beim Speichern des Profils');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestGoals = async (strategy: 'balanced' | 'high_protein') => {
    try {
      setLoading(true);

      const suggestion = await container.suggestGoalsUseCase.execute({ strategy });

      await container.setEffectiveGoalsUseCase.execute({
        mode: 'suggested',
        suggestion,
      });

      await loadGoalsData();
      setShowManualForm(false);
    } catch (err) {
      console.error('Failed to suggest goals:', err);
      alert(
        'Fehler beim Vorschlagen von Zielen. Bitte erstellen Sie zuerst ein Metabolismus-Profil.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSetManualGoals = async () => {
    if (!manualCalories || !manualProtein || !manualCarbs || !manualFat) {
      alert('Bitte alle Felder ausfüllen');
      return;
    }

    try {
      setLoading(true);

      await container.setEffectiveGoalsUseCase.execute({
        mode: 'manual',
        goals: {
          calories: parseFloat(manualCalories),
          protein: parseFloat(manualProtein),
          carbs: parseFloat(manualCarbs),
          fat: parseFloat(manualFat),
        },
      });

      await loadGoalsData();
      setShowManualForm(false);

      // Clear form
      setManualCalories('');
      setManualProtein('');
      setManualCarbs('');
      setManualFat('');
    } catch (err) {
      console.error('Failed to set manual goals:', err);
      alert('Fehler beim Speichern der manuellen Ziele');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !hasProfile && !effectiveGoals) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ziele & Profil</Text>
      </View>

      {/* GE-008: Ziel wählen — picks the active Evaluation Profile via
          container.evaluationProfileRegistry. Never renders "Profil"/"Preset"/"Origin"
          literally (Product Bible §4b) — origin is shown via originLabel(). */}
      {zielOptions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bewertungsziel</Text>
          <Text style={styles.helperText}>
            Bestimmt, wie Ihr Tag in der Auswertung bewertet wird – unabhängig von der
            Makroverteilung.
          </Text>

          <View style={styles.zielList}>
            {zielOptions.map((ziel) => {
              const isActive = ziel.id === activeZielId;
              return (
                <TouchableOpacity
                  key={ziel.id}
                  style={[styles.zielOption, isActive && styles.zielOptionActive]}
                  onPress={() => handleSelectZiel(ziel.id)}
                  disabled={switchingZielId !== null || isActive}
                >
                  <Text style={styles.zielOriginLabel}>{originLabel(ziel.origin)}</Text>
                  <Text style={[styles.zielOptionText, isActive && styles.zielOptionTextActive]}>
                    {ziel.name}
                  </Text>
                  {!!ziel.metadata.motivation && (
                    <Text style={styles.zielMotivation}>{ziel.metadata.motivation}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* GE-011: Körperdaten & Energiebedarf — actionable value first, formulas progressively disclosed */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{ENERGY_SECTION_TITLE}</Text>

        {!hasProfile ? (
          <View>
            <Text style={styles.helperText}>
              Erstellen Sie Ihr Profil, um personalisierte Ziele zu erhalten
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Gewicht (kg)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="z.B. 75"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Größe (cm)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="z.B. 180"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Alter (Jahre)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={ageYears}
                onChangeText={setAgeYears}
                placeholder="z.B. 30"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Geschlecht</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.toggleButton, sex === 'male' && styles.toggleButtonActive]}
                  onPress={() => setSex('male')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      sex === 'male' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Männlich
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, sex === 'female' && styles.toggleButtonActive]}
                  onPress={() => setSex('female')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      sex === 'female' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Weiblich
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Aktivitätslevel</Text>
              <View style={styles.buttonColumn}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    activityLevel === 'low' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setActivityLevel('low')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      activityLevel === 'low' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Niedrig (wenig Bewegung)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    activityLevel === 'moderate' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setActivityLevel('moderate')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      activityLevel === 'moderate' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Moderat (1-3x/Woche Sport)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    activityLevel === 'high' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setActivityLevel('high')}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      activityLevel === 'high' && styles.toggleButtonTextActive,
                    ]}
                  >
                    Hoch (4-7x/Woche Sport)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSaveProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Profil speichern</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {metabolismResult && (
              <>
                {/* Primary: estimated maintenance need (TDEE) — the most prominent value. */}
                <View style={styles.energyPrimaryBlock}>
                  <Text style={styles.energyPrimaryLabel}>{MAINTENANCE_LABEL}</Text>
                  <Text style={styles.energyPrimaryValue}>
                    {formatKcalPerDay(metabolismResult.tdee)}
                  </Text>
                  <Text style={styles.energyExplanation}>{MAINTENANCE_EXPLANATION}</Text>
                </View>

                {/* Secondary: Grundumsatz (BMR) — supporting value, explicitly not a target. */}
                <View style={styles.energySecondaryBlock}>
                  <Text style={styles.energySecondaryLabel}>{BASAL_LABEL}</Text>
                  <Text style={styles.energySecondaryValue}>
                    {formatKcalPerDay(metabolismResult.bmr)}
                  </Text>
                  <Text style={styles.energyExplanation}>{BASAL_EXPLANATION}</Text>
                </View>

                {/* Progressive disclosure: full formula/calculation path, collapsed by default. */}
                {metabolismResult.steps && metabolismResult.steps.length > 0 && (
                  <View style={styles.disclosureSection}>
                    <TouchableOpacity
                      style={styles.disclosureHeader}
                      onPress={() => setCalcDetailExpanded((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: calcDetailExpanded }}
                      accessibilityLabel={`${CALCULATION_DISCLOSURE_LABEL}, ${
                        calcDetailExpanded ? 'aufgeklappt' : 'eingeklappt'
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.disclosureTitle}>{CALCULATION_DISCLOSURE_LABEL}</Text>
                      <Text style={styles.disclosureChevron}>{calcDetailExpanded ? '⌄' : '›'}</Text>
                    </TouchableOpacity>

                    {calcDetailExpanded && (
                      <View style={styles.disclosureBody}>
                        {profileInputs && (
                          <View style={styles.breakdownStep}>
                            <Text style={styles.stepTitle}>{INPUTS_HEADING}</Text>
                            {buildEnergyInputRows(profileInputs).map((row) => (
                              <View key={row.label} style={styles.inputRow}>
                                <Text style={styles.inputRowLabel}>{row.label}</Text>
                                <Text style={styles.inputRowValue}>{row.value}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {metabolismResult.steps.map((step, index) => (
                          <View key={index} style={styles.breakdownStep}>
                            <Text style={styles.stepTitle}>{germanStepTitle(step.key)}</Text>
                            {step.substituted && (
                              <Text style={styles.stepFormula}>{step.substituted}</Text>
                            )}
                            {typeof step.result === 'number' && (
                              <Text style={styles.stepResult}>= {Math.round(step.result)}</Text>
                            )}
                          </View>
                        ))}
                        <Text style={styles.provenanceText}>
                          Basierend auf deinen Angaben · Formel: Mifflin-St-Jeor
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setHasProfile(false)}
                >
                  <Text style={styles.secondaryButtonText}>Körperdaten bearbeiten</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* Effective Goals Section */}
      {hasProfile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tägliche Ziele</Text>

          {effectiveGoals ? (
            <View>
              <View style={styles.currentGoals}>
                <Text style={styles.goalsLabel}>
                  Modus: {effectiveGoals.mode === 'suggested' ? 'Vorgeschlagen' : 'Manuell'}
                </Text>

                <View style={styles.goalsGrid}>
                  <View style={styles.goalItem}>
                    <Text style={styles.goalLabel}>Kalorien</Text>
                    <Text style={styles.goalValue}>
                      {Math.round(effectiveGoals.goals.calories)}
                    </Text>
                  </View>
                  <View style={styles.goalItem}>
                    <Text style={styles.goalLabel}>Protein (g)</Text>
                    <Text style={styles.goalValue}>{Math.round(effectiveGoals.goals.protein)}</Text>
                  </View>
                  <View style={styles.goalItem}>
                    <Text style={styles.goalLabel}>Kohlenhydrate (g)</Text>
                    <Text style={styles.goalValue}>{Math.round(effectiveGoals.goals.carbs)}</Text>
                  </View>
                  <View style={styles.goalItem}>
                    <Text style={styles.goalLabel}>Fett (g)</Text>
                    <Text style={styles.goalValue}>{Math.round(effectiveGoals.goals.fat)}</Text>
                  </View>
                </View>

                {effectiveGoals.mode === 'suggested' && effectiveGoals.suggestionSnapshot && (
                  <Text style={styles.rationaleText}>
                    {effectiveGoals.suggestionSnapshot.rationale}
                  </Text>
                )}
              </View>

              <Text style={styles.goalsLabel}>Makroverteilung</Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={() => handleSuggestGoals('balanced')}
                  disabled={loading}
                >
                  <Text style={styles.outlineButtonText}>Balanced</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={() => handleSuggestGoals('high_protein')}
                  disabled={loading}
                >
                  <Text style={styles.outlineButtonText}>High Protein</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={() => setShowManualForm(!showManualForm)}
                >
                  <Text style={styles.outlineButtonText}>
                    {showManualForm ? 'Abbrechen' : 'Manuell'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.helperText}>
                Wählen Sie eine Voreinstellung oder legen Sie Ihre Ziele manuell fest
              </Text>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => handleSuggestGoals('balanced')}
                  disabled={loading}
                >
                  <Text style={styles.primaryButtonText}>Balanced</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => handleSuggestGoals('high_protein')}
                  disabled={loading}
                >
                  <Text style={styles.primaryButtonText}>High Protein</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setShowManualForm(!showManualForm)}
                >
                  <Text style={styles.secondaryButtonText}>
                    {showManualForm ? 'Abbrechen' : 'Manuell'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Manual Goals Form */}
          {showManualForm && (
            <View style={styles.manualForm}>
              <Text style={styles.formTitle}>Manuelle Ziele</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Kalorien</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={manualCalories}
                  onChangeText={setManualCalories}
                  placeholder="z.B. 2000"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Protein (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={manualProtein}
                  onChangeText={setManualProtein}
                  placeholder="z.B. 150"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Kohlenhydrate (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={manualCarbs}
                  onChangeText={setManualCarbs}
                  placeholder="z.B. 200"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Fett (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={manualFat}
                  onChangeText={setManualFat}
                  placeholder="z.B. 65"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSetManualGoals}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Ziele speichern</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonColumn: {
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleButtonActive: {
    borderColor: '#4a90e2',
    backgroundColor: '#e8f4ff',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#4a90e2',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: '#4a90e2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  outlineButtonText: {
    color: '#4a90e2',
    fontSize: 14,
    fontWeight: '600',
  },
  // GE-011: prominent maintenance-need block (primary value).
  energyPrimaryBlock: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  energyPrimaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  energyPrimaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4a90e2',
    marginBottom: 6,
  },
  // GE-011: supporting Grundumsatz block (secondary value, lower visual weight).
  energySecondaryBlock: {
    marginBottom: 8,
  },
  energySecondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  energySecondaryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  energyExplanation: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  // GE-011: collapsed „So wurden die Werte berechnet" disclosure — lowest visual priority.
  disclosureSection: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    overflow: 'hidden',
  },
  disclosureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f9f9f9',
  },
  disclosureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    paddingRight: 8,
  },
  disclosureChevron: {
    fontSize: 18,
    color: '#666',
  },
  disclosureBody: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  inputRowLabel: {
    fontSize: 13,
    color: '#666',
  },
  inputRowValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  provenanceText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  breakdownStep: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepFormula: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  stepResult: {
    fontSize: 14,
    color: '#4a90e2',
    fontWeight: '500',
  },
  currentGoals: {
    marginBottom: 20,
  },
  goalsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 15,
  },
  goalItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    alignItems: 'center',
  },
  goalLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  goalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  rationaleText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 15,
  },
  manualForm: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  zielList: {
    gap: 10,
  },
  zielOption: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fff',
  },
  zielOptionActive: {
    borderColor: '#4a90e2',
    backgroundColor: '#e8f4ff',
  },
  zielOriginLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4a90e2',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  zielOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  zielOptionTextActive: {
    color: '#2b6cb0',
  },
  zielMotivation: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
});

export default GoalsScreen;
