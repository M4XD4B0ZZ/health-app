import { formatNumber, parseDisplayQuantity } from './journalEntryDisplay';

/**
 * J-008: replaces the permanently visible "Erkannte Einträge" list with a transient
 * last-submit confirmation. This module has two independent, separately testable parts:
 *
 * - `buildLastSubmitConfirmation()` — pure derivation of the confirmation message from the
 *   entries persisted by the latest submit (mirrors journalSubmitFeedback.ts's pattern).
 * - `createLastSubmitConfirmationController()` — a framework-agnostic timer/visibility state
 *   machine (show/hold/release/hide/dispose), driven from JournalScreen but with zero React
 *   dependency so it can be unit-tested with Jest fake timers without a rendering harness.
 */

// J-014: auto-dismiss target lowered from 8 s to ~5 s. Single exported source of truth — the
// controller defaults to it and JournalScreen never hard-codes a duration (decision 24).
export const LAST_SUBMIT_CONFIRMATION_MS = 5000;

export interface SubmitConfirmationEntry {
  id: string;
  rawInput: string;
  parsedName: string;
  calories: number;
}

export interface LastSubmitConfirmation {
  /**
   * J-014: `single` renders one compact line + a „Bearbeiten" action; `multiple` renders a
   * compact aggregate line + an „Anzeigen" disclosure. The screen owns the per-entry rendering
   * for the expanded detail — this module only derives the compact summary text.
   */
  kind: 'single' | 'multiple';
  /** Compact summary line. Single: „Haferflocken gespeichert · 102 kcal". Multiple: „3 Einträge gespeichert · 428 kcal". */
  message: string;
  /** Screen-reader announcement covering name/count, saved state, calories and the available action. */
  accessibilityLabel: string;
  entryIds: string[];
  /** Number of persisted entries (1 for `single`). */
  count: number;
  /** Summed calories across the persisted entries. */
  totalCalories: number;
}

function formatEntryName(entry: SubmitConfirmationEntry): string {
  const source = (entry.parsedName || entry.rawInput).trim();
  if (!source) return source;

  return source.charAt(0).toLocaleUpperCase('de-DE') + source.slice(1);
}

/**
 * The user-facing name for a single entry, prefixed with the count only when it was actually
 * typed (e.g. „Drei Eier" → „3 Eier"); never invents one for a bare „Ei" or grams-only input.
 */
function formatSingleEntryLabel(entry: SubmitConfirmationEntry): string {
  const name = formatEntryName(entry);
  const parsed = parseDisplayQuantity(entry.rawInput);
  const countPrefix =
    parsed.count && parsed.count > 0 && parsed.unit !== 'g' ? `${formatNumber(parsed.count)} ` : '';
  return `${countPrefix}${name}`;
}

/**
 * Governing rule (decision 4): the confirmation represents only entries persisted by the
 * latest submission and must say so explicitly. Returns `null` when nothing was persisted —
 * a fully-blocked/unresolved submit is the J-007 error path's responsibility, not this panel's.
 *
 * J-014: the summary is intentionally compact. A single entry reads „Name gespeichert · N kcal"
 * with an inline „Bearbeiten" action; several entries collapse to „N Einträge gespeichert · N
 * kcal" (no inlined name list — the names live in the expandable detail the screen renders).
 */
export function buildLastSubmitConfirmation(
  persistedEntries: SubmitConfirmationEntry[],
): LastSubmitConfirmation | null {
  if (persistedEntries.length === 0) return null;

  const entryIds = persistedEntries.map((entry) => entry.id);
  const totalCalories = persistedEntries.reduce((sum, entry) => sum + entry.calories, 0);

  if (persistedEntries.length === 1) {
    const [entry] = persistedEntries;
    const label = formatSingleEntryLabel(entry);
    const kcal = formatNumber(entry.calories);

    return {
      kind: 'single',
      message: `${label} gespeichert · ${kcal} kcal`,
      accessibilityLabel: `${label} gespeichert, ${kcal} kcal. Bearbeiten verfügbar.`,
      entryIds,
      count: 1,
      totalCalories,
    };
  }

  const count = persistedEntries.length;
  const kcal = formatNumber(totalCalories);

  return {
    kind: 'multiple',
    message: `${count} Einträge gespeichert · ${kcal} kcal`,
    accessibilityLabel: `${count} Einträge gespeichert, ${kcal} kcal. Details anzeigen.`,
    entryIds,
    count,
    totalCalories,
  };
}

export interface LastSubmitConfirmationController<T> {
  /** Sets the current confirmation and (re)starts the auto-dismiss timer. Resets any hold. */
  show(payload: T): void;
  /** Clears the confirmation immediately (tab blur, replaced-by-clear on next submit). */
  hide(): void;
  /** Pauses the auto-dismiss timer while the user is interacting with the panel. Nestable. */
  hold(): void;
  /** Resumes the auto-dismiss timer once every matching hold() has been released. */
  release(): void;
  /** Clears any pending timer without emitting a further onChange (component unmount). */
  dispose(): void;
}

/**
 * Framework-agnostic timer/visibility state machine (see plan §5). A single named timer is
 * alive at a time; every `show`/`hide` clears the prior one before starting a new one, so a
 * stale timer callback can never dismiss a newer confirmation (requirement: no stale-timer
 * dismissal). `hold`/`release` use a counter so an interaction-hold and a correction-modal
 * hold can overlap safely.
 */
export function createLastSubmitConfirmationController<T>(
  onChange: (payload: T | null) => void,
  durationMs: number = LAST_SUBMIT_CONFIRMATION_MS,
): LastSubmitConfirmationController<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let current: T | null = null;
  let holdCount = 0;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function startTimer() {
    clearTimer();
    if (holdCount > 0 || current === null) return;

    timer = setTimeout(() => {
      timer = null;
      current = null;
      onChange(null);
    }, durationMs);
  }

  return {
    show(payload) {
      current = payload;
      holdCount = 0;
      onChange(payload);
      startTimer();
    },
    hide() {
      clearTimer();
      holdCount = 0;
      if (current !== null) {
        current = null;
        onChange(null);
      }
    },
    hold() {
      holdCount += 1;
      clearTimer();
    },
    release() {
      // No-op without a matching hold() — must never restart/extend a timer we didn't pause.
      if (holdCount === 0) return;
      holdCount -= 1;
      if (holdCount === 0) startTimer();
    },
    dispose() {
      clearTimer();
      current = null;
      holdCount = 0;
    },
  };
}
