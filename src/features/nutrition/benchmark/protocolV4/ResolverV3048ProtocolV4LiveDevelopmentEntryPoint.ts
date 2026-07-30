import * as path from 'node:path';
import {
  buildProtocolV4MasterPlan,
  validateProtocolV4MasterPlan,
  ARTIFACT_PATHS,
  PROTOCOL_V4_LIVE_ROOT,
  type ProtocolV4DevelopmentEvidence,
  type ProtocolV4MasterPlan,
} from './ResolverV3048ProtocolV4';
import type { ProtocolV4DevelopmentAuthorizationRecord } from './ResolverV3048ProtocolV4DevelopmentAuthorization';
import { buildProtocolV4HumanLiveExecutionContext } from './ResolverV3048ProtocolV4ExecutionContext';
import {
  isProtocolV4LiveArtifactTargetUnused,
  isProtocolV4LiveAuthorizationConsumedAtomically,
} from './ResolverV3048ProtocolV4ArtifactStore';
import { claimProtocolV4ExecutionLeaseForDevelopmentAuthorization } from './ResolverV3048ProtocolV4ExecutionLease';
import { runProtocolV4DevelopmentForAllCandidates } from './ResolverV3048ProtocolV4DevelopmentRunner';

/**
 * RESOLVER-V3-048 Phase B1 ("Protocol-v4 Live Development Wiring") -- the dedicated live Development
 * entry point, structurally separate from the zero-network Mini-Run (`ResolverV3048ProtocolV4DryRun.ts`).
 *
 * This function is never invoked with a real `env.ANTHROPIC_API_KEY` anywhere in this task, in source
 * or in tests -- only the fail-closed credential path (missing key) and the authorization/plan-
 * identity/storage-preflight guards are exercised here. Order matters and is deliberate:
 *
 * 1. Re-derive and validate the Master Plan fresh (never trust a caller-supplied plan object).
 * 2. Require a real `kind: 'human_live'` Development Authorization with a `humanApprovalReference`,
 *    matching this freshly-derived plan's own hashes exactly -- a `fake_dry_run` authorization
 *    structurally cannot reach this point.
 * 3. Build the live execution context -- the fail-closed `ANTHROPIC_API_KEY` check happens here,
 *    BEFORE anything below with a filesystem or budget side effect.
 * 4. Storage/authorization preflight for every candidate's Development checkpoint target under the
 *    live-bound Artifact Store, explicitly BEFORE claiming a lease -- so a predictable storage error
 *    (an already-used target, an already-consumed authorization) aborts before a lease exists, never
 *    leaving one orphaned in a claimed-but-undispatchable state.
 * 5. Claim a real Execution Lease. The canonical live artifact root (`PROTOCOL_V4_LIVE_ROOT`) is
 *    derived here, never accepted as a parameter -- a caller cannot redirect this entry point to the
 *    dry-run root, and `repoRoot` (test-only) only changes where that canonical root is resolved
 *    FROM, never which relative root is used.
 * 6. Dispatch Development only, for all three candidates, via
 *    `runProtocolV4DevelopmentForAllCandidates` -- which itself re-asserts
 *    `authorization.kind === executionContext.mode` and re-validates authorization/lease for real,
 *    immediately before each candidate's dispatch. This function never references any Holdout
 *    function at all -- Development is the only thing it can execute, and it stops when the returned
 *    promise resolves. No automatic continuation into Holdout exists anywhere in this file.
 */

export class ProtocolV4LiveDevelopmentEntryPointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4LiveDevelopmentEntryPointError';
  }
}

const DEVELOPMENT_CHECKPOINT_RELATIVE_PATHS: readonly string[] = [
  ARTIFACT_PATHS.developmentCheckpointH0,
  ARTIFACT_PATHS.developmentCheckpointH1,
  ARTIFACT_PATHS.developmentCheckpointH2,
];

