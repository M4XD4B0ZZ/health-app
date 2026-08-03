import { describe, it, expect, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PROTOCOL_V4_LIVE_ROOT, PROTOCOL_V4_DRY_RUN_ROOT } from '../ResolverV3048ProtocolV4';
import { deriveProtocolV4AuthorizationStorageKey } from '../ResolverV3048ProtocolV4StorageKey';
import {
  claimProtocolV4ExecutionLease,
  markProtocolV4ExecutionLeaseExecuting,
  markProtocolV4ExecutionLeaseTerminalFailure,
  readProtocolV4ExecutionLease,
  type ProtocolV4ExecutionLease,
} from '../ResolverV3048ProtocolV4ExecutionLease';
import { consumeProtocolV4LiveAuthorizationAtomically } from '../ResolverV3048ProtocolV4ArtifactStore';
import { openProtocolV4RuntimeJournal } from '../ResolverV3048ProtocolV4RuntimeJournal';
import {
  PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN,
  PROTOCOL_V4_LEASE_RECOVERY_REASON_CODES,
  ProtocolV4LeaseRecoveryError,
  recoverProtocolV4AbandonedExecutionLeaseGoverned,
  readProtocolV4LeaseRecoveryRecords,
} from '../ResolverV3048ProtocolV4LeaseRecovery';

/**
 * RESOLVER-V3-048-INCIDENT-002 Remediation C + D -- the governed, operator-invocable abandoned-lease
 * recovery path.
 *
 * Every test uses an ISOLATED temporary root anchored at a temp `repoRoot` under the real,
 * unmodified `PROTOCOL_V4_LIVE_ROOT` constant. The real incident worktree
 * (`D:\Workspaces_VSCode\HealthApp-live-auth`) and the real repository live root are never read,
 * written, or referenced. No provider call, no network, no credential.
 */

const tempDirs: string[] = [];
function freshRepoRoot(): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-recovery-'));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const PLAN_HASH = 'recovery-test-plan-hash';
const TREE_HASH = 'recovery-test-tree-hash';
const APPROVAL = 'HUMAN-APPROVAL/incident-002/test';

