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
import { MetabolismResult, ActivityLevel, Sex, EffectiveGoals } from '../../../features/goals';

const GoalsScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [metabolismResult, setMetabolismResult] = useState<MetabolismResult | null>(null);
  const [effectiveGoals, setEffectiveGoals] = useState<EffectiveGoals | null>(null);

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
        setHasProfile(true);
      } catch {
        setHasProfile(false);
        setMetabolismResult(null);
      }

      // Try to load effective goals
      const goals = await container.effectiveGoalsRepository.get();
      setEffectiveGoals(goals);
    } catch (err) {
      console.error('Failed to load goals data:', err);
    } finally {
      setLoading(false);
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

      {/* Metabolism Profile Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Metabolismus-Profil</Text>

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
                <View style={styles.metabolismResults}>
                  <View style={styles.metabolismRow}>
                    <Text style={styles.metabolismLabel}>Grundumsatz (BMR):</Text>
                    <Text style={styles.metabolismValue}>
                      {Math.round(metabolismResult.bmr)} kcal/Tag
                    </Text>
                  </View>
                  <View style={styles.metabolismRow}>
                    <Text style={styles.metabolismLabel}>Gesamtumsatz (TDEE):</Text>
                    <Text style={styles.metabolismValue}>
                      {Math.round(metabolismResult.tdee)} kcal/Tag
                    </Text>
                  </View>
                </View>

                {/* Breakdown Steps */}
                {metabolismResult.steps && metabolismResult.steps.length > 0 && (
                  <View style={styles.breakdownSection}>
                    <Text style={styles.breakdownTitle}>Berechnungs-Details:</Text>
                    {metabolismResult.steps.map((step, index) => (
                      <View key={index} style={styles.breakdownStep}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        {step.substituted && (
                          <Text style={styles.stepFormula}>{step.substituted}</Text>
                        )}
                        <Text style={styles.stepResult}>
                          ={' '}
                          {typeof step.result === 'number' ? Math.round(step.result) : step.result}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setHasProfile(false)}
                >
                  <Text style={styles.secondaryButtonText}>Profil bearbeiten</Text>
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
  metabolismResults: {
    marginBottom: 20,
  },
  metabolismRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  metabolismLabel: {
    fontSize: 16,
    color: '#666',
  },
  metabolismValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4a90e2',
  },
  breakdownSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
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
});

export default GoalsScreen;
