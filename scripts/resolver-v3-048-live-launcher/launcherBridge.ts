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

export { readProtocolV4ExecutionLease } from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionLease';

export { isProtocolV4LiveAuthorizationConsumedAtomically } from '../../src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ArtifactStore';
