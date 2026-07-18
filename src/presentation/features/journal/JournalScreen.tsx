import React, { useState, useCallback, useRef, useEffect } from 'react';
import { logResolvedNutritionInput } from '../../../features/input/application/logResolvedNutritionInput';
import type { PortionNeedsEditItem } from '../../../features/nutrition/domain/portion/PortionNeedsEdit';
import { resolveFoodIdentityKey } from '../../../features/nutrition/domain/portion/foodIdentity';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import {
  buildFoodEntryDisplay,
  buildGroupQuantitySubtitle,
  buildCanonicalGroupAccessibilityLabel,
  groupJournalEntries,
  KnownCountPortion,
} from './journalEntryDisplay';
import { deriveSubmitOutcome } from './journalSubmitFeedback';
import {
  buildLastSubmitConfirmation,
  createLastSubmitConfirmationController,
  LastSubmitConfirmationController,
} from './journalLastSubmitConfirmation';

interface LastSubmitPanel {
  kind: 'single' | 'multiple';
  message: string;
  accessibilityLabel: string;
  entries: FoodEntry[];
}

const formatCalories = (value: number) => Math.round(value).toString();
const formatMacroGrams = (value: number) => `${Math.round(value)}g`;
const LOCAL_PORTION_HINT_USER_ID = 'local-user';

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
  // J-010: known count portions (e.g. "1 egg = 60g"), keyed by food identity, resolved
  // ahead of time so the pure display helper can stay synchronous (see journalEntryDisplay.ts).
  const [knownCountPortions, setKnownCountPortions] = useState<Record<string, KnownCountPortion>>(
    {},
  );

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  // J-013: clarification shown in the edit modal when an instruction can't be applied safely
  // (bare number without a unit, or a count for a food with no known piece weight).
  const [editHint, setEditHint] = useState<string | null>(null);
  const [manualPortionItem, setManualPortionItem] = useState<PortionNeedsEditItem | null>(null);
  const [manualTotalGrams, setManualTotalGrams] = useState('');
  const [portionActionInFlight, setPortionActionInFlight] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // DI-009: guards against an in-flight load that resolves after a newer one has already
  // started (e.g. rapid tab switching) from overwriting the newer result.
  const loadRequestIdRef = useRef(0);

  const loadJournalData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    try {
      // Load daily summary
      const summaryData = await container.getDailySummaryUseCase.execute(today);
      if (loadRequestIdRef.current !== requestId) return;
      setSummary(summaryData);
      setEntries(summaryData.entries);
    } catch (err) {
      if (loadRequestIdRef.current !== requestId) return;
      // log and continue
      console.error('Failed to load journal data:', err);
    }
  }, [today]);

  // DI-009: reload on every tab focus (not just mount) so entries logged from another tab
  // (e.g. a Saved Meal template) are picked up on return, without a full app reload.
  // J-008: the transient confirmation must disappear when the Journal tab loses focus.
  useFocusEffect(
    useCallback(() => {
      loadJournalData();
      return () => {
        confirmationControllerRef.current?.hide();
      };
    }, [loadJournalData]),
  );

  // J-008: clear any pending auto-dismiss timer on unmount to avoid a stale callback.
  useEffect(() => {
    return () => {
      confirmationControllerRef.current?.dispose();
    };
  }, []);

  // J-010: resolve known count portions for today's distinct foods whenever entries change
  // (submit/edit/delete/reload) — read-only, display-only; never mutates a stored entry.
  useEffect(() => {
    let cancelled = false;
    const identityKeys = new Set<string>();
    for (const entry of entries) {
      if (entry.calories <= 0) continue;
      const key = resolveFoodIdentityKey(entry.parsedName);
      if (key) identityKeys.add(key);
    }

    if (identityKeys.size === 0) {
      setKnownCountPortions({});
      return;
    }

    (async () => {
      const resolved = await Promise.all(
        Array.from(identityKeys).map(async (foodIdentityKey) => {
          const [pieceHint, sliceHint] = await Promise.all([
            container.portionKnowledgeService.lookup({
              foodIdentityKey,
              unit: 'piece',
              userId: LOCAL_PORTION_HINT_USER_ID,
            }),
            container.portionKnowledgeService.lookup({
              foodIdentityKey,
              unit: 'slice',
              userId: LOCAL_PORTION_HINT_USER_ID,
            }),
          ]);
          return [foodIdentityKey, pieceHint ?? sliceHint] as const;
        }),
      );

      if (cancelled) return;

      const next: Record<string, KnownCountPortion> = {};
      for (const [foodIdentityKey, hint] of resolved) {
        if (hint) next[foodIdentityKey] = { unit: hint.unit, gramsPerUnit: hint.gramsPerUnit };
      }
      setKnownCountPortions(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [entries]);

  const getKnownCountPortion = (entry: FoodEntry): KnownCountPortion | undefined => {
    const foodIdentityKey = resolveFoodIdentityKey(entry.parsedName);
    return foodIdentityKey ? knownCountPortions[foodIdentityKey] : undefined;
  };

  // J-009: canonical-identity groups are collapsed by default; keyed by the group's own
  // (stable) groupId, so toggled state survives an unrelated reload/re-group for the same
  // identity. Composite-dish groups don't use this — they stay always-expanded, unchanged.
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const [unresolvedItems, setUnresolvedItems] = React.useState<string[]>([]);
  const [portionNeedsEditItems, setPortionNeedsEditItems] = React.useState<PortionNeedsEditItem[]>(
    [],
  );
  // J-008: transient last-submit confirmation, replacing the old permanent "Erkannte
  // Einträge" list. Timer/visibility is owned by a framework-agnostic controller so it's
  // unit-testable with fake timers; `lastSubmitPanel` mirrors the controller's current value.
  const [lastSubmitPanel, setLastSubmitPanel] = useState<LastSubmitPanel | null>(null);
  // J-014: whether the multi-entry disclosure is expanded, and whether that expansion is
  // currently holding the auto-dismiss timer (so we release exactly the hold we placed).
  const [confirmationExpanded, setConfirmationExpanded] = useState(false);
  const confirmationExpandHeldRef = useRef(false);
  // Any replacement/dismissal of the confirmation collapses the disclosure. The controller
  // already zeroes its holdCount on show()/hide()/timeout, so we only clear our own ref here —
  // calling release() would be a guarded no-op against an already-zero holdCount.
  const handleConfirmationChange = useCallback((panel: LastSubmitPanel | null) => {
    setLastSubmitPanel(panel);
    setConfirmationExpanded(false);
    confirmationExpandHeldRef.current = false;
  }, []);
  const confirmationControllerRef =
    useRef<LastSubmitConfirmationController<LastSubmitPanel> | null>(null);
  if (!confirmationControllerRef.current) {
    confirmationControllerRef.current =
      createLastSubmitConfirmationController<LastSubmitPanel>(handleConfirmationChange);
  }
  // J-014: toggles the multi-entry detail disclosure. Expanding holds the auto-dismiss timer
  // (decision 26) so the banner can't vanish while the user is reading the details; collapsing
  // releases it (decision 27), resuming the smallest deterministic dismissal behavior.
  const toggleConfirmationExpanded = () => {
    setConfirmationExpanded((prev) => {
      const next = !prev;
      if (next && !confirmationExpandHeldRef.current) {
        confirmationExpandHeldRef.current = true;
        confirmationControllerRef.current?.hold();
      } else if (!next && confirmationExpandHeldRef.current) {
        confirmationExpandHeldRef.current = false;
        confirmationControllerRef.current?.release();
      }
      return next;
    });
  };
  // Tracks whether the currently open edit modal was opened from the confirmation panel, so
  // handleCloseEdit only releases a hold it actually placed (see handleOpenEditFromConfirmation).
  const confirmationEditHeldRef = useRef(false);
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
    // J-008: a new submission always replaces the previous confirmation (decision 4), even
    // if this new submission ends up persisting nothing itself.
    confirmationControllerRef.current?.hide();
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

    // J-008: transient confirmation for exactly what this submission persisted. Independent
    // of outcome/blocked/unresolved handling below — a partial success still shows this for
    // the entries that DID persist, while the unresolved/blocked items keep using the J-007
    // status/trust message and "Nicht erkannte Einträge"/"Portionsgewicht fehlt" sections
    // (decision 10: never suppress that explanation, never imply a blocked item was saved).
    const confirmation = buildLastSubmitConfirmation(
      result.persistedEntries.map((entry) => ({
        id: entry.id,
        rawInput: entry.rawInput,
        parsedName: entry.parsedName,
        calories: entry.calories,
      })),
    );
    if (confirmation) {
      confirmationControllerRef.current?.show({
        kind: confirmation.kind,
        message: confirmation.message,
        accessibilityLabel: confirmation.accessibilityLabel,
        entries: result.persistedEntries,
      });
    }

    // J-007: if anything was persisted, this is always a (possibly partial) success — never
    // a hard error that would contradict what "Erkannte Einträge"/"Heutige Einträge" already
    // show as saved. See journalSubmitFeedback.ts for the full truthfulness rules.
    const outcome = deriveSubmitOutcome({
      persistedCount,
      unresolvedCount,
      blockedCount,
      needsEditCount: result.needsEditItems.length,
      confidenceReason: result.dispatch.confidence.reason,
    });

    setStatusMessage(outcome.statusMessage);
    setTrustMessage(outcome.trustMessage);
    setProcessingState(outcome.processingState);

    if (outcome.processingState === 'error') {
      return;
    }

    if (options.clearRawInputOnSuccess) {
      setRawInput('');
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
    setEditHint(null);
    setEditModalVisible(true);
  };

  // J-008: correction access from the transient confirmation panel. Holds the panel's
  // auto-dismiss timer for the duration of the edit so it can't disappear underneath the
  // user mid-correction; handleCloseEdit releases the hold once the modal closes.
  const handleOpenEditFromConfirmation = (entry: FoodEntry) => {
    confirmationControllerRef.current?.hold();
    confirmationEditHeldRef.current = true;
    handleOpenEdit(entry);
  };

  const handleCloseEdit = () => {
    setEditModalVisible(false);
    setEditingEntry(null);
    setEditInstruction('');
    setEditHint(null);

    if (confirmationEditHeldRef.current) {
      confirmationEditHeldRef.current = false;
      confirmationControllerRef.current?.release();
    }
  };

  const handleApplyEdit = async () => {
    if (!editingEntry || !editInstruction.trim()) return;

    try {
      const result = await container.editFoodEntryFromNaturalLanguageUseCase.execute(
        editingEntry.id,
        editInstruction,
      );
      const codes = result.editDecision.reasonCodes;
      // J-013: on a safe-to-reject instruction, keep the modal open with a clarification and
      // do not reload — nothing was mutated.
      if (codes.includes('BARE_NUMBER_NEEDS_UNIT')) {
        setEditHint('Bitte gib eine Einheit an – zum Beispiel „2 Stück“ oder „150 g“.');
        return;
      }
      if (codes.includes('COUNT_PORTION_UNKNOWN')) {
        setEditHint(
          'Für dieses Lebensmittel ist kein Stückgewicht bekannt. Bitte gib die Menge in Gramm an, z. B. „150 g“.',
        );
        return;
      }
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

        {lastSubmitPanel && (
          <View
            style={styles.lastSubmitConfirmation}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={lastSubmitPanel.accessibilityLabel}
            onTouchStart={() => confirmationControllerRef.current?.hold()}
            onTouchEnd={() => confirmationControllerRef.current?.release()}
            onTouchCancel={() => confirmationControllerRef.current?.release()}
          >
            {/* J-014: one compact line, no duplicated Journal-entry row. Single → inline
                „Bearbeiten"; multiple → an „Anzeigen" disclosure for the per-entry detail. */}
            <View style={styles.lastSubmitHeaderRow}>
              <AppText style={styles.lastSubmitMessage}>{lastSubmitPanel.message}</AppText>
              {lastSubmitPanel.kind === 'single' ? (
                <TouchableOpacity
                  onPress={() => handleOpenEditFromConfirmation(lastSubmitPanel.entries[0])}
                  accessibilityRole="button"
                  accessibilityLabel="Eintrag bearbeiten"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.lastSubmitAction}
                  activeOpacity={0.7}
                >
                  <AppText variant="meta" tone="accent">
                    Bearbeiten
                  </AppText>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={toggleConfirmationExpanded}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: confirmationExpanded }}
                  accessibilityLabel={
                    confirmationExpanded ? 'Details verbergen' : 'Details anzeigen'
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.lastSubmitAction}
                  activeOpacity={0.7}
                >
                  <AppText variant="meta" tone="accent">
                    {confirmationExpanded ? 'Verbergen' : 'Anzeigen'}
                  </AppText>
                </TouchableOpacity>
              )}
            </View>
            {lastSubmitPanel.kind === 'multiple' && confirmationExpanded && (
              <View style={styles.lastSubmitDetails}>
                {lastSubmitPanel.entries.map((entry) => {
                  const display = buildFoodEntryDisplay(entry, getKnownCountPortion(entry));

                  return (
                    <EntryRow
                      key={entry.id}
                      title={display.title}
                      subtitle={display.subtitle}
                      kcal={entry.calories}
                      onPress={() => handleOpenEditFromConfirmation(entry)}
                      style={styles.lastSubmitEntryRow}
                    />
                  );
                })}
              </View>
            )}
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
                const display = buildFoodEntryDisplay(
                  listItem.entry,
                  getKnownCountPortion(listItem.entry),
                );

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

              const renderChild = (child: FoodEntry) => {
                const display = buildFoodEntryDisplay(child, getKnownCountPortion(child));

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
              };

              if (listItem.groupKind === 'composite') {
                // P1-003C composite-dish groups: unchanged, always-expanded, no toggle.
                return (
                  <View key={listItem.groupId} style={styles.group}>
                    <EntryRow
                      title={listItem.label}
                      subtitle={`${listItem.children.length} Zutaten`}
                      kcal={listItem.totalCalories}
                      style={styles.groupHeader}
                    />
                    {listItem.children.map(renderChild)}
                  </View>
                );
              }

              // J-009 canonical-identity groups: collapsed by default, tap the header to
              // expand/collapse; every child keeps the existing edit/delete interaction; the
              // header itself carries no edit/delete action.
              const isExpanded = expandedGroupIds.has(listItem.groupId);
              const quantitySubtitle = buildGroupQuantitySubtitle(
                listItem.children,
                getKnownCountPortion,
              );
              // J-012: the accessible label states title + aggregate quantity + calorie total +
              // expanded/collapsed state + the available action in one announcement (e.g.
              // "Eier, 5 Stück (300 g), 411 Kilokalorien, eingeklappt. Zum Öffnen doppeltippen."),
              // replacing the previous "N Einträge" phrasing. The chevron glyph itself is hidden
              // from the accessibility tree (EntryRow's `chevron` prop) so this single label is
              // the only announcement — no duplicate.
              const accessibilityLabel = buildCanonicalGroupAccessibilityLabel(
                listItem.label,
                quantitySubtitle,
                listItem.totalCalories,
                isExpanded,
              );

              return (
                <View key={listItem.groupId} style={styles.group}>
                  <TouchableOpacity
                    onPress={() => toggleGroupExpanded(listItem.groupId)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    accessibilityLabel={accessibilityLabel}
                    activeOpacity={0.7}
                  >
                    <EntryRow
                      title={listItem.label}
                      subtitle={quantitySubtitle}
                      kcal={listItem.totalCalories}
                      style={styles.groupHeader}
                      chevron={isExpanded ? 'expanded' : 'collapsed'}
                    />
                  </TouchableOpacity>
                  {isExpanded && listItem.children.map(renderChild)}
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
            {editingEntry && (
              <AppText style={styles.editCurrent}>
                {`Aktuell: ${
                  buildFoodEntryDisplay(editingEntry, getKnownCountPortion(editingEntry))
                    .subtitle ?? '—'
                }`}
              </AppText>
            )}
            <InputArea
              placeholder="Was möchtest du ändern?"
              value={editInstruction}
              onChangeText={(text) => {
                setEditInstruction(text);
                if (editHint) setEditHint(null);
              }}
              multiline
              blurOnSubmit
              style={styles.inputArea}
            />
            <AppText style={styles.editExamples}>
              Beispiele: „2 Stück“, „150 g“, „Magerquark statt Quark“
            </AppText>
            {editHint && <AppText style={styles.editHint}>{editHint}</AppText>}
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
  // J-014: a compact, transient banner — a thin accent edge (not a full bordered card) keeps
  // it visually distinct from permanent Journal entries and from the auto-merge notice.
  lastSubmitConfirmation: {
    marginTop: 8,
    paddingHorizontal: tokens.spacing.s,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.small,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.accent,
  },
  lastSubmitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastSubmitMessage: {
    flex: 1,
    fontWeight: 'bold',
    paddingRight: tokens.spacing.s,
  },
  lastSubmitAction: {
    paddingVertical: 2,
  },
  lastSubmitDetails: {
    marginTop: tokens.spacing.xs,
  },
  lastSubmitEntryRow: {
    paddingVertical: tokens.spacing.xs,
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
  editCurrent: {
    marginBottom: 8,
    color: tokens.colors.textMuted,
  },
  editExamples: {
    marginTop: 8,
    color: tokens.colors.textMuted,
    fontSize: 13,
  },
  editHint: {
    marginTop: 8,
    color: tokens.colors.danger,
  },
});

export default JournalScreen;
