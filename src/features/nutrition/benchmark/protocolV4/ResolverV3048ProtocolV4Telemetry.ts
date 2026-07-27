import { withWallClockCeiling } from '../representativeHybridV1/live/RepresentativeHybridV1LiveTimeout';
import {
  assertTelemetryLedgerParity,
  validateTerminalMetadata,
  type ProtocolV4TerminalContext,
  type ProtocolV4TerminalMetadata,
} from './ResolverV3048ProtocolV4';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Part 7 ("Protocol-v4-Telemetrie und Ledger
 * tatsächlich verdrahten").
 *
 * The PR #190 merge had `validateTerminalMetadata`/`assertTelemetryLedgerParity` as pure functions
 * nothing ever called from an actual attempt: no code path in the merge ever produced a
 * `ProtocolV4TerminalMetadata` from a real (or fake) provider attempt, wrapped a wall-clock ceiling
 * around one, or pushed matching telemetry/ledger entries. This module is that wiring -- new,
 * versioned protocol-v4 wrapper functions, never touching the frozen protocol-v3 evidence or the
 * RESOLVER-V3-039 telemetry/ledger files. It reuses V3-039's own `withWallClockCeiling` (a pure,
 * already-reviewed race between an attempt and an outer ceiling timer) rather than re-implementing
 * timeout racing.
 *
 * Every real dispatch (fake, in Phase A; a genuine provider transport in a future, separately
 * authorized live phase) must go through `recordProtocolV4Terminal` so telemetry and ledger are
 * always written together, always validated, and always parity-checked before being trusted as
 * evidence.
 */

export class ProtocolV4TelemetryLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4TelemetryLedgerError';
  }
}

/** Validates one terminal-metadata record and appends an identical copy to both the telemetry and
 * ledger arrays, then asserts they are still in parity. This is the only supported way to add an
 * entry to either array in this module -- there is no path that writes telemetry without a matching
 * ledger entry, or vice versa. */
export function recordProtocolV4Terminal(
  terminal: ProtocolV4TerminalMetadata,
  telemetry: ProtocolV4TerminalMetadata[],
  ledger: ProtocolV4TerminalMetadata[],
  context?: ProtocolV4TerminalContext,
): ProtocolV4TerminalMetadata {
  validateTerminalMetadata(terminal, context);
  telemetry.push(terminal);
  ledger.push(terminal);
  assertTelemetryLedgerParity(telemetry[telemetry.length - 1], ledger[ledger.length - 1]);
  return terminal;
}

/**
 * Races `attempt` against `ceilingMs` (reusing V3-039's `withWallClockCeiling`). On completion,
 * returns the value untouched for the caller to build its own success/failure terminal record. On
 * ceiling breach, builds the terminal record via `buildTerminalOnCeiling` (which must produce the
 * exact wall-clock contract `validateTerminalMetadata` enforces: `pricingStatus: 'estimated'`,
 * `usageStatus: 'unknown'`, `actualCostStatus: 'usage_unknown'`, `actualCostUsd: null`,
 * `failureKind: 'wall_clock_ceiling'`, `retryable: false`, reserved worst-case cost preserved, full
 * run identity), records it via `recordProtocolV4Terminal`, and never retries.
 */
export async function wrapWithProtocolV4WallClockCeiling<T>(
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
    recordProtocolV4Terminal(terminal, telemetry, ledger, context);
    return { status: 'timed_out', terminal };
  }
  return { status: 'completed', value: race.value };
}
