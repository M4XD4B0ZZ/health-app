import { describe, it, expect, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PROTOCOL_V4_LIVE_ROOT, PROTOCOL_V4_DRY_RUN_ROOT } from '../ResolverV3048ProtocolV4';
import { deriveProtocolV4AuthorizationStorageKey } from '../ResolverV3048ProtocolV4StorageKey';
import {
  claimProtocolV4ExecutionLease,
  markProtocolV4ExecutionLeaseExecuting,
  readProtocolV4ExecutionLease,
  type ProtocolV4ExecutionLease,
} from '../ResolverV3048ProtocolV4ExecutionLease';
import {
  PROTOCOL_V4_RUNTIME_JOURNAL_SCHEMA_VERSION,
  ProtocolV4RuntimeJournalError,
  openProtocolV4RuntimeJournal,
  readProtocolV4RuntimeJournal,
  reduceProtocolV4RuntimeJournal,
  classifyProtocolV4DurableAccounting,
  protocolV4RuntimeJournalDirectory,
} from '../ResolverV3048ProtocolV4RuntimeJournal';

/**
 * RESOLVER-V3-048-INCIDENT-002 Remediation A + B -- the append-only, crash-durable runtime journal
 * and the journal reducer that derives ONLY defensible accounting states after an abrupt process
 * termination.
 *
 * Every test here uses an isolated temporary root under the real, unmodified `PROTOCOL_V4_LIVE_ROOT`
 * relative constant (anchored at a temp `repoRoot`) -- never the real repository's
 * `logs/resolver-v3-048-protocol-v4` path, and never the real incident worktree. No provider call, no
 * credential, no network.
 */

const tempDirs: string[] = [];
function freshRepoRoot(): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-journal-'));
  tempDirs.push(dir);
  return dir;
}
function liveRootUnder(repoRoot: string): string {
  return path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
}
afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const PLAN_HASH = 'journal-test-plan-hash';
const TREE_HASH = 'journal-test-tree-hash';

function claimLease(root: string, authorizationId: string): ProtocolV4ExecutionLease {
  return claimProtocolV4ExecutionLease({
    artifactStoreRoot: root,
    authorizationId,
    authorizationKind: 'human_live',
    runKind: 'human_live',
    authorizationSchemaVersion: 'resolver-v3-048-development-authorization-v1',
    authorizationRecordHash: 'journal-test-authorization-record-hash',
    phase: 'development',
    planHash: PLAN_HASH,
    executionTreeHash: TREE_HASH,
    candidateScope: ['H0', 'H1', 'H2'],
    maxCalls: 324,
    maxInputTokens: 2654208,
    maxOutputTokens: 497664,
    maxCostUsd: 5.142528,
    maxConcurrentRequests: 1,
    pricingVersion: 'anthropic-messages-2025-10-01-v1',
    modelId: 'claude-haiku-4-5-20251001',
  });
}

/** Claims a lease and drives it to `executing`, returning the live-bound root it lives under. */
function executingLease(repoRoot: string, authorizationId: string): string {
  const root = liveRootUnder(repoRoot);
  claimLease(root, authorizationId);
  markProtocolV4ExecutionLeaseExecuting(root, authorizationId);
  return root;
}

function openJournal(repoRoot: string, root: string, authorizationId: string) {
  return openProtocolV4RuntimeJournal({
    artifactStoreRoot: root,
    authorizationId,
    planHash: PLAN_HASH,
    executionTreeHash: TREE_HASH,
    repoRoot,
  });
}

