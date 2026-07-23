import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { REPRESENTATIVE_HYBRID_V1_LIVE_LEDGER_SCHEMA_VERSION } from './RepresentativeHybridV1LiveVersions';

/**
 * RESOLVER-V3-039 protocol-v2 remediation: a durable, append-only, tamper-evident ledger of every
 * planned Variant B/C provider call's lifecycle state. Fixes Defect 5 of
 * `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md` (paid-call evidence was previously
 * held only in memory until an entire partition finished; a process crash after paid requests could
 * lose completed-call identities, usage, cost accounting, and consumed reservations, risking an
 * unknowing repeat of an already-billed call).
 *
 * Format: one JSON object per line (JSONL), hash-chained (`prevEntryHash` -> `entryHash`) so a
 * removed, reordered, or hand-edited line is detected on load, never silently accepted. Never
 * closed/rewritten -- entries are only ever appended.
 */

export type RepresentativeHybridV1LiveCallLedgerState =
  | 'planned'
  | 'reserved'
  | 'dispatched'
  | 'completed'
  | 'terminal_failure'
  | 'indeterminate_after_interruption';

const TERMINAL_STATES: readonly RepresentativeHybridV1LiveCallLedgerState[] = [
  'completed',
  'terminal_failure',
  'indeterminate_after_interruption',
];

const CONSUMED_STATES: readonly RepresentativeHybridV1LiveCallLedgerState[] = [
  'reserved',
  'dispatched',
  ...TERMINAL_STATES,
];

export interface RepresentativeHybridV1LiveCallLedgerEntry {
  ledgerVersion: typeof REPRESENTATIVE_HYBRID_V1_LIVE_LEDGER_SCHEMA_VERSION;
  seq: number;
  callId: string;
  state: RepresentativeHybridV1LiveCallLedgerState;
  atUtc: string;
  details: Record<string, unknown> | null;
  prevEntryHash: string | null;
  entryHash: string;
}

export class RepresentativeHybridV1LiveCallLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveCallLedgerError';
  }
}

function computeEntryHash(
  fields: Omit<RepresentativeHybridV1LiveCallLedgerEntry, 'entryHash'>,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        fields.ledgerVersion,
        fields.seq,
        fields.callId,
        fields.state,
        fields.atUtc,
        fields.details,
        fields.prevEntryHash,
      ]),
    )
    .digest('hex');
}

const VALID_PREDECESSORS: Record<
  RepresentativeHybridV1LiveCallLedgerState,
  readonly (RepresentativeHybridV1LiveCallLedgerState | null)[]
> = {
  planned: [null],
  reserved: [null, 'planned'],
  dispatched: ['reserved'],
  completed: ['reserved', 'dispatched'],
  terminal_failure: ['reserved', 'dispatched'],
  // Only reachable via the internal recovery path at load time, never via the public `record()`
  // API -- see `recoverIndeterminateEntries`.
  indeterminate_after_interruption: ['reserved', 'dispatched'],
};

export class RepresentativeHybridV1LiveCallLedger {
  private entries: RepresentativeHybridV1LiveCallLedgerEntry[] = [];
  private latestByCallId = new Map<string, RepresentativeHybridV1LiveCallLedgerEntry>();

  private constructor(private readonly path: string) {}

  /**
   * Opens (creating if absent) the ledger at `path`. On open, any call whose latest persisted
   * state is `reserved` or `dispatched` (never reached a terminal state before the process that
   * wrote it stopped) is automatically transitioned to `indeterminate_after_interruption` -- this
   * transition is itself appended as a durable, auditable ledger entry, never silently inferred.
   * An indeterminate call retains its full reservation (see
   * `RepresentativeHybridV1LiveCumulativeBudget.ts`) and is never rerun automatically.
   */
  static open(path: string): RepresentativeHybridV1LiveCallLedger {
    const ledger = new RepresentativeHybridV1LiveCallLedger(path);
    if (fs.existsSync(path)) {
      ledger.loadAndValidate();
      ledger.recoverIndeterminateEntries();
    }
    return ledger;
  }

