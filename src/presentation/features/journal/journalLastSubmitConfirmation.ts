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

export const LAST_SUBMIT_CONFIRMATION_MS = 8000;

export interface SubmitConfirmationEntry {
  id: string;
  rawInput: string;
  parsedName: string;
  calories: number;
}

export interface LastSubmitConfirmation {
  message: string;
  entryIds: string[];
}

function formatEntryName(entry: SubmitConfirmationEntry): string {
  const source = (entry.parsedName || entry.rawInput).trim();
  if (!source) return source;

  return source.charAt(0).toLocaleUpperCase('de-DE') + source.slice(1);
}

function joinGerman(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';

  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

/**
 * Governing rule (decision 4): the confirmation represents only entries persisted by the
 * latest submission and must say so explicitly. Returns `null` when nothing was persisted —
 * a fully-blocked/unresolved submit is the J-007 error path's responsibility, not this panel's.
 */
export function buildLastSubmitConfirmation(
  persistedEntries: SubmitConfirmationEntry[],
): LastSubmitConfirmation | null {
  if (persistedEntries.length === 0) return null;

  const entryIds = persistedEntries.map((entry) => entry.id);

  if (persistedEntries.length === 1) {
    const [entry] = persistedEntries;
    const name = formatEntryName(entry);
    const parsed = parseDisplayQuantity(entry.rawInput);
    // Only prefix a count that was actually present in the raw input (e.g. "Drei Eier" ->
    // "3 Eier"); never invent one for a bare "Ei" or a grams-only "300g Karotten".
    const countPrefix =
      parsed.count && parsed.count > 0 && parsed.unit !== 'g'
        ? `${formatNumber(parsed.count)} `
        : '';

    return {
      message: `${countPrefix}${name} gespeichert · ${formatNumber(entry.calories)} kcal`,
      entryIds,
    };
  }

  const names = persistedEntries.map(formatEntryName);
  const totalKcal = persistedEntries.reduce((sum, entry) => sum + entry.calories, 0);

  return {
    message: `${persistedEntries.length} Einträge gespeichert: ${joinGerman(names)} · ${formatNumber(totalKcal)} kcal`,
    entryIds,
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