describe('RESOLVER-V3-048-INCIDENT-002 Remediation A -- append-only crash-durable runtime journal', () => {
  it('writes an exclusively-created, sequence-addressed, hash-validated executing_started event bound to the persisted lease', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:exec-started';
    const root = executingLease(repoRoot, authorizationId);
    const journal = openJournal(repoRoot, root, authorizationId);

    const event = journal.appendExecutingStarted();

    expect(event.journalSchemaVersion).toBe(PROTOCOL_V4_RUNTIME_JOURNAL_SCHEMA_VERSION);
    expect(event.sequence).toBe(1);
    expect(event.kind).toBe('executing_started');
    expect(event.authorizationId).toBe(authorizationId);
    expect(event.planHash).toBe(PLAN_HASH);
    expect(event.executionTreeHash).toBe(TREE_HASH);
    // Bound to the CURRENT persisted lease version/status/hash, re-read from storage.
    const lease = readProtocolV4ExecutionLease(root, authorizationId)!;
    expect(event.leaseId).toBe(lease.leaseId);
    expect(event.leaseVersion).toBe(lease.version);
    expect(event.leaseStatus).toBe('executing');
    expect(event.leaseHash).toBe(lease.leaseHash);
    // Remediation D: durable liveness identity.
    expect(typeof event.liveness.pid).toBe('number');
    expect(event.liveness.pid).toBe(process.pid);
    expect(typeof event.liveness.hostId).toBe('string');
    expect(event.liveness.hostId.length).toBeGreaterThan(0);
    expect(typeof event.liveness.processStartedAtIso).toBe('string');
    expect(typeof event.liveness.recordedAtIso).toBe('string');

    // Durable: written under the canonical live root only, and readable back.
    const dir = protocolV4RuntimeJournalDirectory(root, authorizationId);
    expect(dir).toBe(
      path.join(
        path.resolve(root),
        'runtime-journal',
        deriveProtocolV4AuthorizationStorageKey(authorizationId),
      ),
    );
    expect(fs.existsSync(path.join(dir, 'e1.json'))).toBe(true);
    expect(readProtocolV4RuntimeJournal(root, authorizationId, repoRoot)).toEqual([event]);
  });

  it('is append-only: every event gets the next sequence and an existing sequence file is never overwritten', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:append-only';
    const root = executingLease(repoRoot, authorizationId);
    const journal = openJournal(repoRoot, root, authorizationId);

    journal.appendExecutingStarted();
    const intent = journal.appendDispatchIntent({
      candidateId: 'H0',
      callId: 'development:H0:s1:0',
      dispatchId: 'development:H0:s1:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      reservedInputTokensUpperBound: 8192,
      reservedOutputTokensUpperBound: 1536,
      reservedCostUsdUpperBound: 0.015872,
    });
    expect(intent.sequence).toBe(2);

    const dir = protocolV4RuntimeJournalDirectory(root, authorizationId);
    const beforeBytes = fs.readFileSync(path.join(dir, 'e1.json'));
    journal.appendTerminalizationStarted();
    // e1 is byte-for-byte immutable after creation.
    expect(fs.readFileSync(path.join(dir, 'e1.json'))).toEqual(beforeBytes);
    expect(
      readProtocolV4RuntimeJournal(root, authorizationId, repoRoot).map((e) => e.kind),
    ).toEqual(['executing_started', 'dispatch_intent', 'terminalization_started']);
  });

  it('rejects a tampered event on readback via its own hash', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:tamper';
    const root = executingLease(repoRoot, authorizationId);
    openJournal(repoRoot, root, authorizationId).appendExecutingStarted();

    const eventPath = path.join(
      protocolV4RuntimeJournalDirectory(root, authorizationId),
      'e1.json',
    );
    const parsed = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
    parsed.planHash = 'tampered-plan-hash';
    fs.writeFileSync(eventPath, JSON.stringify(parsed));

    expect(() => readProtocolV4RuntimeJournal(root, authorizationId, repoRoot)).toThrow(
      /PROTOCOL_V4_RUNTIME_JOURNAL_READBACK_HASH_MISMATCH/,
    );
  });

  it('refuses to open a journal outside the canonical live root', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:wrong-root';
    executingLease(repoRoot, authorizationId);
    expect(() =>
      openProtocolV4RuntimeJournal({
        artifactStoreRoot: path.resolve(repoRoot, PROTOCOL_V4_DRY_RUN_ROOT),
        authorizationId,
        planHash: PLAN_HASH,
        executionTreeHash: TREE_HASH,
        repoRoot,
      }),
    ).toThrow(/PROTOCOL_V4_ARTIFACT_STORE_DRY_RUN_PATH_FORBIDDEN_IN_LIVE/);
  });

  it('fails closed when the journal is opened against a plan/tree identity the persisted lease does not carry', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:identity-mismatch';
    const root = executingLease(repoRoot, authorizationId);
    expect(() =>
      openProtocolV4RuntimeJournal({
        artifactStoreRoot: root,
        authorizationId,
        planHash: 'a-different-plan-hash',
        executionTreeHash: TREE_HASH,
        repoRoot,
      }),
    ).toThrow(ProtocolV4RuntimeJournalError);
  });
});