  private loadAndValidate(): void {
    const raw = fs.readFileSync(this.path, 'utf-8');
    const lines = raw.split('\n').filter((l) => l.length > 0);
    let prevHash: string | null = null;
    let prevSeq = 0;
    const parsed: RepresentativeHybridV1LiveCallLedgerEntry[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const isLastLine = i === lines.length - 1;
      let entry: RepresentativeHybridV1LiveCallLedgerEntry;
      try {
        entry = JSON.parse(lines[i]) as RepresentativeHybridV1LiveCallLedgerEntry;
      } catch (e) {
        if (isLastLine) {
          // A torn write can only ever corrupt the final appended line (each append is a single,
          // fsync'd write of one complete line). Treat an unparseable final line as "the append
          // never durably completed" -- safe under-counting, not silent tampering acceptance.
          break;
        }
        throw new RepresentativeHybridV1LiveCallLedgerError(
          `Call ledger is corrupt: line ${i + 1} is not valid JSON: ${(e as Error).message}`,
        );
      }
      if (entry.ledgerVersion !== REPRESENTATIVE_HYBRID_V1_LIVE_LEDGER_SCHEMA_VERSION) {
        throw new RepresentativeHybridV1LiveCallLedgerError(
          `Call ledger line ${i + 1} has unknown ledgerVersion "${String(entry.ledgerVersion)}".`,
        );
      }
      if (entry.seq !== prevSeq + 1) {
        throw new RepresentativeHybridV1LiveCallLedgerError(
          `Call ledger sequence gap/out-of-order at line ${i + 1}: expected seq ${prevSeq + 1}, got ${entry.seq}.`,
        );
      }
      if (entry.prevEntryHash !== prevHash) {
        throw new RepresentativeHybridV1LiveCallLedgerError(
          `Call ledger hash-chain broken at line ${i + 1} (tampered or reordered entry).`,
        );
      }
      const { entryHash, ...fields } = entry;
      const recomputed = computeEntryHash(fields);
      if (recomputed !== entryHash) {
        throw new RepresentativeHybridV1LiveCallLedgerError(
          `Call ledger entry hash mismatch at line ${i + 1} (tampered entry content).`,
        );
      }
      parsed.push(entry);
      prevHash = entryHash;
      prevSeq = entry.seq;
    }
    for (const entry of parsed) {
      this.appendInMemory(entry);
    }
  }

  private recoverIndeterminateEntries(): void {
    const toRecover = [...this.latestByCallId.values()].filter(
      (e) => e.state === 'reserved' || e.state === 'dispatched',
    );
    for (const entry of toRecover.sort((a, b) => a.seq - b.seq)) {
      this.appendEntry(entry.callId, 'indeterminate_after_interruption', {
        recoveredFromState: entry.state,
        reason:
          'process interrupted after this call was reserved/dispatched but before it reached a terminal state',
      });
    }
  }

  private appendInMemory(entry: RepresentativeHybridV1LiveCallLedgerEntry): void {
    this.entries.push(entry);
    this.latestByCallId.set(entry.callId, entry);
  }

