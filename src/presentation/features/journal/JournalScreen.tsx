import React, { useState, useEffect } from 'react';
import { logResolvedNutritionInput } from '../../../features/input/application/logResolvedNutritionInput';
import { View, FlatList, StyleSheet, Modal } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
import { SummaryBar, MacroStack } from '../../../ui/components/SummaryBar';
import { EntryRow } from '../../../ui/components/EntryRow';

const formatCalories = (value: number) => Math.round(value).toString();
const formatMacroGrams = (value: number) => `${Math.round(value)}g`;

const buildEntrySubtitle = (entry: FoodEntry) => {
  const grams = entry.grams ?? entry.quantityGrams;

  if (!grams || grams <= 0) {
    return undefined;
  }

  return `${Math.round(grams)} g`;
};

function buildTrustMessage(
  confidenceReason: string,
  persistedCount: number,
  unresolvedCount: number,
) {
  if (persistedCount > 0 && unresolvedCount > 0) {
    return 'Teilweise erkannt: Gespeicherte Einträge wurden übernommen; nicht erkannte Einträge wurden nicht geschätzt.';
  }

  if (unresolvedCount > 0) {
    return 'Es wurde nichts gespeichert und es wurden keine Nährwerte geschätzt.';
  }

  if (confidenceReason === 'all_items_matched' && persistedCount > 0) {
    return 'Alle erkannten Einträge wurden gespeichert.';
  }

  if (confidenceReason === 'no_items' || confidenceReason === 'no_items_matched') {
    return 'Zu ungenau — bitte Lebensmittel oder Menge genauer angeben.';
  }

  return '';
}