describe('RESOLVER-V3-048-INCIDENT-002 Remediation B -- durable accounting classification', () => {
  it('case 1: execution started and no dispatch intent exists -- exact zero is defensible', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:case-1';
    const root = executingLease(repoRoot, authorizationId);
    openJournal(repoRoot, root, authorizationId).appendExecutingStarted();

    const accounting = classifyProtocolV4DurableAccounting({
      artifactStoreRoot: root,
      authorizationId,
      repoRoot,
    });
    expect(accounting.classification).toBe('EXACT_ZERO');
    expect(accounting.executionStarted).toBe(true);
    expect(accounting.dispatchIntents).toBe(0);
    expect(accounting.openDispatchIntents).toBe(0);
    expect(accounting.providerHttpRequestsLowerBound).toBe(0);
    expect(accounting.providerHttpRequestsUpperBound).toBe(0);
    expect(accounting.confirmedCostUsd).toBe(0);
  });

  it('case 2: every intent has a completion carrying accepted usage -- exact accounting is derivable', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:case-2';
    const root = executingLease(repoRoot, authorizationId);
    const journal = openJournal(repoRoot, root, authorizationId);
    journal.appendExecutingStarted();
    journal.appendDispatchIntent({
      candidateId: 'H0',
      callId: 'development:H0:s1:0',
      dispatchId: 'development:H0:s1:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      reservedInputTokensUpperBound: 8192,
      reservedOutputTokensUpperBound: 1536,
      reservedCostUsdUpperBound: 0.015872,
    });
    journal.appendDispatchCompleted({
      candidateId: 'H0',
      callId: 'development:H0:s1:0',
      dispatchId: 'development:H0:s1:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      usage: {
        usageStatus: 'reported',
        inputTokens: 120,
        outputTokens: 40,
        actualCostUsd: 0.00031,
        httpStatus: 200,
      },
    });

    const accounting = classifyProtocolV4DurableAccounting({
      artifactStoreRoot: root,
      authorizationId,
      repoRoot,
    });
    expect(accounting.classification).toBe('EXACT');
    expect(accounting.dispatchIntents).toBe(1);
    expect(accounting.openDispatchIntents).toBe(0);
    expect(accounting.providerHttpRequestsLowerBound).toBe(1);
    expect(accounting.providerHttpRequestsUpperBound).toBe(1);
    expect(accounting.confirmedInputTokens).toBe(120);
    expect(accounting.confirmedOutputTokens).toBe(40);
    expect(accounting.confirmedCostUsd).toBeCloseTo(0.00031, 10);
    // Null-when-exact, mirroring the existing success/failure snapshot convention.
    expect(accounting.reservedCostUsdUpperBound).toBeNull();
  });

  it('case 3: an intent with no terminal event is POSSIBLE_NONZERO and never exact zero, keeping durable lower bounds and reserved upper bounds', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:case-3';
    const root = executingLease(repoRoot, authorizationId);
    const journal = openJournal(repoRoot, root, authorizationId);
    journal.appendExecutingStarted();
    journal.appendDispatchIntent({
      candidateId: 'H0',
      callId: 'development:H0:s1:0',
      dispatchId: 'development:H0:s1:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      reservedInputTokensUpperBound: 8192,
      reservedOutputTokensUpperBound: 1536,
      reservedCostUsdUpperBound: 0.015872,
    });
    journal.appendDispatchCompleted({
      candidateId: 'H0',
      callId: 'development:H0:s1:0',
      dispatchId: 'development:H0:s1:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      usage: {
        usageStatus: 'reported',
        inputTokens: 100,
        outputTokens: 20,
        actualCostUsd: 0.0002,
        httpStatus: 200,
      },
    });
    // A second intent that never resolved -- exactly the incident shape.
    journal.appendDispatchIntent({
      candidateId: 'H0',
      callId: 'development:H0:s2:0',
      dispatchId: 'development:H0:s2:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      reservedInputTokensUpperBound: 8192,
      reservedOutputTokensUpperBound: 1536,
      reservedCostUsdUpperBound: 0.015872,
    });

    const accounting = classifyProtocolV4DurableAccounting({
      artifactStoreRoot: root,
      authorizationId,
      repoRoot,
    });
    expect(accounting.classification).toBe('POSSIBLE_NONZERO');
    expect(accounting.dispatchIntents).toBe(2);
    expect(accounting.openDispatchIntents).toBe(1);
    // Durable lower bound survives: one dispatch is proven to have reached a real response.
    expect(accounting.providerHttpRequestsLowerBound).toBe(1);
    expect(accounting.providerHttpRequestsUpperBound).toBe(2);
    expect(accounting.confirmedInputTokens).toBe(100);
    expect(accounting.confirmedOutputTokens).toBe(20);
    expect(accounting.confirmedCostUsd).toBeCloseTo(0.0002, 10);
    // Reserved upper bounds remain available for the unresolved dispatch.
    expect(accounting.reservedInputTokensUpperBound).toBe(16384);
    expect(accounting.reservedOutputTokensUpperBound).toBe(3072);
    expect(accounting.reservedCostUsdUpperBound).toBeCloseTo(0.031744, 10);
  });

  it('case 4: a legacy uninstrumented executing lease with no journal is POSSIBLE_NONZERO, never exact zero', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:case-4-legacy';
    const root = executingLease(repoRoot, authorizationId);
    // No journal was ever written -- exactly the RESOLVER-V3-048-INCIDENT-002 evidence shape.
    expect(fs.existsSync(protocolV4RuntimeJournalDirectory(root, authorizationId))).toBe(false);

    const accounting = classifyProtocolV4DurableAccounting({
      artifactStoreRoot: root,
      authorizationId,
      repoRoot,
    });
    expect(accounting.classification).toBe('POSSIBLE_NONZERO');
    expect(accounting.executionStarted).toBe(false);
    expect(accounting.journalPresent).toBe(false);
    expect(accounting.providerHttpRequestsLowerBound).toBe(0);
    expect(accounting.providerHttpRequestsUpperBound).toBeNull();
  });

  it('a dispatch_failed terminal keeps the intent resolved but never lets the run be called exact', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:failed-dispatch';
    const root = executingLease(repoRoot, authorizationId);
    const journal = openJournal(repoRoot, root, authorizationId);
    journal.appendExecutingStarted();
    journal.appendDispatchIntent({
      candidateId: 'H1',
      callId: 'development:H1:s1:0',
      dispatchId: 'development:H1:s1:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      reservedInputTokensUpperBound: 8192,
      reservedOutputTokensUpperBound: 1536,
      reservedCostUsdUpperBound: 0.015872,
    });
    journal.appendDispatchFailed({
      candidateId: 'H1',
      callId: 'development:H1:s1:0',
      dispatchId: 'development:H1:s1:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      failureKind: 'transport_error',
    });

    const accounting = classifyProtocolV4DurableAccounting({
      artifactStoreRoot: root,
      authorizationId,
      repoRoot,
    });
    expect(accounting.classification).toBe('PARTIAL');
    expect(accounting.openDispatchIntents).toBe(0);
    // A failed dispatch never proves a response arrived, but the intent proves a request MAY have
    // occurred -- so it stays inside the upper bound and out of the lower bound.
    expect(accounting.providerHttpRequestsLowerBound).toBe(0);
    expect(accounting.providerHttpRequestsUpperBound).toBe(1);
    expect(accounting.reservedCostUsdUpperBound).toBeCloseTo(0.015872, 10);
  });

  it('reduces an already-read event list identically to the storage-backed classifier', () => {
    const repoRoot = freshRepoRoot();
    const authorizationId = 'journal:reduce-parity';
    const root = executingLease(repoRoot, authorizationId);
    const journal = openJournal(repoRoot, root, authorizationId);
    journal.appendExecutingStarted();
    journal.appendDispatchIntent({
      candidateId: 'H2',
      callId: 'development:H2:s1:0',
      dispatchId: 'development:H2:s1:0#1',
      modelId: 'claude-haiku-4-5-20251001',
      pricingVersion: 'anthropic-messages-2025-10-01-v1',
      reservedInputTokensUpperBound: 8192,
      reservedOutputTokensUpperBound: 1536,
      reservedCostUsdUpperBound: 0.015872,
    });

    const events = readProtocolV4RuntimeJournal(root, authorizationId, repoRoot);
    expect(reduceProtocolV4RuntimeJournal(events)).toEqual(
      classifyProtocolV4DurableAccounting({
        artifactStoreRoot: root,
        authorizationId,
        repoRoot,
      }),
    );
  });
});
