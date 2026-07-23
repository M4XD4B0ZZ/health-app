import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  RepresentativeHybridV1LiveCallLedger,
  RepresentativeHybridV1LiveCallLedgerError,
} from '../RepresentativeHybridV1LiveCallLedger';

function tmpLedgerPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3039-ledger-'));
  return path.join(dir, 'ledger.jsonl');
}

describe('RESOLVER-V3-039 protocol-v2 durable call ledger', () => {
  it('reservation is persisted before dispatch, and dispatch before a terminal state', () => {
    const p = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(p);
    ledger.record('call_1', 'reserved');
    ledger.record('call_1', 'dispatched');
    ledger.record('call_1', 'completed');
    const reloaded = RepresentativeHybridV1LiveCallLedger.open(p);
    const states = reloaded.allEntries().map((e) => e.state);
    expect(states).toEqual(['reserved', 'dispatched', 'completed']);
  });

  it('a completed call can never be rerun (record throws on any further transition)', () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    ledger.record('call_1', 'reserved');
    ledger.record('call_1', 'dispatched');
    ledger.record('call_1', 'completed');
    expect(() => ledger.record('call_1', 'reserved')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
    expect(() => ledger.record('call_1', 'dispatched')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
    expect(() => ledger.record('call_1', 'completed')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
  });

  it('a terminal-failure call can never be rerun', () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    ledger.record('call_1', 'reserved');
    ledger.record('call_1', 'dispatched');
    ledger.record('call_1', 'terminal_failure');
    expect(() => ledger.record('call_1', 'reserved')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
  });

  it('duplicate reservation of the same call ID fails closed', () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    ledger.record('call_1', 'reserved');
    expect(() => ledger.record('call_1', 'reserved')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
  });

  it('a conflicting state transition (e.g. dispatched before ever reserved) fails closed', () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    expect(() => ledger.record('call_1', 'dispatched')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
    expect(() => ledger.record('call_1', 'completed')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
  });

  it('a crash after reservation (no dispatch/terminal entry) leaves the call consumed on reload', () => {
    const p = tmpLedgerPath();
    const first = RepresentativeHybridV1LiveCallLedger.open(p);
    first.record('call_1', 'reserved');
    // Simulate the process dying here -- no further entry written.
    const reopened = RepresentativeHybridV1LiveCallLedger.open(p);
    expect(reopened.isConsumed('call_1')).toBe(true);
    expect(reopened.stateOf('call_1')).toBe('indeterminate_after_interruption');
  });

  it('a crash after dispatch (before a terminal state) becomes indeterminate on reload, not lost', () => {
    const p = tmpLedgerPath();
    const first = RepresentativeHybridV1LiveCallLedger.open(p);
    first.record('call_1', 'reserved');
    first.record('call_1', 'dispatched');
    const reopened = RepresentativeHybridV1LiveCallLedger.open(p);
    expect(reopened.stateOf('call_1')).toBe('indeterminate_after_interruption');
    expect(reopened.indeterminateCallIds()).toEqual(['call_1']);
  });

  it('the indeterminate transition is itself a durable, auditable ledger entry', () => {
    const p = tmpLedgerPath();
    RepresentativeHybridV1LiveCallLedger.open(p).record('call_1', 'reserved');
    RepresentativeHybridV1LiveCallLedger.open(p); // triggers recovery + append
    const thirdOpen = RepresentativeHybridV1LiveCallLedger.open(p);
    const entries = thirdOpen.allEntries();
    expect(entries).toHaveLength(2);
    expect(entries[1].state).toBe('indeterminate_after_interruption');
    expect(entries[1].details?.recoveredFromState).toBe('reserved');
  });

  it('an indeterminate call is never automatically rerun -- `record` refuses to reach that state directly', () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    expect(() => ledger.record('call_1', 'indeterminate_after_interruption')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
  });

  it('an indeterminate call requires an explicit, non-empty human note to resolve, and only from indeterminate', () => {
    const p = tmpLedgerPath();
    RepresentativeHybridV1LiveCallLedger.open(p).record('call_1', 'reserved');
    const ledger = RepresentativeHybridV1LiveCallLedger.open(p); // recovers to indeterminate
    expect(() => ledger.resolveIndeterminateCallAsTerminalFailure('call_1', '')).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
    expect(() =>
      ledger.resolveIndeterminateCallAsTerminalFailure('call_2', 'not indeterminate'),
    ).toThrow(RepresentativeHybridV1LiveCallLedgerError);
    ledger.resolveIndeterminateCallAsTerminalFailure(
      'call_1',
      'confirmed billed via provider dashboard',
    );
    expect(ledger.stateOf('call_1')).toBe('terminal_failure');
    expect(ledger.isTerminal('call_1')).toBe(true);
  });

  it('partial evidence survives process recreation: a fresh ledger instance reads back every entry a prior instance wrote', () => {
    const p = tmpLedgerPath();
    const first = RepresentativeHybridV1LiveCallLedger.open(p);
    first.record('call_1', 'reserved', { scenarioId: 'RH-1' });
    first.record('call_1', 'dispatched');
    first.record('call_1', 'completed', { inputTokens: 100 });
    first.record('call_2', 'reserved');
    // "process recreation": a brand-new instance over the same path.
    const recreated = RepresentativeHybridV1LiveCallLedger.open(p);
    expect(recreated.stateOf('call_1')).toBe('completed');
    // call_2 was left at 'reserved' -- recovered to indeterminate, never silently dropped.
    expect(recreated.stateOf('call_2')).toBe('indeterminate_after_interruption');
    expect(recreated.entryCount()).toBeGreaterThanOrEqual(5);
  });

  it('a tampered entry (hand-edited state) fails the hash chain on reload', () => {
    const p = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(p);
    ledger.record('call_1', 'reserved');
    ledger.record('call_1', 'dispatched');
    const lines = fs.readFileSync(p, 'utf-8').trimEnd().split('\n');
    const tampered = JSON.parse(lines[0]);
    tampered.state = 'completed'; // hand-edit, entryHash now stale
    lines[0] = JSON.stringify(tampered);
    fs.writeFileSync(p, lines.join('\n') + '\n');
    expect(() => RepresentativeHybridV1LiveCallLedger.open(p)).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
  });

  it('a removed/reordered entry breaks the hash chain on reload', () => {
    const p = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(p);
    ledger.record('call_1', 'reserved');
    ledger.record('call_1', 'dispatched');
    ledger.record('call_1', 'completed');
    const lines = fs.readFileSync(p, 'utf-8').trimEnd().split('\n');
    fs.writeFileSync(p, [lines[0], lines[2]].join('\n') + '\n'); // drop the middle entry
    expect(() => RepresentativeHybridV1LiveCallLedger.open(p)).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
  });

  it('a truncated final line (torn write) is safely dropped, not treated as tampering', () => {
    const p = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(p);
    ledger.record('call_1', 'reserved');
    ledger.record('call_1', 'dispatched');
    ledger.record('call_1', 'completed');
    fs.appendFileSync(p, '{"seq":4,"callId":"call_2","state":"rese'); // torn write, no trailing newline
    const reopened = RepresentativeHybridV1LiveCallLedger.open(p);
    expect(reopened.stateOf('call_1')).toBe('completed');
    expect(reopened.stateOf('call_2')).toBeNull();
  });

  it('an unknown ledger schema version fails closed on reload', () => {
    const p = tmpLedgerPath();
    RepresentativeHybridV1LiveCallLedger.open(p).record('call_1', 'reserved');
    const lines = fs.readFileSync(p, 'utf-8').trimEnd().split('\n');
    const entry = JSON.parse(lines[0]);
    entry.ledgerVersion = 'some-other-ledger-version';
    // Recompute nothing -- an unknown version must be rejected before hash verification even matters.
    fs.writeFileSync(p, JSON.stringify(entry) + '\n');
    expect(() => RepresentativeHybridV1LiveCallLedger.open(p)).toThrow(
      RepresentativeHybridV1LiveCallLedgerError,
    );
  });

  it('consumedCallIdsInReservationOrder reflects only ever-reserved calls, in first-reservation order', () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    ledger.record('call_b', 'reserved');
    ledger.record('call_a', 'reserved');
    ledger.record('call_b', 'dispatched');
    ledger.record('call_b', 'completed');
    expect(ledger.consumedCallIdsInReservationOrder()).toEqual(['call_b', 'call_a']);
  });

  it('an empty/never-opened ledger path starts with zero entries and nothing indeterminate', () => {
    const ledger = RepresentativeHybridV1LiveCallLedger.open(tmpLedgerPath());
    expect(ledger.entryCount()).toBe(0);
    expect(ledger.indeterminateCallIds()).toEqual([]);
  });
});
