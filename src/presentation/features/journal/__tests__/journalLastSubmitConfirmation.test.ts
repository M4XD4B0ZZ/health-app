import {
  buildLastSubmitConfirmation,
  createLastSubmitConfirmationController,
  LAST_SUBMIT_CONFIRMATION_MS,
  SubmitConfirmationEntry,
} from '../journalLastSubmitConfirmation';

function entry(overrides: Partial<SubmitConfirmationEntry> = {}): SubmitConfirmationEntry {
  return {
    id: 'e1',
    rawInput: 'ei',
    parsedName: 'ei',
    calories: 82.2,
    ...overrides,
  };
}

describe('buildLastSubmitConfirmation', () => {
  it('returns null when nothing was persisted (fully-blocked submit stays the J-007 error path)', () => {
    expect(buildLastSubmitConfirmation([])).toBeNull();
  });

  it('reproduces the dogfooding case: "Drei Eier" -> "3 Eier gespeichert · 246,6 kcal"', () => {
    const result = buildLastSubmitConfirmation([
      entry({ id: 'e1', rawInput: 'Drei Eier', parsedName: 'eier', calories: 246.6 }),
    ]);

    expect(result).toEqual({
      message: '3 Eier gespeichert · 246,6 kcal',
      entryIds: ['e1'],
    });
  });

  it('single entry without a count word in the raw input omits the count (no invented count)', () => {
    const result = buildLastSubmitConfirmation([
      entry({ id: 'e1', rawInput: 'Ei', parsedName: 'ei', calories: 82.2 }),
    ]);

    expect(result).toEqual({
      message: 'Ei gespeichert · 82,2 kcal',
      entryIds: ['e1'],
    });
  });

  it('single entry with an explicit "Ein" count word shows the count as typed', () => {
    const result = buildLastSubmitConfirmation([
      entry({ id: 'e1', rawInput: 'Ein Ei', parsedName: 'ei', calories: 82.2 }),
    ]);

    expect(result?.message).toBe('1 Ei gespeichert · 82,2 kcal');
  });

  it('a grams-only entry never invents a count', () => {
    const result = buildLastSubmitConfirmation([
      entry({ id: 'e1', rawInput: '300g karotten', parsedName: 'karotten', calories: 123 }),
    ]);

    expect(result?.message).toBe('Karotten gespeichert · 123 kcal');
  });

  it('two distinct persisted entries join with "und" and sum kcal', () => {
    const result = buildLastSubmitConfirmation([
      entry({ id: 'e1', rawInput: '3 eier', parsedName: 'eier', calories: 246.6 }),
      entry({ id: 'e2', rawInput: 'magerquark', parsedName: 'magerquark', calories: 49.4 }),
    ]);

    expect(result).toEqual({
      message: '2 Einträge gespeichert: Eier und Magerquark · 296 kcal',
      entryIds: ['e1', 'e2'],
    });
  });

  it('three or more entries join with commas and a final "und"', () => {
    const result = buildLastSubmitConfirmation([
      entry({ id: 'e1', rawInput: 'ei', parsedName: 'ei', calories: 10 }),
      entry({ id: 'e2', rawInput: 'banane', parsedName: 'banane', calories: 20 }),
      entry({ id: 'e3', rawInput: 'quark', parsedName: 'quark', calories: 30 }),
    ]);

    expect(result?.message).toBe('3 Einträge gespeichert: Ei, Banane und Quark · 60 kcal');
    expect(result?.entryIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('a mixed submit only ever receives the persisted entries — blocked items never appear here', () => {
    // Simulates "1 Banane und zorbfrucht": caller passes only the persisted Banane entry;
    // the blocked "zorbfrucht" is never part of this function's input (J-007 handles it).
    const result = buildLastSubmitConfirmation([
      entry({ id: 'e1', rawInput: 'banane', parsedName: 'banane', calories: 90 }),
    ]);

    expect(result?.message).toBe('Banane gespeichert · 90 kcal');
    expect(result?.entryIds).toEqual(['e1']);
  });
});

describe('createLastSubmitConfirmationController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the payload immediately and auto-dismisses after ~8s', () => {
    const onChange = jest.fn();
    const controller = createLastSubmitConfirmationController<string>(onChange);

    controller.show('a');
    expect(onChange).toHaveBeenLastCalledWith('a');

    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS - 1);
    expect(onChange).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('a new show() replaces content and restarts the timer (no stale-timer dismissal of the newer confirmation)', () => {
    const onChange = jest.fn();
    const controller = createLastSubmitConfirmationController<string>(onChange);

    controller.show('a');
    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS - 1000);
    controller.show('b');
    expect(onChange).toHaveBeenLastCalledWith('b');

    // The original timer for 'a' would have fired here — must not dismiss 'b'.
    jest.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenLastCalledWith('b');

    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS - 1000);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('does not auto-dismiss while held, and resumes the timer on release', () => {
    const onChange = jest.fn();
    const controller = createLastSubmitConfirmationController<string>(onChange);

    controller.show('a');
    controller.hold();

    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS * 3);
    expect(onChange).not.toHaveBeenCalledWith(null);

    controller.release();
    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS - 1);
    expect(onChange).not.toHaveBeenCalledWith(null);

    jest.advanceTimersByTime(1);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('supports nested/overlapping holds — resumes only once every hold has a matching release', () => {
    const onChange = jest.fn();
    const controller = createLastSubmitConfirmationController<string>(onChange);

    controller.show('a');
    controller.hold();
    controller.hold();
    controller.release();

    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS * 2);
    expect(onChange).not.toHaveBeenCalledWith(null);

    controller.release();
    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('release() without a matching hold() is a no-op and never restarts/extends the timer', () => {
    const onChange = jest.fn();
    const controller = createLastSubmitConfirmationController<string>(onChange);

    controller.show('a');
    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS - 100);
    controller.release();

    jest.advanceTimersByTime(100);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('hide() clears immediately mid-duration (tab blur)', () => {
    const onChange = jest.fn();
    const controller = createLastSubmitConfirmationController<string>(onChange);

    controller.show('a');
    jest.advanceTimersByTime(1000);
    controller.hide();
    expect(onChange).toHaveBeenLastCalledWith(null);

    onChange.mockClear();
    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS * 2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hide() when already hidden does not emit a redundant onChange(null)', () => {
    const onChange = jest.fn();
    const controller = createLastSubmitConfirmationController<string>(onChange);

    controller.hide();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('dispose() clears the pending timer without emitting further onChange calls (no leak after unmount)', () => {
    const onChange = jest.fn();
    const controller = createLastSubmitConfirmationController<string>(onChange);

    controller.show('a');
    controller.dispose();
    onChange.mockClear();

    jest.advanceTimersByTime(LAST_SUBMIT_CONFIRMATION_MS * 2);
    expect(onChange).not.toHaveBeenCalled();
  });
});
