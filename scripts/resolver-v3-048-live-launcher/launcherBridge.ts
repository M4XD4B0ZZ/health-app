/**
 * RESOLVER-V3-048 Phase B3 ("Canonical Live Development Launcher") -- the single, controlled
 * compile-time boundary between the plain-Node `.mjs` CLI launcher
 * (`scripts/run-resolver-v3-048-live-development.mjs`) and the real Protocol-v4 TypeScript graph.
 *
 * This file exists so the launcher's local `tsc` build has one explicit, minimal entry point to
 * compile (via `scripts/resolver-v3-048-live-launcher.tsconfig.json`) rather than the launcher
 * reaching into `src/` file paths itself. It re-exports only what the launcher calls -- never a
 * wildcard `export *` -- so the compiled surface stays exactly as small as the launcher's own
 * contract requires. Nothing in this file constructs a transport, reads `.env`, or touches a
 * credential; it is pure re-export wiring.
 */
export {
  buildProtocolV4MasterPlan,
  validateProtocolV4MasterPlan,
  PROTOCOL_V4_LIVE_ROOT,
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
  type ProtocolV4MasterPlan,
  type ProtocolV4DevelopmentEvidence,
} from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4';

export { PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS } from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4EvaluatorHash';

export {
  buildProtocolV4DevelopmentAuthorization,
  type ProtocolV4DevelopmentAuthorizationRecord,
} from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentAuthorization';

export {
  runProtocolV4LiveDevelopmentEntryPoint,
  ProtocolV4LiveDevelopmentEntryPointError,
} from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4LiveDevelopmentEntryPoint';

export {
  readProtocolV4ExecutionLease,
  ProtocolV4ExecutionLeaseError,
} from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionLease';

export {
  isProtocolV4LiveAuthorizationConsumedAtomically,
  ProtocolV4ArtifactStoreError,
  ProtocolV4ArtifactCrashError,
} from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ArtifactStore';

export { ProtocolV4LiveExecutionContextError } from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionContext';

export { ProtocolV4DevelopmentAuthorizationError } from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentAuthorization';

/**
 * RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5 ("Trusted Failure Metadata"): the launcher is
 * given ONLY the read-only getters for the trusted `WeakMap` side channel that replaces the previous
 * spoofable `error.protocolV4FailureUsageSnapshot`/`error.protocolV4LeaseFinalizationStatus`
 * properties -- never the setters (`setProtocolV4FailureUsageSnapshot`/
 * `setProtocolV4LeaseFinalizationStatus`), which stay exclusively usable by
 * `ResolverV3048ProtocolV4DevelopmentRunner.ts`, the sole trusted producer. Because this file and
 * the Runner both import from the same source module, and the launcher's local `tsc` build compiles
 * the whole reachable graph into one `outDir` tree in a single invocation, both compiled modules
 * `require()` the identical on-disk output file -- Node's own CommonJS module cache then guarantees
 * they share the same module instance, and therefore the same two `WeakMap`s underneath these
 * getters.
 */
export {
  readProtocolV4FailureUsageSnapshot,
  readProtocolV4LeaseFinalizationStatus,
  type ProtocolV4FailureUsageSnapshot,
  type ProtocolV4LeaseFinalizationStatus,
} from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4FailureMetadataSideChannel';
