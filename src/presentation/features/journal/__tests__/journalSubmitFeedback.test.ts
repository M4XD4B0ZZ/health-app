import { deriveSubmitOutcome } from '../journalSubmitFeedback';

describe('deriveSubmitOutcome (J-007)', () => {
  it('reports full success when everything resolved and nothing was blocked or unresolved', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 2,
      unresolvedCount: 0,
      blockedCount: 0,
      needsEditCount: 0,
      speckClarificationCount: 0,
      confidenceReason: 'all_items_matched',
    });

    expect(outcome.processingState).toBe('done');
    expect(outcome.statusMessage).toBe('2 Einträge gespeichert');
    // Matches the pre-existing behavior this was extracted from: a full success clears the
    // trust message entirely — the status line alone is the confirmation.
    expect(outcome.trustMessage).toBe('');
  });

  it('reports a truthful partial success when a persisted entry coexists with a blocked one (repro of befund 4.3: "1 Banane und zorbfrucht")', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 1,
      unresolvedCount: 0,
      blockedCount: 1,
      needsEditCount: 0,
      speckClarificationCount: 0,
      confidenceReason: 'partial_match',
    });

    // Regression guard: must never fall back to the hard-error framing once something was
    // actually persisted — that previously contradicted "Erkannte Einträge"/"Heutige Einträge".
    expect(outcome.processingState).toBe('done');
    expect(outcome.statusMessage).toBe('1 Eintrag gespeichert, 1 nicht erkannt');
    expect(outcome.trustMessage).toBe(
      'Teilweise erkannt: Gespeicherte Einträge wurden übernommen; nicht erkannte Einträge wurden nicht geschätzt.',
    );
  });

  it('reports a truthful partial success when a persisted entry coexists with an unresolved one', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 1,
      unresolvedCount: 1,
      blockedCount: 0,
      needsEditCount: 0,
      speckClarificationCount: 0,
      confidenceReason: 'partial_match',
    });

    expect(outcome.processingState).toBe('done');
    expect(outcome.statusMessage).toBe('1 Eintrag gespeichert, 1 nicht erkannt');
  });

  it('still reports a hard error when nothing was persisted and items were blocked without a portion prompt', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 0,
      unresolvedCount: 0,
      blockedCount: 1,
      needsEditCount: 0,
      speckClarificationCount: 0,
      confidenceReason: 'no_items_matched',
    });

    expect(outcome.processingState).toBe('error');
    expect(outcome.statusMessage).toBe('Eintrag konnte nicht verarbeitet werden');
  });

  it('still reports "Portionsgewicht fehlt" when nothing was persisted and the block is a portion prompt', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 0,
      unresolvedCount: 0,
      blockedCount: 1,
      needsEditCount: 1,
      speckClarificationCount: 0,
      confidenceReason: 'partial_match',
    });

    expect(outcome.processingState).toBe('error');
    expect(outcome.statusMessage).toBe('Portionsgewicht fehlt');
  });

  it('RESOLVER-V2-010: reports "Bitte Speck-Art wählen" when nothing was persisted and the block is a Speck clarification', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 0,
      unresolvedCount: 0,
      blockedCount: 1,
      needsEditCount: 0,
      speckClarificationCount: 1,
      confidenceReason: 'partial_match',
    });

    expect(outcome.processingState).toBe('error');
    expect(outcome.statusMessage).toBe('Bitte Speck-Art wählen');
  });

  it('RESOLVER-V2-010: a portion prompt takes priority over a Speck clarification when both are pending', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 0,
      unresolvedCount: 0,
      blockedCount: 2,
      needsEditCount: 1,
      speckClarificationCount: 1,
      confidenceReason: 'partial_match',
    });

    expect(outcome.statusMessage).toBe('Portionsgewicht fehlt');
  });

  it('still reports the honest "nothing recognized" error when nothing was persisted or blocked', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 0,
      unresolvedCount: 0,
      blockedCount: 0,
      needsEditCount: 0,
      speckClarificationCount: 0,
      confidenceReason: 'no_items',
    });

    expect(outcome.processingState).toBe('error');
    expect(outcome.statusMessage).toBe('Nicht erkannt — bitte genauer eingeben');
    expect(outcome.trustMessage).toBe(
      'Zu ungenau — bitte Lebensmittel oder Menge genauer angeben.',
    );
  });

  it('uses singular grammar for exactly one persisted entry', () => {
    const outcome = deriveSubmitOutcome({
      persistedCount: 1,
      unresolvedCount: 0,
      blockedCount: 0,
      needsEditCount: 0,
      speckClarificationCount: 0,
      confidenceReason: 'all_items_matched',
    });

    expect(outcome.statusMessage).toBe('1 Eintrag gespeichert');
  });
});