const JournalScreen: React.FC = () => {
  // const navigation = useNavigation();
  const [rawInput, setRawInput] = useState('');
  const [processingState, setProcessingState] = useState<InlineStatusState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [trustMessage, setTrustMessage] = useState('');

  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
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
  const [recognizedItems, setRecognizedItems] = React.useState<
    { name: string; quantity: number | null; unit: string | null; kcal: number | null }[]
  >([]);

  const handleQuickAdd = async () => {
    if (!rawInput.trim()) return;

    setProcessingState('processing');
    setStatusMessage('Logging meal...');
    setTrustMessage('');
    setUnresolvedItems([]);
    setRecognizedItems([]);

    try {
      const result = await logResolvedNutritionInput(rawInput);
      const persistedCount = result.persistedEntries.length;
      const unresolvedCount = result.dispatch.unresolvedRequests.length;
      const blockedCount = result.blockedEntries;
      const nextTrustMessage = buildTrustMessage(
        result.dispatch.confidence.reason,
        persistedCount,
        unresolvedCount,
      );

      setUnresolvedItems(
        result.dispatch.unresolvedRequests.map((req: { rawName: string }) => req.rawName),
      );
      setTrustMessage(nextTrustMessage);

      const remainingPersistedEntries = [...result.persistedEntries];

      // Keep the runtime UI on the same per-item list as persistence without relying only on array index.
      const recognizedWithKcal = result.dispatch.readyRequests.map((item, index) => {
        const persistedEntryIndex = remainingPersistedEntries.findIndex(
          (entry) => entry.rawInput.toLowerCase() === item.rawName.toLowerCase(),
        );
        const persistedEntry =
          persistedEntryIndex >= 0
            ? remainingPersistedEntries.splice(persistedEntryIndex, 1)[0]
            : result.persistedEntries[index];

        return {
          name: item.rawName,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          kcal: persistedEntry?.calories ?? null, // Use null instead of 0 when no data available
        };
      });

      setRecognizedItems(recognizedWithKcal);

      if (blockedCount > 0) {
        setStatusMessage('Eintrag konnte nicht verarbeitet werden');
        setProcessingState('error');
        return;
      }

      if (persistedCount > 0 && unresolvedCount === 0) {
        setStatusMessage(`${persistedCount} Eintrag${persistedCount > 1 ? 'e' : ''} gespeichert`);
        setProcessingState('done');
        setRawInput('');
      } else if (persistedCount > 0 && unresolvedCount > 0) {
        setStatusMessage(
          `${persistedCount} Eintrag${persistedCount > 1 ? 'e' : ''} gespeichert, ${unresolvedCount} nicht erkannt`,
        );
        setProcessingState('done'); // Partial success is still success, not error
        setRawInput('');
      } else {
        setStatusMessage('Nicht erkannt — bitte genauer eingeben');
        setProcessingState('error');
        return;
      }

      await loadJournalData();
    } catch {
      setProcessingState('error');
      setStatusMessage('Eintrag konnte nicht verarbeitet werden');
      setTrustMessage('Es wurde nichts gespeichert und es wurden keine Nährwerte geschätzt.');
    }
  };

  const handleReinsertUnresolvedItems = () => {
    if (unresolvedItems.length === 0) return;

    setRawInput(unresolvedItems.join(' und '));
    setProcessingState('idle');
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await container.deleteFoodEntryUseCase.execute(entryId);
      await loadJournalData();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const handleOpenEdit = (entry: FoodEntry) => {
    setEditingEntry(entry);
    setEditInstruction('');
    setEditModalVisible(true);
  };

  const handleCloseEdit = () => {
    setEditModalVisible(false);
    setEditingEntry(null);
    setEditInstruction('');
  };

  const handleApplyEdit = async () => {
    if (!editingEntry || !editInstruction.trim()) return;

    try {
      await container.editFoodEntryFromNaturalLanguageUseCase.execute(
        editingEntry.id,
        editInstruction,
      );
      handleCloseEdit();
      await loadJournalData();
    } catch (err) {
      console.error('Failed to apply edit:', err);
    }
  };

  const persistedDailyEntries = entries.filter((entry) => entry.calories > 0);

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

        {!!trustMessage && <AppText style={styles.trustMessage}>{trustMessage}</AppText>}

        {recognizedItems.length > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Erkannte Einträge</AppText>
            <FlatList
              data={recognizedItems}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <EntryRow
                  title={item.name}
                  subtitle={
                    item.quantity !== null && item.unit
                      ? `${item.quantity} ${item.unit}`
                      : undefined
                  }
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
            <PrimaryButton
              label="Nicht erkannte bearbeiten"
              onPress={handleReinsertUnresolvedItems}
              disabled={processingState === 'processing'}
              style={styles.correctionButton}
            />
          </View>
        )}

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Heutige Einträge</AppText>
          {persistedDailyEntries.length > 0 ? (
            <FlatList
              data={persistedDailyEntries}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <EntryRow
                  title={item.rawInput || item.parsedName}
                  subtitle={buildEntrySubtitle(item)}
                  kcal={item.calories}
                  onPress={() => handleOpenEdit(item)}
                  actionLabel="Löschen"
                  onActionPress={() => handleDeleteEntry(item.id)}
                />
              )}
            />
          ) : (
            <AppText tone="muted">Noch keine gespeicherten Einträge für heute.</AppText>
          )}
        </View>

        <SummaryBar style={styles.summaryBar}>
          <View style={styles.summaryLeft}>
            <AppText variant="meta">Heute gesamt</AppText>
            <View style={styles.calorieTotalGroup}>
              <AppText variant="numeric">{formatCalories(summary?.totalCalories ?? 0)}</AppText>
              <AppText variant="meta">kcal</AppText>
            </View>
          </View>

          <View style={styles.macrosGroup}>
            <MacroStack label="PRO" value={formatMacroGrams(summary?.totalProtein ?? 0)} />
            <MacroStack label="CARB" value={formatMacroGrams(summary?.totalCarbs ?? 0)} />
            <MacroStack label="FAT" value={formatMacroGrams(summary?.totalFat ?? 0)} />
          </View>
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
            <IconButton icon="close" onPress={handleCloseEdit} />
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
  trustMessage: {
    marginTop: 8,
    color: tokens.colors.textMuted,
  },
  correctionButton: {
    marginTop: 8,
  },
  summaryBar: {
    marginTop: 16,
  },
  summaryLeft: {
    flex: 1,
  },
  calorieTotalGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.spacing.xs,
  },
  macrosGroup: {
    flexDirection: 'row',
    gap: tokens.spacing.m,
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
