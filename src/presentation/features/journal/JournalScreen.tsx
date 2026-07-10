import React, { useState, useEffect, useRef } from 'react';
import { logResolvedNutritionInput } from '../../../features/input/application/logResolvedNutritionInput';
import type { PortionNeedsEditItem } from '../../../features/nutrition/domain/portion/PortionNeedsEdit';
import { View, StyleSheet, Modal } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useNavigation } from '@react-navigation/native';
import container from '../../../infrastructure/di/container';
import { FoodEntry, DailyNutritionSummary } from '../../../features/nutrition';

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
import { claimJournalSubmitSlot } from './claimJournalSubmitSlot';
import { buildFoodEntryDisplay, groupJournalEntries } from './journalEntryDisplay';

const formatCalories = (value: number) => Math.round(value).toString();
const formatMacroGrams = (value: number) => `${Math.round(value)}g`;
const LOCAL_PORTION_HINT_USER_ID = 'local-user';

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

function formatPortionUnitLabel(unit: PortionNeedsEditItem['unit']) {
  return unit === 'slice' ? 'Scheibe' : 'Stück';
}

function parsePositiveNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const JournalScreen: React.FC = () => {
  // const navigation = useNavigation();
  const [rawInput, setRawInput] = useState('');
  const submitInFlightRef = useRef(false);
  const [processingState, setProcessingState] = useState<InlineStatusState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [trustMessage, setTrustMessage] = useState('');

  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [manualPortionItem, setManualPortionItem] = useState<PortionNeedsEditItem | null>(null);
  const [manualTotalGrams, setManualTotalGrams] = useState('');
  const [portionActionInFlight, setPortionActionInFlight] = useState(false);

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
    } catch (err) {
      // log and continue
      console.error('Failed to load journal data:', err);
    }
  };

  const [unresolvedItems, setUnresolvedItems] = React.useState<string[]>([]);
  const [portionNeedsEditItems, setPortionNeedsEditItems] = React.useState<PortionNeedsEditItem[]>(
    [],
  );
  const [recognizedItems, setRecognizedItems] = React.useState<
    { name: string; quantity: number | null; unit: string | null; kcal: number | null }[]
  >([]);
  // J-005: visible, undoable notification for a silent same-food auto-merge.
  const [autoMergeNotice, setAutoMergeNotice] = React.useState<{
    entryId: string;
    previousValues: FoodEntry;
  } | null>(null);
  const [undoInFlight, setUndoInFlight] = useState(false);

  const clearFeedback = () => {
    setProcessingState('idle');
    setStatusMessage('');
    setTrustMessage('');
  };

  const clearSubmitFeedback = () => {
    setStatusMessage('');
    setTrustMessage('');
    setUnresolvedItems([]);
    setPortionNeedsEditItems([]);
    setRecognizedItems([]);
    setAutoMergeNotice(null);
  };

  const handleRawInputChange = (text: string) => {
    setRawInput(text);

    if (processingState === 'done' || processingState === 'error') {
      clearFeedback();
    }
  };

  const submitRawInput = async (
    inputToSubmit: string,
    options: { clearRawInputOnSuccess?: boolean } = { clearRawInputOnSuccess: true },
  ) => {
    clearSubmitFeedback();
    setProcessingState('processing');
    setStatusMessage('Logging meal...');

    const result = await logResolvedNutritionInput(inputToSubmit);
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
    setPortionNeedsEditItems(result.needsEditItems);

    // J-005: surface the first auto-merge (if any) as a visible, undoable notification.
    const mergedEntry = result.persistedEntries.find((entry) => entry.autoMergeInfo);
    setAutoMergeNotice(
      mergedEntry?.autoMergeInfo
        ? { entryId: mergedEntry.id, previousValues: mergedEntry.autoMergeInfo.previousValues }
        : null,
    );

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
      setStatusMessage(
        result.needsEditItems.length > 0
          ? 'Portionsgewicht fehlt'
          : 'Eintrag konnte nicht verarbeitet werden',
      );
      setTrustMessage(nextTrustMessage);
      setProcessingState('error');
      return;
    }

    if (persistedCount > 0 && unresolvedCount === 0) {
      setStatusMessage(`${persistedCount} Eintrag${persistedCount > 1 ? 'e' : ''} gespeichert`);
      setTrustMessage('');
      setProcessingState('done');
      if (options.clearRawInputOnSuccess) {
        setRawInput('');
      }
    } else if (persistedCount > 0 && unresolvedCount > 0) {
      setStatusMessage(
        `${persistedCount} Eintrag${persistedCount > 1 ? 'e' : ''} gespeichert, ${unresolvedCount} nicht erkannt`,
      );
      setTrustMessage(nextTrustMessage);
      setProcessingState('done'); // Partial success is still success, not error
      if (options.clearRawInputOnSuccess) {
        setRawInput('');
      }
    } else {
      setStatusMessage('Nicht erkannt — bitte genauer eingeben');
      setTrustMessage(nextTrustMessage);
      setProcessingState('error');
      return;
    }

    await loadJournalData();
  };

  const handleUndoAutoMerge = async () => {
    if (!autoMergeNotice || undoInFlight) return;

    setUndoInFlight(true);
    try {
      await container.undoAutoMergeUseCase.execute(
        autoMergeNotice.entryId,
        autoMergeNotice.previousValues,
      );
      setAutoMergeNotice(null);
      await loadJournalData();
    } catch (err) {
      console.error('Failed to undo auto-merge:', err);
    } finally {
      setUndoInFlight(false);
    }
  };

  const handleQuickAdd = async () => {
    const inputToSubmit = rawInput.trim();

    if (!inputToSubmit || !claimJournalSubmitSlot(submitInFlightRef)) return;

    try {
      await submitRawInput(inputToSubmit, { clearRawInputOnSuccess: true });
    } catch {
      setProcessingState('error');
      setStatusMessage('Eintrag konnte nicht verarbeitet werden');
      setTrustMessage('Es wurde nichts gespeichert und es wurden keine Nährwerte geschätzt.');
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const savePortionHintAndRetry = async (item: PortionNeedsEditItem, gramsPerUnit: number) => {
    if (!item.foodIdentityKey || portionActionInFlight) return;

    setPortionActionInFlight(true);
    try {
      const now = new Date().toISOString();
      await container.portionKnowledgeService.confirmUserPrivateHint({
        foodIdentityKey: item.foodIdentityKey,
        unit: item.unit,
        gramsPerUnit,
        userId: LOCAL_PORTION_HINT_USER_ID,
        confidence: 0.6,
        reviewStatus: 'pending',
        now,
      });

      await submitRawInput(item.rawInput, { clearRawInputOnSuccess: false });
      setManualPortionItem(null);
      setManualTotalGrams('');
    } catch (err) {
      console.error('Failed to save portion hint and retry input:', err);
      setProcessingState('error');
      setStatusMessage('Portionsgewicht konnte nicht gespeichert werden');
      setTrustMessage('Es wurde nichts gespeichert. Bitte Grammangabe erneut prüfen.');
    } finally {
      setPortionActionInFlight(false);
    }
  };

  const handleUseEstimatedPortion = async (item: PortionNeedsEditItem) => {
    if (!item.suggestedGramsPerUnit) return;
    await savePortionHintAndRetry(item, item.suggestedGramsPerUnit);
  };

  const handleOpenManualPortion = (item: PortionNeedsEditItem) => {
    setManualPortionItem(item);
    setManualTotalGrams('');
  };

  const handleCloseManualPortion = () => {
    setManualPortionItem(null);
    setManualTotalGrams('');
  };

  const handleConfirmManualPortion = async () => {
    if (!manualPortionItem || manualPortionItem.quantity <= 0) return;

    const totalGrams = parsePositiveNumber(manualTotalGrams);
    if (!totalGrams) {
      setStatusMessage('Bitte gültige Grammzahl eingeben');
      setProcessingState('error');
      return;
    }

    await savePortionHintAndRetry(manualPortionItem, totalGrams / manualPortionItem.quantity);
  };

  const handleReinsertUnresolvedItems = () => {
    if (unresolvedItems.length === 0) return;

    setRawInput(unresolvedItems.join(' und '));
    clearFeedback();
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
    <ScreenContainer scroll>
      <View style={styles.container}>
        <InputArea
          placeholder="Was hast du gegessen?"
          value={rawInput}
          onChangeText={handleRawInputChange}
          onSubmitEditing={handleQuickAdd}
          multiline
          blurOnSubmit
          style={styles.inputArea}
          editable={processingState !== 'processing'}
        />

        <InlineStatus state={processingState} message={statusMessage} />

        {!!trustMessage && <AppText style={styles.trustMessage}>{trustMessage}</AppText>}

        {autoMergeNotice && (
          <View style={styles.autoMergeNotice}>
            <AppText variant="meta" tone="muted" style={styles.autoMergeNoticeText}>
              Mit vorherigem Eintrag zusammengeführt
            </AppText>
            <PrimaryButton
              label="Rückgängig"
              onPress={handleUndoAutoMerge}
              disabled={undoInFlight}
              style={styles.autoMergeNoticeButton}
            />
          </View>
        )}

        {recognizedItems.length > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Erkannte Einträge</AppText>
            {recognizedItems.map((item) => (
              <EntryRow
                key={item.name}
                title={item.name}
                subtitle={
                  item.quantity !== null && item.unit ? `${item.quantity} ${item.unit}` : undefined
                }
                kcal={item.kcal}
              />
            ))}
          </View>
        )}

        {portionNeedsEditItems.length > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Portionsgewicht fehlt</AppText>
            {portionNeedsEditItems.map((item) => (
              <View
                key={`${item.rawInput}:${item.unit}:${item.quantity}`}
                style={styles.portionPrompt}
              >
                <EntryRow
                  title={item.displayName}
                  subtitle={`${item.quantity} ${item.unit} · ${item.message}`}
                  kcal={null}
                />
                <View style={styles.portionActions}>
                  <PrimaryButton
                    label={`${item.suggestedGramsPerUnit ?? 60}g pro ${formatPortionUnitLabel(item.unit)} verwenden`}
                    onPress={() => handleUseEstimatedPortion(item)}
                    disabled={portionActionInFlight || !item.foodIdentityKey}
                    style={styles.portionActionButton}
                  />
                  <PrimaryButton
                    label="Gramm eingeben"
                    onPress={() => handleOpenManualPortion(item)}
                    disabled={portionActionInFlight || !item.foodIdentityKey}
                    style={styles.portionActionButton}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {unresolvedItems.length > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Nicht erkannte Einträge</AppText>
            {unresolvedItems.map((item) => (
              <EntryRow key={item} title={item} kcal={null} />
            ))}
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
            groupJournalEntries(persistedDailyEntries).map((listItem) => {
              if (listItem.kind === 'entry') {
                const display = buildFoodEntryDisplay(listItem.entry);

                return (
                  <EntryRow
                    key={listItem.entry.id}
                    title={display.title}
                    subtitle={display.subtitle}
                    kcal={listItem.entry.calories}
                    onPress={() => handleOpenEdit(listItem.entry)}
                    actionLabel="Löschen"
                    onActionPress={() => handleDeleteEntry(listItem.entry.id)}
                  />
                );
              }

              return (
                <View key={listItem.groupId} style={styles.group}>
                  <EntryRow
                    title={listItem.label}
                    subtitle={`${listItem.children.length} Zutaten`}
                    kcal={listItem.totalCalories}
                    style={styles.groupHeader}
                  />
                  {listItem.children.map((child) => {
                    const display = buildFoodEntryDisplay(child);

                    return (
                      <EntryRow
                        key={child.id}
                        title={display.title}
                        subtitle={display.subtitle}
                        kcal={child.calories}
                        onPress={() => handleOpenEdit(child)}
                        actionLabel="Löschen"
                        onActionPress={() => handleDeleteEntry(child.id)}
                        style={styles.groupChild}
                      />
                    );
                  })}
                </View>
              );
            })
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

      <Modal visible={manualPortionItem !== null} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <AppText style={styles.modalTitle}>Gramm eingeben</AppText>
            <AppText style={styles.trustMessage}>
              {manualPortionItem
                ? `Wie viel wiegen ${manualPortionItem.quantity} ${manualPortionItem.displayName} insgesamt?`
                : ''}
            </AppText>
            <InputArea
              placeholder="Gesamtgewicht in g"
              value={manualTotalGrams}
              onChangeText={setManualTotalGrams}
              blurOnSubmit
              style={styles.inputArea}
            />
            <PrimaryButton
              label="Speichern und Eintrag übernehmen"
              onPress={handleConfirmManualPortion}
              disabled={portionActionInFlight}
            />
            <IconButton icon="close" onPress={handleCloseManualPortion} />
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
  group: {
    marginBottom: tokens.spacing.xs,
  },
  groupHeader: {
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.s,
    borderRadius: tokens.radius.medium,
  },
  groupChild: {
    paddingLeft: tokens.spacing.l,
  },
  trustMessage: {
    marginTop: 8,
    color: tokens.colors.textMuted,
  },
  autoMergeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: tokens.spacing.s,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.medium,
  },
  autoMergeNoticeText: {
    flex: 1,
  },
  autoMergeNoticeButton: {
    marginLeft: tokens.spacing.s,
  },
  correctionButton: {
    marginTop: 8,
  },
  portionPrompt: {
    marginBottom: tokens.spacing.s,
  },
  portionActions: {
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  portionActionButton: {
    alignSelf: 'stretch',
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
