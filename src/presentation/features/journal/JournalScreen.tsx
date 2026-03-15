import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Modal } from 'react-native';
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
import { InlineStatusState } from '../../../ui/components/InlineStatus';
import { SummaryBar, MacroStack } from '../../../ui/components/SummaryBar';
import { EntryRow } from '../../../ui/components/EntryRow';

const JournalScreen: React.FC = () => {
  const navigation = useNavigation();
  const [rawInput, setRawInput] = useState('');
  const [processingState, setProcessingState] = useState<InlineStatusState>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [progress, setProgress] = useState<DailyProgressSnapshot | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editInstruction, setEditInstruction] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const SHOW_TODAYS_ENTRIES = process.env.EXPO_PUBLIC_SHOW_TODAYS_ENTRIES === 'true';

  // Load data on mount and after changes
  useEffect(() => {
    // Intentionally run once on mount. loadJournalData is stable in this component.
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

  const navigateToVoice = () => {
    // Navigation type is untyped in this file; use any to avoid linting for generic navigation
    (navigation as any).navigate('Voice');
  };

  const handleQuickAdd = async () => {
    if (!rawInput.trim()) return;

    setProcessingState('processing');
    setStatusMessage('Logging meal...');

    try {
      const createdEntries = await container.logMealFromRawInputUseCase.execute(rawInput, today);

      if (!createdEntries || createdEntries.length === 0) {
        throw new Error('Eintrag konnte nicht zugeordnet werden. (0 Kalorien)');
      }

      // Reload data instantly as requested natively
      await loadJournalData();

      setProcessingState('done');
      setStatusMessage('Added to journal.');
      setRawInput('');
    } catch (err) {
      setProcessingState('error');
      setStatusMessage(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
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
        editInstruction,
      );
      setEditModalVisible(false);
      setEditingEntry(null);
      setEditInstruction('');
      await loadJournalData();

      await loadJournalData();
    } catch (err) {
      console.error('Failed to apply edit:', err);
    }
  };

  const renderJournalEntry = ({ item }: { item: FoodEntry }) => {
    let subtitle = `${item.quantityGrams > 0 ? item.quantityGrams + 'g' : ''}`;
    let macrosStr = `P: ${Math.round(item.protein)}g C: ${Math.round(item.carbs)}g F: ${Math.round(item.fat)}g`;
    if (subtitle) subtitle += ' • ' + macrosStr;
    else subtitle = macrosStr;

    return (
      <View style={styles.entryWrapper}>
        <EntryRow
          title={item.parsedName}
          subtitle={subtitle}
          kcal={Math.round(item.calories)}
          onPress={() => handleOpenEditModal(item)}
        />
        <View style={styles.entryExtras}>
          <AppText variant="meta" tone="muted">
            P: {Math.round(item.protein)}g C: {Math.round(item.carbs)}g F: {Math.round(item.fat)}g
          </AppText>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer scroll>
      {/* Top Section */}
      <View style={styles.header}>
        <AppText variant="title">Log Food</AppText>
      </View>

      {/* Dominant Interaction Area */}
      <InputArea
        multiline
        placeholder="What did you eat? (e.g., '2 scrambled eggs and a slice of toast')"
        value={rawInput}
        onChangeText={setRawInput}
        editable={processingState !== 'processing'}
      />

      {/* Actions tightly bound to the input */}
      <View style={styles.actionsRow}>
        <View style={styles.iconRow}>
          <IconButton icon="mic" onPress={navigateToVoice} />
          {/* <IconButton icon="camera" /> // Removed camera for now until feature is ready */}
        </View>
        <PrimaryButton
          label="Submit"
          onPress={handleQuickAdd}
          disabled={processingState === 'processing' || !rawInput.trim()}
        />
      </View>

      {processingState === 'processing' && statusMessage !== '' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: tokens.spacing.s,
            minHeight: 24,
          }}
        >
          <ActivityIndicator
            size="small"
            color={tokens.colors.textMuted}
            style={{ marginRight: tokens.spacing.xs }}
          />
          <AppText variant="meta" tone="muted">
            {statusMessage}
          </AppText>
        </View>
      )}
      {processingState === 'error' && statusMessage !== '' && (
        <View style={{ alignItems: 'center', marginTop: tokens.spacing.s, minHeight: 24 }}>
          <AppText variant="meta" tone="danger">
            {statusMessage}
          </AppText>
        </View>
      )}
      {processingState === 'done' && statusMessage !== '' && (
        <View style={{ alignItems: 'center', marginTop: tokens.spacing.s, minHeight: 24 }}>
          <AppText variant="meta" tone="primary">
            {statusMessage}
          </AppText>
        </View>
      )}

      {/* Spacer to push things down gracefully */}
      <View style={styles.spacerLarge} />

      {/* Daily Summary using Subdued Styling */}
      {progress && summary && (
        <SummaryBar>
          <View style={styles.summaryLeft}>
            <AppText variant="meta">Remaining</AppText>
            <View style={styles.valGroup}>
              <AppText
                variant="numeric"
                tone={progress.progress.isOverCalories ? 'danger' : 'primary'}
              >
                {Math.round(progress.progress.remainingCalories)}
              </AppText>
              <AppText variant="meta">kcal</AppText>
            </View>
          </View>

          <View style={styles.macrosGroup}>
            <MacroStack label="PRO" value={`${Math.round(summary.totalProtein)}g`} />
            <MacroStack label="CARB" value={`${Math.round(summary.totalCarbs)}g`} />
            <MacroStack label="FAT" value={`${Math.round(summary.totalFat)}g`} />
          </View>
        </SummaryBar>
      )}

      {/* Journal List (Hidden unless DEV flag is set during Phase 0) */}
      {SHOW_TODAYS_ENTRIES && (
        <View style={styles.journalListContainer}>
          <AppText variant="meta" tone="muted" style={styles.sectionTitle}>
            Today's Entries
          </AppText>
          {entries.length === 0 ? (
            <AppText variant="body" tone="muted" style={styles.emptyText}>
              No entries yet today.
            </AppText>
          ) : (
            <FlatList
              data={entries}
              renderItem={renderJournalEntry}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      )}

      {/* Edit Modal (adapting to clean styling) */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <AppText variant="title" style={styles.modalTitle}>
              Edit Entry
            </AppText>
            {editingEntry && (
              <AppText variant="body" tone="muted">
                {editingEntry.parsedName}
              </AppText>
            )}

            <InputArea
              style={{ minHeight: 80, marginTop: tokens.spacing.m, marginBottom: tokens.spacing.l }}
              placeholder="e.g. 'double portion', '100g only'"
              value={editInstruction}
              onChangeText={setEditInstruction}
            />

            <View style={styles.modalButtons}>
              <PrimaryButton
                label="Cancel"
                onPress={() => setEditModalVisible(false)}
                style={[styles.flexButton, { backgroundColor: tokens.colors.surface }] as any}
                // A bit of a hack to pass disabled styles to look like un-accented button
              />
              <View style={{ width: tokens.spacing.s }} />
              <PrimaryButton label="Apply" onPress={handleApplyEdit} style={styles.flexButton} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: tokens.spacing.m,
    paddingBottom: tokens.spacing.l,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.s,
  },
  iconRow: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  spacerLarge: {
    height: tokens.spacing.xl,
  },
  summaryLeft: {
    flex: 1,
  },
  valGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.spacing.xs,
  },
  macrosGroup: {
    flexDirection: 'row',
    gap: tokens.spacing.m,
  },
  journalListContainer: {
    marginTop: tokens.spacing.xl,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.s,
  },
  emptyText: {
    marginTop: tokens.spacing.s,
    fontStyle: 'italic',
  },
  entryWrapper: {
    marginBottom: tokens.spacing.s,
  },
  entryExtras: {
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.s,
  },

  // Modals Overlay unified
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 40, 37, 0.4)', // Uses dark charcoal base for overlay
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.radius.medium,
    borderTopRightRadius: tokens.radius.medium,
    padding: tokens.spacing.m,
    paddingBottom: tokens.spacing.xl,
  },
  modalTitle: {
    marginBottom: tokens.spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: tokens.spacing.l,
  },
  flexButton: {
    flex: 1,
  },
});

export default JournalScreen;
