import React from 'react';

export function claimJournalSubmitSlot(
  submitInFlightRef: React.MutableRefObject<boolean>,
): boolean {
  if (submitInFlightRef.current) {
    return false;
  }

  submitInFlightRef.current = true;
  return true;
}
