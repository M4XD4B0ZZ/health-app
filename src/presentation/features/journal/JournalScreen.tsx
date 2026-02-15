import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import container from '../../../infrastructure/di/container';
import { FoodEntry, DailyNutritionSummary } from '../../../features/nutrition';
import { DailyProgressSnapshot } from '../../../features/journal';

type ProcessingState = 'idle' | 'processing' | 'done' | 'error';

const JournalScreen: React.FC = () => {
  const [rawInput, setRawInput] = useState('');
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [progress, setProgress] = useState<DailyProgressSnapshot | null>(null);
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editInstruction, setEditInstruction] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Load data on mount and after changes
  useEffect(() => {
    loadJournalData();
  }, []);

  const loadJournalData = async () => {
    try {
      // Load daily summary
      const summaryData = await container.getDailySummaryUseCase.execute(today);
      setSummary(summaryData);
      setEntries(summaryData.entries);

      // Try to load progress (may fail if no goals set)
      try {
        const progressData = await container.computeProgressForDateUseCase.execute(today);
        setProgress(progressData);
      } catch (err) {
        // No goals set yet
        setProgress(null);
      }
    } catch (err) {
      console.error('Failed to load journal data:', err);
    }
  };

  const handleQuickAdd = async () => {
    if (!rawInput.trim()) return;

    setProcessingState('processing');
    setErrorMessage('');

    try {
      await container.logFoodFromRawInputUseCase.execute(rawInput, today);
      setProcessingState('done');
      setRawInput('');
      
      // Reload data
      await loadJournalData();
      
      // Reset to idle after a short delay
      setTimeout(() => setProcessingState('idle'), 1000);
    } catch (err) {
      setProcessingState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await container.deleteFoodEntryUseCase.execute(entryId);
      await loadJournalData();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const handleOpenEditModal = (entry: FoodEntry) => {
    setEditingEntry(entry);
    setEditInstruction('');
    setEditModalVisible(true);
  };

  const handleApplyEdit = async () => {
    if (!editingEntry || !editInstruction.trim()) return;

    try {
      await container.applyNaturalLanguageEditUseCase.execute(
        today,
        editingEntry.id,
        editInstruction
      );
      setEditModalVisible(false);
      setEditingEntry(null);
      setEditInstruction('');
      await loadJournalData();
    } catch (err) {
      console.error('Failed to apply edit:', err);
    }
  };

  const renderEntry = ({ item }: { item: FoodEntry }) => (
    <TouchableOpacity 
      style={styles.entryCard}
      onPress={() => handleOpenEditModal(item)}
    >
      <View style={styles.entryHeader}>
        <Text style={styles.entryName}>{item.parsedName}</Text>
        <Text style={styles.entryKcal}>{Math.round(item.calories)} kcal</Text>
      </View>
      
      <View style={styles.entryDetails}>
        <Text style={styles.entryGrams}>{item.quantityGrams}g</Text>
        <Text style={styles.entryMacros}>
          P: {Math.round(item.protein)}g | C: {Math.round(item.carbs)}g | F: {Math.round(item.fat)}g
        </Text>
      </View>
      
      {item.confidenceScore !== undefined && (
        <Text style={styles.confidenceText}>
          Confidence: {(item.confidenceScore * 100).toFixed(0)}%
          {item.confidenceReason && ` - ${item.confidenceReason}`}
        </Text>
      )}
      
      {item.explanation && (
        <Text style={styles.explanationText}>{item.explanation}</Text>
      )}
      
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteEntry(item.id)}
      >
        <Text style={styles.deleteButtonText}>Löschen</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ernährungstagebuch</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>

        {/* Progress Card (if goals exist) */}
        {progress && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Tagesfortschritt</Text>
            
            <View style={styles.caloriesRow}>
              <Text style={styles.caloriesLabel}>Kalorien verbleibend:</Text>
              <Text style={[
                styles.caloriesValue,
                progress.progress.isOverCalories && styles.overLimit
              ]}>
                {Math.round(progress.progress.remainingCalories)} kcal
              </Text>
            </View>

            {/* Progress Bars */}
            <View style={styles.progressBarsContainer}>
              <ProgressBar
                label="Kalorien"
                current={progress.consumed.calories}
                target={progress.goals.calories}
                isOver={progress.progress.isOverCalories}
              />
              <ProgressBar
                label="Protein"
                current={progress.consumed.protein}
                target={progress.goals.protein}
                isOver={progress.progress.isOverProtein}
              />
              <ProgressBar
                label="Kohlenhydrate"
                current={progress.consumed.carbs}
                target={progress.goals.carbs}
                isOver={progress.progress.isOverCarbs}
              />
              <ProgressBar
                label="Fett"
                current={progress.consumed.fat}
                target={progress.goals.fat}
                isOver={progress.progress.isOverFat}
              />
            </View>
          </View>
        )}

        {/* Quick Add Input */}
        <View style={styles.quickAddCard}>
          <Text style={styles.sectionTitle}>Schnell hinzufügen</Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="z.B. '250g Hähnchenbrust' oder '1 Apfel'"
            value={rawInput}
            onChangeText={setRawInput}
            editable={processingState !== 'processing'}
          />
          
          <TouchableOpacity 
            style={[
              styles.addButton,
              processingState === 'processing' && styles.addButtonDisabled
            ]}
            onPress={handleQuickAdd}
            disabled={processingState === 'processing'}
          >
            {processingState === 'processing' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>
                {processingState === 'done' ? '✓ Hinzugefügt' : 'Hinzufügen'}
              </Text>
            )}
          </TouchableOpacity>
          
          {processingState === 'error' && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>

        {/* Journal List */}
        <View style={styles.journalList}>
          <Text style={styles.sectionTitle}>Einträge heute</Text>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>Noch keine Einträge für heute</Text>
          ) : (
            <FlatList
              data={entries}
              renderItem={renderEntry}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Daily Summary */}
        {summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Tageszusammenfassung</Text>
            <Text style={styles.summaryKcal}>
              {Math.round(summary.totalCalories)} kcal
            </Text>
            <View style={styles.macrosRow}>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Protein</Text>
                <Text style={styles.macroValue}>{Math.round(summary.totalProtein)}g</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Kohlenhydrate</Text>
                <Text style={styles.macroValue}>{Math.round(summary.totalCarbs)}g</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Fett</Text>
                <Text style={styles.macroValue}>{Math.round(summary.totalFat)}g</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eintrag bearbeiten</Text>
            {editingEntry && (
              <Text style={styles.modalSubtitle}>{editingEntry.parsedName}</Text>
            )}
            
            <TextInput
              style={styles.modalInput}
              placeholder="z.B. '200g', 'double portion', 'half portion'"
              value={editInstruction}
              onChangeText={setEditInstruction}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleApplyEdit}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                  Anwenden
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Progress Bar Component
const ProgressBar: React.FC<{
  label: string;
  current: number;
  target: number;
  isOver: boolean;
}> = ({ label, current, target, isOver }) => {
  const percentage = Math.min((current / target) * 100, 100);
  
  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarHeader}>
        <Text style={styles.progressBarLabel}>{label}</Text>
        <Text style={[styles.progressBarText, isOver && styles.overLimit]}>
          {Math.round(current)} / {Math.round(target)}
        </Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View 
          style={[
            styles.progressBarFill,
            { width: `${percentage}%` },
            isOver && styles.progressBarFillOver
          ]} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  caloriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  caloriesLabel: {
    fontSize: 16,
    color: '#666',
  },
  caloriesValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a90e2',
  },
  overLimit: {
    color: '#e74c3c',
  },
  progressBarsContainer: {
    gap: 12,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressBarLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressBarText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
    borderRadius: 4,
  },
  progressBarFillOver: {
    backgroundColor: '#e74c3c',
  },
  quickAddCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#a0c4e8',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#e74c3c',
    marginTop: 8,
    fontSize: 14,
  },
  journalList: {
    margin: 15,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 20,
  },
  entryCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  entryKcal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a90e2',
  },
  entryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  entryGrams: {
    fontSize: 14,
    color: '#666',
  },
  entryMacros: {
    fontSize: 14,
    color: '#666',
  },
  confidenceText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  explanationText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  deleteButton: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fee',
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryKcal: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 250,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#4a90e2',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalButtonTextConfirm: {
    color: '#fff',
  },
});

export default JournalScreen;