export async function runProtocolV4LiveDevelopmentEntryPoint(input: {
  authorization: ProtocolV4DevelopmentAuthorizationRecord;
  /** Defaults to `process.env` in production. Tests pass a plain object (e.g. `{}` to prove the
   * fail-closed path, or `{ ANTHROPIC_API_KEY: 'test-key-not-real' }` combined with a `global.fetch`
   * mock to prove the real gate branch) -- never a real credential in this task. */
  env?: Partial<Record<string, string | undefined>>;
  /** Test-only override for where the canonical `PROTOCOL_V4_LIVE_ROOT` resolves from (defaults to
   * `process.cwd()`). Never changes WHICH relative root is used -- only WHERE it is anchored, so a
   * test can point this entire entry point at a temporary directory while still exercising the real,
   * unmodified `PROTOCOL_V4_LIVE_ROOT` constant underneath it. Production callers never set this;
   * nothing in this task's own tests writes under the real repository path
   * `logs/resolver-v3-048-protocol-v4`. */
  repoRoot?: string;
}): Promise<ProtocolV4DevelopmentEvidence> {
  // 1. Re-derive and validate the Master Plan fresh.
  const plan: ProtocolV4MasterPlan = buildProtocolV4MasterPlan(input.repoRoot);
  validateProtocolV4MasterPlan(plan, input.repoRoot);

  // 2. Require a real, complete human_live Development Authorization matching this plan exactly.
  const { authorization } = input;
  if (authorization.kind !== 'human_live')
    throw new ProtocolV4LiveDevelopmentEntryPointError(
      'PROTOCOL_V4_LIVE_DEVELOPMENT_REQUIRES_HUMAN_LIVE_AUTHORIZATION',
    );
  if (!authorization.humanApprovalReference)
    throw new ProtocolV4LiveDevelopmentEntryPointError(
      'PROTOCOL_V4_LIVE_DEVELOPMENT_HUMAN_APPROVAL_REFERENCE_REQUIRED',
    );
  if (
    authorization.masterPlanHash !== plan.planHash ||
    authorization.developmentExecutionTreeHash !== plan.developmentExecutionTreeHash
  )
    throw new ProtocolV4LiveDevelopmentEntryPointError(
      'PROTOCOL_V4_LIVE_DEVELOPMENT_AUTHORIZATION_PLAN_MISMATCH',
    );

  // 3. Build the live execution context -- the fail-closed credential check. Nothing below this line
  // has any side effect until this succeeds.
  const executionContext = buildProtocolV4HumanLiveExecutionContext(input.env);

  // The canonical live artifact root, resolved (never parameterized) -- `repoRoot` only changes where
  // it is anchored, `PROTOCOL_V4_LIVE_ROOT` itself is the real, unmodified constant every time.
  const artifactStoreRoot = path.resolve(input.repoRoot ?? process.cwd(), PROTOCOL_V4_LIVE_ROOT);

  // 4. Storage/authorization preflight for every candidate, strictly before claiming a lease.
  if (
    isProtocolV4LiveAuthorizationConsumedAtomically(
      artifactStoreRoot,
      authorization.authorizationId,
      input.repoRoot,
    )
  )
    throw new ProtocolV4LiveDevelopmentEntryPointError(
      'PROTOCOL_V4_LIVE_DEVELOPMENT_AUTHORIZATION_ALREADY_CONSUMED',
    );
  for (const relativePath of DEVELOPMENT_CHECKPOINT_RELATIVE_PATHS) {
    if (!isProtocolV4LiveArtifactTargetUnused(artifactStoreRoot, relativePath, input.repoRoot))
      throw new ProtocolV4LiveDevelopmentEntryPointError(
        `PROTOCOL_V4_LIVE_DEVELOPMENT_ARTIFACT_TARGET_REUSED:${relativePath}`,
      );
  }

  // 5. Only after every preflight check above has passed: claim a real Execution Lease.
  const lease = claimProtocolV4ExecutionLeaseForDevelopmentAuthorization(
    plan,
    authorization,
    artifactStoreRoot,
    input.repoRoot,
  );

  // 6. Development only. Never Holdout -- no Holdout function is referenced anywhere in this file.
  return runProtocolV4DevelopmentForAllCandidates({
    plan,
    authorization,
    lease,
    artifactStoreRoot,
    executionContext,
    repoRoot: input.repoRoot,
  });
}
