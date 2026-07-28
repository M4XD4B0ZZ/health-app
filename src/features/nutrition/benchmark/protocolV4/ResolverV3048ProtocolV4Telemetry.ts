import { withWallClockCeiling } from '../representativeHybridV1/live/RepresentativeHybridV1LiveTimeout';
import {
  assertTelemetryLedgerParity,
  independentCanonicalClone,
  validateTerminalMetadata,
  type ProtocolV4TerminalContext,
  type ProtocolV4TerminalMetadata,
} from './ResolverV3048ProtocolV4';
import {
  ProtocolV4CallStateRegistry,
  type ProtocolV4TerminalOutcomeKind,
} from './ResolverV3048ProtocolV4CallStateMachine';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Teil 5 ("Exactly-once-Telemetrie und Ledger").
 *
 * The PR #191 merge's `recordProtocolV4Terminal` pushed the *same object instance* into both the
 * telemetry and ledger arrays (`telemetry.push(terminal); ledger.push(terminal);`), so its own
 * `assertTelemetryLedgerParity` check was tautological -- it could never fail, because it was always
 * comparing a value to itself. There was also no exactly-once guard at all: nothing stopped the same
 * `callId` from being recorded twice.
 *
 * This module fixes both: every call to `recordProtocolV4Terminal` is now gated by a
 * `ProtocolV4CallStateRegistry` transition (`dispatched -> terminal`, which throws on any repeat),
 * and telemetry/ledger each receive their own independently canonically-serialized, independently
 * `JSON.parse`d, deep-frozen clone of the terminal record -- two different object references holding
 * the same data, so the parity check is a real, non-tautological comparison.
 */

export class ProtocolV4TelemetryLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4TelemetryLedgerError';
  }
}

function classifyTerminalOutcome(
  terminal: ProtocolV4TerminalMetadata,
): ProtocolV4TerminalOutcomeKind {
  if (terminal.failureKind === null) return 'completed';
  if (terminal.failureKind === 'wall_clock_ceiling') return 'wall_clock_ceiling';
  return 'terminal_failure';
}

/**
 * Validates one terminal-metadata record, transitions the call to `terminal` in the registry
 * (throwing on any second attempt for the same `callId`), and appends two INDEPENDENTLY
 * canonically-serialized, independently parsed, deep-frozen copies to the telemetry and ledger
 * arrays -- never the same object reference. This is the only supported way to add an entry to
 * either array.
 */
export function recordProtocolV4Terminal(
  registry: ProtocolV4CallStateRegistry,
  callId: string,
  terminal: ProtocolV4TerminalMetadata,
  telemetry: ProtocolV4TerminalMetadata[],
  ledger: ProtocolV4TerminalMetadata[],
  context?: ProtocolV4TerminalContext,
): ProtocolV4TerminalMetadata {
  validateTerminalMetadata(terminal, context);
  if (terminal.runIdentity.callId !== callId)
    throw new ProtocolV4TelemetryLedgerError('PROTOCOL_V4_TERMINAL_CALL_ID_MISMATCH');
  // Exactly-once: throws PROTOCOL_V4_CALL_INVALID_TRANSITION on any second completion for this
  // callId (including a late completion arriving after a wall-clock ceiling already terminated it).
  registry.complete(callId, classifyTerminalOutcome(terminal));

  const telemetryCopy = independentCanonicalClone(terminal);
  const ledgerCopy = independentCanonicalClone(terminal);
  if (telemetryCopy === ledgerCopy || telemetryCopy === terminal || ledgerCopy === terminal)
    throw new ProtocolV4TelemetryLedgerError('PROTOCOL_V4_TELEMETRY_LEDGER_SHARED_INSTANCE');
  telemetry.push(telemetryCopy);
  ledger.push(ledgerCopy);
  assertTelemetryLedgerParity(telemetryCopy, ledgerCopy);
  return terminal;
}

/**
 * Races `attempt` against `ceilingMs` (reusing V3-039's `withWallClockCeiling`). On completion,
 * returns the value untouched for the caller to build its own success/failure terminal record. On
 * ceiling breach, builds the terminal record via `buildTerminalOnCeiling` (which must produce the
 * exact wall-clock contract `validateTerminalMetadata` enforces: `pricingStatus: 'estimated'`,
 * `usageStatus: 'unknown'`, `actualCostStatus: 'usage_unknown'`, `actualCostUsd: null`,
 * `failureKind: 'wall_clock_ceiling'`, `retryable: false`, reserved worst-case cost preserved, full
 * run identity), records it via `recordProtocolV4Terminal` (which itself enforces exactly-once via
 * the registry), and never retries. Because `withWallClockCeiling` returns exactly one race result,
 * and this wrapper only ever calls `recordProtocolV4Terminal` from that single result, a provider
 * response that settles after the ceiling already fired can structurally never reach a second
 * terminal write -- its settlement is simply never observed by this function again.
 */
export async function wrapWithProtocolV4WallClockCeiling<T>(
  registry: ProtocolV4CallStateRegistry,
  callId: string,
  attempt: (signal: AbortSignal) => Promise<T>,
  ceilingMs: number,
  buildTerminalOnCeiling: (elapsedMs: number) => ProtocolV4TerminalMetadata,
  telemetry: ProtocolV4TerminalMetadata[],
  ledger: ProtocolV4TerminalMetadata[],
  context?: ProtocolV4TerminalContext,
): Promise<
  { status: 'completed'; value: T } | { status: 'timed_out'; terminal: ProtocolV4TerminalMetadata }
> {
  const race = await withWallClockCeiling(attempt, ceilingMs);
  if (race.status === 'timed_out') {
    const terminal = buildTerminalOnCeiling(race.elapsedMs);
    if (terminal.failureKind !== 'wall_clock_ceiling')
      throw new ProtocolV4TelemetryLedgerError(
        'PROTOCOL_V4_WALL_CLOCK_WRAPPER_CONTRACT_VIOLATION: buildTerminalOnCeiling must return failureKind "wall_clock_ceiling".',
      );
    recordProtocolV4Terminal(registry, callId, terminal, telemetry, ledger, context);
    return { status: 'timed_out', terminal };
  }
  return { status: 'completed', value: race.value };
}