  private appendEntry(
    callId: string,
    state: RepresentativeHybridV1LiveCallLedgerState,
    details: Record<string, unknown> | null,
  ): RepresentativeHybridV1LiveCallLedgerEntry {
    const prev = this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
    const fields: Omit<RepresentativeHybridV1LiveCallLedgerEntry, 'entryHash'> = {
      ledgerVersion: REPRESENTATIVE_HYBRID_V1_LIVE_LEDGER_SCHEMA_VERSION,
      seq: this.entries.length + 1,
      callId,
      state,
      atUtc: new Date().toISOString(),
      details,
      prevEntryHash: prev?.entryHash ?? null,
    };
    const entryHash = computeEntryHash(fields);
    const entry: RepresentativeHybridV1LiveCallLedgerEntry = { ...fields, entryHash };
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
    const fd = fs.openSync(this.path, 'a');
    try {
      fs.writeSync(fd, JSON.stringify(entry) + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    this.appendInMemory(entry);
    return entry;
  }

  /**
   * Records a new state for `callId`. Fails closed (throws
   * `RepresentativeHybridV1LiveCallLedgerError`) on any illegal transition: rerunning a
   * `completed`/`terminal_failure`/`indeterminate_after_interruption` call, re-reserving an
   * already-reserved call, or any other conflicting/duplicate state.
   */
  record(
    callId: string,
    state: RepresentativeHybridV1LiveCallLedgerState,
    details: Record<string, unknown> | null = null,
  ): RepresentativeHybridV1LiveCallLedgerEntry {
    if (state === 'indeterminate_after_interruption') {
      throw new RepresentativeHybridV1LiveCallLedgerError(
        '"indeterminate_after_interruption" may only be reached via the automatic load-time recovery path, never recorded directly.',
      );
    }
    const current = this.latestByCallId.get(callId);
    const currentState = current?.state ?? null;
    const allowedPredecessors = VALID_PREDECESSORS[state];
    if (!allowedPredecessors.includes(currentState)) {
      throw new RepresentativeHybridV1LiveCallLedgerError(
        `Call ledger refuses illegal transition for "${callId}": cannot go from ${
          currentState ?? '(none)'
        } to "${state}". Completed/terminal-failure/indeterminate calls are never rerun; duplicate reservations are refused.`,
      );
    }
    return this.appendEntry(callId, state, details);
  }

  /**
   * The only legal way out of `indeterminate_after_interruption`: an explicit, human-invoked
   * resolution that records the call as a terminal failure (its reservation was already
   * permanently consumed and stays consumed either way -- see
   * `RepresentativeHybridV1LiveCumulativeBudget.ts`). Never called automatically by the harness.
   */
  resolveIndeterminateCallAsTerminalFailure(
    callId: string,
    humanNote: string,
  ): RepresentativeHybridV1LiveCallLedgerEntry {
    const current = this.latestByCallId.get(callId);
    if (current?.state !== 'indeterminate_after_interruption') {
      throw new RepresentativeHybridV1LiveCallLedgerError(
        `Call "${callId}" is not in an indeterminate state (current: ${current?.state ?? '(none)'}); nothing to resolve.`,
      );
    }
    if (!humanNote || humanNote.trim().length === 0) {
      throw new RepresentativeHybridV1LiveCallLedgerError(
        'Resolving an indeterminate call requires a non-empty human note (explicit human resolution, never automatic).',
      );
    }
    const prev = this.entries[this.entries.length - 1];
    const fields: Omit<RepresentativeHybridV1LiveCallLedgerEntry, 'entryHash'> = {
      ledgerVersion: REPRESENTATIVE_HYBRID_V1_LIVE_LEDGER_SCHEMA_VERSION,
      seq: this.entries.length + 1,
      callId,
      state: 'terminal_failure',
      atUtc: new Date().toISOString(),
      details: { resolvedByHuman: true, humanNote },
      prevEntryHash: prev?.entryHash ?? null,
    };
    const entryHash = computeEntryHash(fields);
    const entry = { ...fields, entryHash };
    const fd = fs.openSync(this.path, 'a');
    try {
      fs.writeSync(fd, JSON.stringify(entry) + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    this.appendInMemory(entry);
    return entry;
  }

  stateOf(callId: string): RepresentativeHybridV1LiveCallLedgerState | null {
    return this.latestByCallId.get(callId)?.state ?? null;
  }

  isConsumed(callId: string): boolean {
    const state = this.stateOf(callId);
    return state !== null && CONSUMED_STATES.includes(state);
  }

  isTerminal(callId: string): boolean {
    const state = this.stateOf(callId);
    return state !== null && TERMINAL_STATES.includes(state);
  }

  indeterminateCallIds(): readonly string[] {
    return [...this.latestByCallId.values()]
      .filter((e) => e.state === 'indeterminate_after_interruption')
      .map((e) => e.callId);
  }

  /** Every call ID that has ever been reserved, in the order it was first reserved -- the replay
   * order `RepresentativeHybridV1LiveCumulativeBudget.ts` uses to reconstruct cumulative spend. */
  consumedCallIdsInReservationOrder(): readonly string[] {
    // Only 'reserved' counts as consuming budget allowance; 'planned' alone never does.
    const firstReservedSeq = new Map<string, number>();
    for (const entry of this.entries) {
      if (entry.state === 'reserved' && !firstReservedSeq.has(entry.callId)) {
        firstReservedSeq.set(entry.callId, entry.seq);
      }
    }
    return [...firstReservedSeq.entries()].sort((a, b) => a[1] - b[1]).map(([callId]) => callId);
  }

  allEntries(): readonly RepresentativeHybridV1LiveCallLedgerEntry[] {
    return this.entries;
  }

  entryCount(): number {
    return this.entries.length;
  }
}
