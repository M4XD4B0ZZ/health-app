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
import { useNavigation, NavigationProp } from '@react-navigation/native';
import container from '../../../infrastructure/di/container';
import { FoodEntry, DailyNutritionSummary } from '../../../features/nutrition';
import { DailyProgressSnapshot } from '../../../features/journal';
import { RootTabParamList } from '../../navigation/AppNavigator';

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

const JournalScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const [rawInput, setRawInput] = useState('');
  const [processingState, setProcessingState] = useState<InlineStatusState>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [progress, setProgress] = useState<DailyProgressSnapshot | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editInstruction, setEditInstruction] = useState('');

  // Sprint 5.5: Review Bottom Sheet State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewEntries, setReviewEntries] = useState<FoodEntry[]>([]);

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

  const navigateToVoice = () => {
    navigation.navigate('Voice');
  };

  const handleQuickAdd = async () => {
    if (!rawInput.trim()) return;

    setProcessingState('processing');
    setStatusMessage('Logging meal...');

    try {
      // Sprint 5.5: Use LogMealFromRawInputUseCase (multi-item)
      const createdEntries = await container.logMealFromRawInputUseCase.execute(rawInput, today);

      // Reload data instantly as requested natively
      await loadJournalData();

      setProcessingState('done');
      setStatusMessage('Added to journal.');
      setRawInput('');

      // Sprint 5.5: Determine if Review Sheet should be shown
      const shouldShowReview = shouldShowReviewSheet(createdEntries);

      if (shouldShowReview) {
        setReviewEntries(createdEntries);
        setReviewModalVisible(true);
      }
    } catch (err) {
      setProcessingState('error');
      setStatusMessage(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    }
  };

  const shouldShowReviewSheet = (createdEntries: FoodEntry[]): boolean => {
    if (createdEntries.length >= 2) return true;
    return createdEntries.some((entry) => entry.confidenceScore < 0.7 || entry.sourceType === 'ai');
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
        editInstruction,
      );
      setEditModalVisible(false);
      setEditingEntry(null);
      setEditInstruction('');
      await loadJournalData();

      if (reviewModalVisible) {
        const updatedSummary = await container.getDailySummaryUseCase.execute(today);
        const updatedReviewEntries = reviewEntries.map(
          (re) => updatedSummary.entries.find((e) => e.id === re.id) || re,
        );
        setReviewEntries(updatedReviewEntries);
      }
    } catch (err) {
      console.error('Failed to apply edit:', err);
    }
  };

  const handleDeleteFromReview = async (entryId: string) => {
    try {
      await container.deleteFoodEntryUseCase.execute(entryId);

      const updatedReviewEntries = reviewEntries.filter((e) => e.id !== entryId);
      setReviewEntries(updatedReviewEntries);

      await loadJournalData();

      if (updatedReviewEntries.length === 0) {
        setReviewModalVisible(false);
      }
    } catch (err) {
      console.error('Failed to delete entry from review:', err);
    }
  };

  const handleEditFromReview = (entry: FoodEntry) => {
    setEditingEntry(entry);
    setEditInstruction('');
    setEditModalVisible(true);
  };

  const handleConfirmReview = () => {
    setReviewModalVisible(false);
    setReviewEntries([]);
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
          {item.confidenceScore !== undefined && (
            <AppText variant="meta" tone="muted">
              Conf: {(item.confidenceScore * 100).toFixed(0)}%
              {item.confidenceReason && ` - ${item.confidenceReason}`}
            </AppText>
          )}
          {item.explanation && (
            <AppText variant="meta" tone="muted">{item.explanation}</AppText>
          )}
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

      <InlineStatus state={processingState} message={statusMessage} />

      {/* Spacer to push things down gracefully */}
      <View style={styles.spacerLarge} />

      {/* Daily Summary using Subdued Styling */}
      {progress && summary && (
        <SummaryBar>
          <View style={styles.summaryLeft}>
            <AppText variant="meta">Remaining</AppText>
            <View style={styles.valGroup}>
              <AppText variant="numeric" tone={progress.progress.isOverCalories ? 'danger' : 'primary'}>
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

      {/* Journal List */}
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

      {/* Review Bottom Sheet Overlay (keeping standard RN modal for now, adapting styling) */}
      <Modal visible={reviewModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.reviewModalContent}>
            <AppText variant="title" style={styles.modalTitle}>Review Entries</AppText>
            <AppText variant="body" tone="muted" style={{ marginBottom: tokens.spacing.m }}>
              Please review your mapped foods.
            </AppText>

            <ScrollView style={styles.reviewList}>
              {reviewEntries.map((entry) => (
                <View key={entry.id} style={styles.reviewCard}>
                  <View style={styles.reviewRowFlex}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="body">{entry.parsedName}</AppText>
                      <AppText variant="meta" tone="muted">
                        P: {Math.round(entry.protein)}g C: {Math.round(entry.carbs)}g F: {Math.round(entry.fat)}g
                      </AppText>
                    </View>
                    <AppText variant="numeric">{Math.round(entry.calories)}</AppText>
                  </View>

                  <View style={styles.reviewActions}>
                    <TouchableOpacity onPress={() => handleEditFromReview(entry)} style={{ marginRight: tokens.spacing.m }}>
                      <AppText variant="meta" tone="accent">EDIT</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteFromReview(entry.id)}>
                      <AppText variant="meta" tone="danger">DELETE</AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <PrimaryButton label="Confirm All" onPress={handleConfirmReview} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal (adapting to clean styling) */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <AppText variant="title" style={styles.modalTitle}>Edit Entry</AppText>
            {editingEntry && <AppText variant="body" tone="muted">{editingEntry.parsedName}</AppText>}

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
              <PrimaryButton
                label="Apply"
                onPress={handleApplyEdit}
                style={styles.flexButton}
              />
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
  reviewModalContent: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.radius.medium,
    borderTopRightRadius: tokens.radius.medium,
    padding: tokens.spacing.m,
    paddingBottom: tokens.spacing.xl,
    maxHeight: '80%',
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
  reviewList: {
    maxHeight: 400,
  },
  reviewCard: {
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.m,
    borderRadius: tokens.radius.medium,
    marginBottom: tokens.spacing.s,
  },
  reviewRowFlex: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.s,
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.divider,
    paddingTop: tokens.spacing.s,
    marginTop: tokens.spacing.xs,
  }
});

export default JournalScreen;
