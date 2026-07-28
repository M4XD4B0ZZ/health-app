/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 5 ("Exactly-once-Telemetrie und Ledger").
 *
 * A closed call-state machine: `planned -> authorized -> reserved -> dispatched -> terminal`. Every
 * `callId` is global-unique within one registry (one registry per Master/Holdout execution plan
 * instance). Only the exact forward transitions above are legal; any other requested transition
 * (including a second `dispatch`, a second `reserve`, or a second `terminal` completion for the same
 * `callId`) throws instead of silently succeeding. This is what makes "exactly one terminal record
 * per callId" and "a late provider completion after the wall-clock ceiling cannot write a second
 * terminal" structurally true rather than merely conventionally true.
 */

export type ProtocolV4CallLifecycleState =
  | 'planned'
  | 'authorized'
  | 'reserved'
  | 'dispatched'
  | 'terminal';

/** Closed terminal-outcome vocabulary (Teil 5: "weitere klar versionierte terminale Zustände nur bei
 * tatsächlichem Bedarf" -- kept to exactly the three the task names; the full failure taxonomy lives
 * in `ProtocolV4FailureKind`, not here). */
export type ProtocolV4TerminalOutcomeKind = 'completed' | 'terminal_failure' | 'wall_clock_ceiling';

export class ProtocolV4CallStateMachineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4CallStateMachineError';
  }
}

interface ProtocolV4CallRecord {
  state: ProtocolV4CallLifecycleState;
  terminalOutcome: ProtocolV4TerminalOutcomeKind | null;
}

const FORWARD_TRANSITIONS: Readonly<
  Record<ProtocolV4CallLifecycleState, readonly ProtocolV4CallLifecycleState[]>
> = {
  planned: ['authorized'],
  authorized: ['reserved'],
  reserved: ['dispatched'],
  dispatched: ['terminal'],
  terminal: [],
};

/** One registry instance scopes call-ID uniqueness to exactly one execution plan (Development or
 * Holdout) -- pass a stable `scopeId` (e.g. the plan's execution-tree hash) so two independent
 * registries can never be confused with each other even if constructed side by side in the same
 * process (e.g. Development and Holdout running in the same test). */
export class ProtocolV4CallStateRegistry {
  private readonly calls = new Map<string, ProtocolV4CallRecord>();

  constructor(public readonly scopeId: string) {}

  /** Registers a new call ID as `planned`. Throws if the call ID was already registered in this
   * scope -- this is the "Call ID global eindeutig innerhalb des Execution Plans" guarantee. */
  plan(callId: string): void {
    if (this.calls.has(callId))
      throw new ProtocolV4CallStateMachineError(`PROTOCOL_V4_CALL_ID_NOT_UNIQUE:${callId}`);
    this.calls.set(callId, { state: 'planned', terminalOutcome: null });
  }

  private transition(callId: string, to: ProtocolV4CallLifecycleState): ProtocolV4CallRecord {
    const record = this.calls.get(callId);
    if (!record) throw new ProtocolV4CallStateMachineError(`PROTOCOL_V4_CALL_UNKNOWN:${callId}`);
    if (!FORWARD_TRANSITIONS[record.state].includes(to))
      throw new ProtocolV4CallStateMachineError(
        `PROTOCOL_V4_CALL_INVALID_TRANSITION:${callId}:${record.state}->${to}`,
      );
    record.state = to;
    return record;
  }

  authorize(callId: string): void {
    this.transition(callId, 'authorized');
  }

  /** Marks the call's budget reservation complete. A second `reserve()` for the same `callId`
   * throws -- this is the "zweite Reservation ... wird abgewiesen" guarantee. */
  reserve(callId: string): void {
    this.transition(callId, 'reserved');
  }

  /** Marks the call as dispatched to the (fake or real) provider transport. A second `dispatch()`
   * for the same `callId` throws -- "zweiter Dispatch ... wird abgewiesen". */
  dispatch(callId: string): void {
    this.transition(callId, 'dispatched');
  }

  /** Marks the call terminal with the given outcome. A second `complete()` for the same `callId` --
   * whether from a genuinely late provider completion after a wall-clock ceiling, a retried
   * dispatch, or any other double-write attempt -- throws instead of silently overwriting the first
   * terminal record. */
  complete(callId: string, outcome: ProtocolV4TerminalOutcomeKind): void {
    const record = this.transition(callId, 'terminal');
    record.terminalOutcome = outcome;
  }

  stateOf(callId: string): ProtocolV4CallLifecycleState | undefined {
    return this.calls.get(callId)?.state;
  }

  terminalOutcomeOf(callId: string): ProtocolV4TerminalOutcomeKind | null {
    return this.calls.get(callId)?.terminalOutcome ?? null;
  }

  isTerminal(callId: string): boolean {
    return this.calls.get(callId)?.state === 'terminal';
  }

  /** All call IDs currently registered in this scope, in registration order -- used by evidence
   * validators that must confirm every planned observation reached a terminal state (or an explicit,
   * distinctly-typed fast-path no-call status tracked outside this registry). */
  registeredCallIds(): readonly string[] {
    return Array.from(this.calls.keys());
  }
}