function claimLease(root: string, authorizationId: string): ProtocolV4ExecutionLease {
  return claimProtocolV4ExecutionLease({
    artifactStoreRoot: root,
    authorizationId,
    authorizationKind: 'human_live',
    runKind: 'human_live',
    authorizationSchemaVersion: 'resolver-v3-048-development-authorization-v1',
    authorizationRecordHash: 'recovery-test-authorization-record-hash',
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

interface Scenario {
  repoRoot: string;
  root: string;
  authorizationId: string;
  lease: ProtocolV4ExecutionLease;
}

function executingScenario(authorizationId = 'recovery:executing'): Scenario {
  const repoRoot = freshRepoRoot();
  const root = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
  claimLease(root, authorizationId);
  const lease = markProtocolV4ExecutionLeaseExecuting(root, authorizationId);
  return { repoRoot, root, authorizationId, lease };
}

function validInput(scenario: Scenario, overrides: Record<string, unknown> = {}) {
  return {
    artifactStoreRoot: scenario.root,
    authorizationId: scenario.authorizationId,
    expectedLeaseVersion: scenario.lease.version,
    expectedLeaseStatus: 'executing' as const,
    expectedLeaseHash: scenario.lease.leaseHash,
    reasonCode: 'operator_interrupted_process' as const,
    humanRecoveryApprovalReference: APPROVAL,
    confirmationToken: PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN,
    confirmedExecutingProcessNotRunning: true,
    env: {} as Record<string, string | undefined>,
    repoRoot: scenario.repoRoot,
    ...overrides,
  };
}

function leaseVersionBytes(root: string, authorizationId: string): Map<string, Buffer> {
  const dir = path.join(
    path.resolve(root),
    'leases',
    deriveProtocolV4AuthorizationStorageKey(authorizationId),
  );
  const out = new Map<string, Buffer>();
  for (const entry of fs.readdirSync(dir)) {
    if (/^v\d+\.json$/.test(entry)) out.set(entry, fs.readFileSync(path.join(dir, entry)));
  }
  return out;
}

describe('RESOLVER-V3-048-INCIDENT-002 Remediation C -- governed abandoned-lease recovery', () => {
  it('appends exactly one abandoned version, preserves every earlier version byte-for-byte, and durably records reason/approval/pre-recovery hash', () => {
    const scenario = executingScenario();
    const before = leaseVersionBytes(scenario.root, scenario.authorizationId);
    expect([...before.keys()].sort()).toEqual(['v1.json', 'v2.json']);

    const result = recoverProtocolV4AbandonedExecutionLeaseGoverned(validInput(scenario));

    expect(result.recoveredLeaseStatus).toBe('abandoned');
    expect(result.preRecoveryLeaseVersion).toBe(2);
    expect(result.recoveredLeaseVersion).toBe(3);
    expect(result.preRecoveryLeaseHash).toBe(scenario.lease.leaseHash);
    expect(result.reasonCode).toBe('operator_interrupted_process');
    expect(result.humanRecoveryApprovalReference).toBe(APPROVAL);
    expect(typeof result.recoveredAtIso).toBe('string');
    expect(result.authorizationReusable).toBe(false);

    // Exactly one new version; every earlier version byte-for-byte identical.
    const after = leaseVersionBytes(scenario.root, scenario.authorizationId);
    expect([...after.keys()].sort()).toEqual(['v1.json', 'v2.json', 'v3.json']);
    for (const [name, bytes] of before) {
      expect(after.get(name)).toEqual(bytes);
    }
    const current = readProtocolV4ExecutionLease(scenario.root, scenario.authorizationId)!;
    expect(current.status).toBe('abandoned');
    expect(current.version).toBe(3);

    // Durable, separately hashed, append-only recovery record.
    const records = readProtocolV4LeaseRecoveryRecords(
      scenario.root,
      scenario.authorizationId,
      scenario.repoRoot,
    );
    expect(records).toHaveLength(1);
    expect(records[0].reasonCode).toBe('operator_interrupted_process');
    expect(records[0].humanRecoveryApprovalReference).toBe(APPROVAL);
    expect(records[0].preRecoveryLeaseHash).toBe(scenario.lease.leaseHash);
    expect(records[0].recoveredLeaseVersion).toBe(3);
    expect(typeof records[0].recoveryRecordHash).toBe('string');
    expect(records[0].recoveryRecordHash).toBe(result.recoveryRecordHash);
  });

  it('fails closed on a second recovery invocation', () => {
    const scenario = executingScenario();
    recoverProtocolV4AbandonedExecutionLeaseGoverned(validInput(scenario));
    expect(() => recoverProtocolV4AbandonedExecutionLeaseGoverned(validInput(scenario))).toThrow(
      ProtocolV4LeaseRecoveryError,
    );
    // Still exactly one new version and one record -- the failed retry changed nothing.
    expect([...leaseVersionBytes(scenario.root, scenario.authorizationId).keys()].sort()).toEqual([
      'v1.json',
      'v2.json',
      'v3.json',
    ]);
    expect(
      readProtocolV4LeaseRecoveryRecords(
        scenario.root,
        scenario.authorizationId,
        scenario.repoRoot,
      ),
    ).toHaveLength(1);
  });

  it('refuses to run when an API key is present in the process environment', () => {
    const scenario = executingScenario();
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, { env: { ANTHROPIC_API_KEY: 'test-key-not-real' } }),
      ),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_CREDENTIAL_PRESENT/);
    expect(readProtocolV4ExecutionLease(scenario.root, scenario.authorizationId)!.status).toBe(
      'executing',
    );
  });

  it('requires the exact confirmation token', () => {
    const scenario = executingScenario();
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, { confirmationToken: 'recover-abandoned-execution-lease' }),
      ),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_CONFIRMATION_TOKEN_MISMATCH/);
  });

  it('requires an enumerated reason code', () => {
    const scenario = executingScenario();
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, { reasonCode: 'because_i_said_so' }),
      ),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_UNKNOWN_REASON_CODE/);
    expect(PROTOCOL_V4_LEASE_RECOVERY_REASON_CODES).toContain('operator_interrupted_process');
  });

  it('requires a non-empty human recovery approval reference', () => {
    const scenario = executingScenario();
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, { humanRecoveryApprovalReference: '   ' }),
      ),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_APPROVAL_REFERENCE_REQUIRED/);
  });

  it('requires explicit human confirmation that the executing process is not running (never inferred)', () => {
    const scenario = executingScenario();
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, { confirmedExecutingProcessNotRunning: false }),
      ),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_LIVENESS_CONFIRMATION_REQUIRED/);
  });

  it('requires the expected current lease version, status, and hash to match storage exactly', () => {
    const scenario = executingScenario();
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, { expectedLeaseVersion: 1 }),
      ),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_LEASE_VERSION_MISMATCH/);
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, { expectedLeaseHash: 'not-the-real-hash' }),
      ),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_LEASE_HASH_MISMATCH/);
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, { expectedLeaseStatus: 'claimed' }),
      ),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_EXPECTED_STATUS_MUST_BE_EXECUTING/);
  });

  it('refuses a lease that is not currently executing', () => {
    const repoRoot = freshRepoRoot();
    const root = path.resolve(repoRoot, PROTOCOL_V4_LIVE_ROOT);
    const authorizationId = 'recovery:claimed-only';
    const lease = claimLease(root, authorizationId);
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned({
        ...validInput({ repoRoot, root, authorizationId, lease }),
        expectedLeaseVersion: lease.version,
        expectedLeaseHash: lease.leaseHash,
      }),
    ).toThrow(/PROTOCOL_V4_LEASE_RECOVERY_LEASE_NOT_EXECUTING/);
  });

  it('refuses when a terminal lease version already exists', () => {
    const scenario = executingScenario('recovery:already-terminal');
    markProtocolV4ExecutionLeaseTerminalFailure(scenario.root, scenario.authorizationId);
    expect(() => recoverProtocolV4AbandonedExecutionLeaseGoverned(validInput(scenario))).toThrow(
      /PROTOCOL_V4_LEASE_RECOVERY_TERMINAL_VERSION_ALREADY_EXISTS/,
    );
  });

  it('refuses when the authorization was already consumed', () => {
    const scenario = executingScenario('recovery:consumed');
    consumeProtocolV4LiveAuthorizationAtomically(
      scenario.root,
      scenario.authorizationId,
      scenario.repoRoot,
    );
    expect(() => recoverProtocolV4AbandonedExecutionLeaseGoverned(validInput(scenario))).toThrow(
      /PROTOCOL_V4_LEASE_RECOVERY_AUTHORIZATION_ALREADY_CONSUMED/,
    );
  });

  it('refuses a root that is not the canonical live root', () => {
    const scenario = executingScenario('recovery:wrong-root');
    expect(() =>
      recoverProtocolV4AbandonedExecutionLeaseGoverned(
        validInput(scenario, {
          artifactStoreRoot: path.resolve(scenario.repoRoot, PROTOCOL_V4_DRY_RUN_ROOT),
        }),
      ),
    ).toThrow(/PROTOCOL_V4_ARTIFACT_STORE_DRY_RUN_PATH_FORBIDDEN_IN_LIVE/);
  });

  it('carries the durable accounting classification and the recorded liveness of the interrupted run', () => {
    const scenario = executingScenario('recovery:with-journal');
    const journal = openProtocolV4RuntimeJournal({
      artifactStoreRoot: scenario.root,
      authorizationId: scenario.authorizationId,
      planHash: PLAN_HASH,
      executionTreeHash: TREE_HASH,
      repoRoot: scenario.repoRoot,
    });
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

    const result = recoverProtocolV4AbandonedExecutionLeaseGoverned(validInput(scenario));
    expect(result.durableAccounting.classification).toBe('POSSIBLE_NONZERO');
    expect(result.durableAccounting.openDispatchIntents).toBe(1);
    expect(result.recordedLiveness).not.toBeNull();
    expect(result.recordedLiveness!.pid).toBe(process.pid);
    // The recovery itself is durably journalled when a journal already exists.
    expect(
      readProtocolV4LeaseRecoveryRecords(
        scenario.root,
        scenario.authorizationId,
        scenario.repoRoot,
      )[0].durableAccountingClassification,
    ).toBe('POSSIBLE_NONZERO');
  });

  it('classifies a legacy uninstrumented executing lease as POSSIBLE_NONZERO, never exact zero', () => {
    const scenario = executingScenario('recovery:legacy');
    const result = recoverProtocolV4AbandonedExecutionLeaseGoverned(validInput(scenario));
    expect(result.durableAccounting.classification).toBe('POSSIBLE_NONZERO');
    expect(result.durableAccounting.journalPresent).toBe(false);
    expect(result.durableAccounting.providerHttpRequestsUpperBound).toBeNull();
    expect(result.recordedLiveness).toBeNull();
  });
});
