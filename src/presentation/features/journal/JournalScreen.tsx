import React, { useState, useEffect } from 'react';
import { logResolvedNutritionInput } from '../../../features/input/application/logResolvedNutritionInput';
import { View, FlatList, StyleSheet, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import container from '../../../infrastructure/di/container';
import { FoodEntry, DailyNutritionSummary } from '../../../features/nutrition';
import { DailyProgressSnapshot } from '../../../features/journal';

// UI Components
import { tokens } from '../../../ui/theme';
import { ScreenContainer } from '../../../ui/components/ScreenContainer';
import { AppText } from '../../../ui/components/AppText';
import { InputArea } from '../../../ui/components/InputArea';
import { IconButton } from '../../../ui/components/IconButton';
import { PrimaryButton } from '../../../ui/components/PrimaryButton';
import { InlineStatus, InlineStatusState } from '../../../ui/components/InlineStatus';
import { SummaryBar } from '../../../ui/components/SummaryBar';
import { EntryRow } from '../../../ui/components/EntryRow';

const JournalScreen: React.FC = () => {
  const navigation = useNavigation();
  const [rawInput, setRawInput] = useState('');
  const [processingState, setProcessingState] = useState<InlineStatusState>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const [, setEntries] = useState<FoodEntry[]>([]);
  const [, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [, setProgress] = useState<DailyProgressSnapshot | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editInstruction, setEditInstruction] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Load data on mount and after changes
  useEffect(() => {
    loadJournalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } catch {
        // No goals set yet
        setProgress(null);
      }
    } catch (err) {
      // log and continue
      console.error('Failed to load journal data:', err);
    }
  };

  const [unresolvedItems, setUnresolvedItems] = React.useState<string[]>([]);
  const [recognizedItems, setRecognizedItems] = React.useState<{name: string; quantity: number | null; unit: string | null; kcal: number | null}[]>([]);

  const handleQuickAdd = async () => {
    if (!rawInput.trim()) return;

    setProcessingState('processing');
    setStatusMessage('Logging meal...');
    setUnresolvedItems([]);
    setRecognizedItems([]);

    try {
      const result = await logResolvedNutritionInput(rawInput);
      const persistedCount = result.persistedEntries.length;
      const unresolvedCount = result.dispatch.unresolvedRequests.length;

      setUnresolvedItems(result.dispatch.unresolvedRequests.map((req: { rawName: string }) => req.rawName));
      
      // Keep the runtime UI on the same per-item list as persistence.
      const recognizedWithKcal = result.dispatch.readyRequests.map((item, index) => {
        const persistedEntry = result.persistedEntries[index];

        return {
          name: item.rawName,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          kcal: persistedEntry?.calories ?? null, // Use null instead of 0 when no data available
        };
      });

      setRecognizedItems(recognizedWithKcal);

      if (persistedCount > 0 && unresolvedCount === 0) {
        setStatusMessage(`${persistedCount} Eintrag${persistedCount > 1 ? 'e' : ''} gespeichert`);
        setProcessingState('done');
        setRawInput('');
      } else if (persistedCount > 0 && unresolvedCount > 0) {
        setStatusMessage(`${persistedCount} Eintrag${persistedCount > 1 ? 'e' : ''} gespeichert, ${unresolvedCount} nicht erkannt`);
        setProcessingState('done'); // Partial success is still success, not error
        setRawInput('');
      } else {
        setStatusMessage('Eintrag konnte nicht verarbeitet werden');
        setProcessingState('error');
        return;
      }

      await loadJournalData();
    } catch {
      setProcessingState('error');
      setStatusMessage('Eintrag konnte nicht verarbeitet werden');
    }
  };

  // Entry deletion handler (kept for completeness). Currently unused by UI.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const handleDeleteEntry = async (entryId: string) => {
    try {
      await container.deleteFoodEntryUseCase.execute(entryId);
      await loadJournalData();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const handleApplyEdit = async () => {
    if (!editingEntry || !editInstruction.trim()) return;

    try {
      await container.applyNaturalLanguageEditUseCase.execute(
        today,
        editingEntry.id,
        editInstruction
      );
      setEditModalVisible(false);
      await loadJournalData();
    } catch (err) {
      console.error('Failed to apply edit:', err);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <InputArea
          placeholder="Was hast du gegessen?"
          value={rawInput}
          onChangeText={setRawInput}
          onSubmitEditing={handleQuickAdd}
          multiline
          blurOnSubmit
          style={styles.inputArea}
          editable={processingState !== 'processing'}
        />

        <InlineStatus state={processingState} message={statusMessage} />

        {recognizedItems.length > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Erkannte Einträge</AppText>
            <FlatList
              data={recognizedItems}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <EntryRow
                  title={item.name}
                  subtitle={item.quantity !== null && item.unit ? `${item.quantity} ${item.unit}` : undefined}
                  kcal={item.kcal}
                />
              )}
            />
          </View>
        )}

        {unresolvedItems.length > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Nicht erkannte Einträge</AppText>
            <FlatList
              data={unresolvedItems}
              keyExtractor={(item) => item}
              renderItem={({ item }) => <EntryRow title={item} kcal={null} />}
            />
          </View>
        )}

        <SummaryBar>
          {/* TODO: Render summary and progress details here if needed */}
        </SummaryBar>
      </View>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <AppText style={styles.modalTitle}>Eintrag bearbeiten</AppText>
            <InputArea
              placeholder="Bearbeitungsanweisung"
              value={editInstruction}
              onChangeText={setEditInstruction}
              multiline
              blurOnSubmit
              style={styles.inputArea}
            />
            <PrimaryButton label="Anwenden" onPress={handleApplyEdit} />
            <IconButton icon="close" onPress={() => setEditModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: tokens.colors.background,
  },
  inputArea: {
    minHeight: 120,
    borderRadius: tokens.radius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.divider,
    padding: tokens.spacing.s,
    fontSize: 16,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: tokens.colors.surface,
    padding: 20,
    borderRadius: tokens.radius.medium,
    width: '80%',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 12,
  },
});

export default JournalScreen;
