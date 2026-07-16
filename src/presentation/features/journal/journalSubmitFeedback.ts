/**
 * J-007: pure decision logic for the status/trust message and processing state shown after
 * a journal submit — extracted out of `JournalScreen.submitRawInput` so the truthfulness
 * rules (which combination of persisted/unresolved/blocked counts produces which message)
 * are unit-testable without a rendering harness, mirroring `journalEntryDisplay.ts`'s
 * pure-derivation pattern.
 *
 * Governing rule: if anything was actually persisted, the outcome is always reported as a
 * (possibly partial) success — never as a hard error that contradicts what "Heutige
 * Einträge"/"Erkannte Einträge" already show the user was saved.
 */
export interface SubmitOutcomeInput {
  persistedCount: number;
  unresolvedCount: number;
  blockedCount: number;
  needsEditCount: number;
  confidenceReason: string;
}

export type SubmitProcessingState = 'done' | 'error';

export interface SubmitOutcome {
  statusMessage: string;
  trustMessage: string;
  processingState: SubmitProcessingState;
}

function buildTrustMessage(
  confidenceReason: string,
  persistedCount: number,
  notRecognizedCount: number,
): string {
  if (persistedCount > 0 && notRecognizedCount > 0) {
    return 'Teilweise erkannt: Gespeicherte Einträge wurden übernommen; nicht erkannte Einträge wurden nicht geschätzt.';
  }

  if (notRecognizedCount > 0) {
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

export function deriveSubmitOutcome(input: SubmitOutcomeInput): SubmitOutcome {
  const { persistedCount, unresolvedCount, blockedCount, needsEditCount, confidenceReason } = input;
  const notRecognizedCount = unresolvedCount + blockedCount;
  const trustMessage = buildTrustMessage(confidenceReason, persistedCount, notRecognizedCount);

  if (persistedCount === 0) {
    if (blockedCount > 0) {
      return {
        statusMessage:
          needsEditCount > 0 ? 'Portionsgewicht fehlt' : 'Eintrag konnte nicht verarbeitet werden',
        trustMessage,
        processingState: 'error',
      };
    }

    return {
      statusMessage: 'Nicht erkannt — bitte genauer eingeben',
      trustMessage,
      processingState: 'error',
    };
  }

  const entryNoun = persistedCount === 1 ? 'Eintrag' : 'Einträge';

  // Something was persisted — always a success outcome, even if other items were blocked
  // or unresolved. A submission that saved real entries must never be reported as a failure.
  if (notRecognizedCount === 0) {
    return {
      statusMessage: `${persistedCount} ${entryNoun} gespeichert`,
      trustMessage: '',
      processingState: 'done',
    };
  }

  return {
    statusMessage: `${persistedCount} ${entryNoun} gespeichert, ${notRecognizedCount} nicht erkannt`,
    trustMessage,
    processingState: 'done',
  };
}
