import { claimJournalSubmitSlot } from '../claimJournalSubmitSlot';

describe('JournalScreen submit guard', () => {
  it('prevents duplicate concurrent submissions until the in-flight slot is released', () => {
    const submitInFlightRef = { current: false };

    expect(claimJournalSubmitSlot(submitInFlightRef)).toBe(true);
    expect(claimJournalSubmitSlot(submitInFlightRef)).toBe(false);

    submitInFlightRef.current = false;

    expect(claimJournalSubmitSlot(submitInFlightRef)).toBe(true);
  });
});
