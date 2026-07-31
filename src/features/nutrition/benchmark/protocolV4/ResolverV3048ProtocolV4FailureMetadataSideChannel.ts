import type { ResolverV3047CandidateId } from '../ResolverV3047Candidates';

/**
 * RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5 ("Trusted Failure Metadata, Non-Fabricated
 * Usage").
 *
 * Defect this file closes: `attachProtocolV4FailureUsageSnapshot`/
 * `attachProtocolV4LeaseFinalizationStatus` (in `ResolverV3048ProtocolV4DevelopmentRunner.ts`)
 * previously wrote `protocolV4FailureUsageSnapshot`/`protocolV4LeaseFinalizationStatus` as plain,
 * freely-settable properties directly on the thrown error object, and the launcher's
 * `summarizeFailureUsage` (`scripts/run-resolver-v3-048-live-development.mjs`) read them back the
 * same way. A foreign error can pre-populate either property with an arbitrary value; if the real
 * attachment attempt then failed (a frozen/non-extensible error, a non-writable existing property, a
 * throwing setter/Proxy trap), the foreign value survived untouched and the launcher trusted it as
 * authoritative -- after real provider dispatches had already happened, this could report a
 * fabricated `accounting: 'exact'` / all-zero usage instead of the real, non-zero usage.
 *
 * Fix: a process-local, module-private `WeakMap` side channel keyed by the error object's own
 * IDENTITY (its object reference), never by a property read or write on the error itself. Setting or
 * reading an entry never touches any property of the error object -- no getter, setter, or Proxy trap
 * on the error is ever invoked, so a frozen, sealed, non-extensible, or Proxy-wrapped error works as a
 * `WeakMap` key exactly like any other object, and a foreign error can no longer pre-seed or spoof an
 * entry by defining a property with a particular name (there is no such property to define -- the two
 * `WeakMap`s below are never exported, so nothing outside this file can read OR write an entry for any
 * error, foreign or real). The error object itself is never mutated and never replaces the original
 * thrown value or its identity.
 *
 * Only the read-only getters below are re-exported to the launcher (via
 * `scripts/resolver-v3-048-live-launcher/launcherBridge.ts`) -- the launcher can read a trusted
 * snapshot/status but can never set one itself. The setters are used exclusively by
 * `ResolverV3048ProtocolV4DevelopmentRunner.ts`, the sole trusted producer of both.
 */

export type ProtocolV4FailureUsageAccounting = 'exact_zero' | 'partial';

export interface ProtocolV4FailureUsageSnapshot {
  /** `'exact_zero'` when the transport-authoritative counter recorded zero real `fetch` attempts
   * (provably zero real HTTP activity, even if a reservation was made and then abandoned before
   * `fetch`); `'partial'` whenever at least one real `fetch` was attempted -- the exact final actual
   * usage cannot be claimed for a candidate that never finished durably writing its own evidence, so
   * this is never reported as fully `'exact'` once any HTTP request has been made. */
  accounting: ProtocolV4FailureUsageAccounting;
  completedCandidateIds: readonly ResolverV3047CandidateId[];
  /** Transport-authoritative, exact -- see the type doc comment above. */
  providerHttpRequests: number;
  /** Budget-gate reservation count -- a distinct dimension, never a provider/HTTP-request count. */
  aiDispatchReservations: number;
  reservedInputTokensUpperBound: number;
  reservedOutputTokensUpperBound: number;
  reservedCostUsdUpperBound: number;
  confirmedInputTokens: number;
  confirmedOutputTokens: number;
  confirmedCostUsd: number;
}

/** Secret-free, stable status for whether the lease's own `terminal_failure` write itself
 * succeeded -- deliberately a SEPARATE concern from the usage snapshot above (which describes what
 * happened to the Development dispatch, not to the lease's own persistence). */
export type ProtocolV4LeaseFinalizationStatus = 'terminal_failure_confirmed' | 'failed_to_persist';

/** Module-private -- never exported. The only way to read or write an entry is through the trusted
 * accessor functions below, each of which keys strictly on the error object's own reference. */
const failureUsageSnapshots = new WeakMap<object, ProtocolV4FailureUsageSnapshot>();
const leaseFinalizationStatuses = new WeakMap<object, ProtocolV4LeaseFinalizationStatus>();

/** Trusted producer only (`ResolverV3048ProtocolV4DevelopmentRunner.ts`). No-op for a non-object
 * `error` (defends against a non-Error throw, which never happens on this code path but must not
 * itself crash the failure handler). `WeakMap.set` on an object key never reads or writes any
 * property of that key and never invokes a getter/setter/Proxy trap -- this call cannot throw for a
 * frozen, sealed, non-extensible, or Proxy-wrapped `error`, so (unlike the removed property-based
 * attachment this replaces) no `try`/`catch` is needed here for that reason. */
export function setProtocolV4FailureUsageSnapshot(
  error: unknown,
  snapshot: ProtocolV4FailureUsageSnapshot,
): void {
  if (!error || typeof error !== 'object') return;
  failureUsageSnapshots.set(error, snapshot);
}

/** Trusted read-only accessor. Re-exported (read-only) to the launcher via `launcherBridge.ts`.
 * Never reads a property of `error` -- keys strictly on its object identity -- so a foreign error
 * that defines a same-named property can never be mistaken for a real entry: there is no property
 * being read at all. */
export function readProtocolV4FailureUsageSnapshot(
  error: unknown,
): ProtocolV4FailureUsageSnapshot | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return failureUsageSnapshots.get(error);
}

/** Trusted producer only (`ResolverV3048ProtocolV4DevelopmentRunner.ts`). Same no-property-access,
 * no-`try`/`catch`-needed rationale as `setProtocolV4FailureUsageSnapshot` above. */
export function setProtocolV4LeaseFinalizationStatus(
  error: unknown,
  status: ProtocolV4LeaseFinalizationStatus,
): void {
  if (!error || typeof error !== 'object') return;
  leaseFinalizationStatuses.set(error, status);
}

/** Trusted read-only accessor. Re-exported (read-only) to the launcher via `launcherBridge.ts`. */
export function readProtocolV4LeaseFinalizationStatus(
  error: unknown,
): ProtocolV4LeaseFinalizationStatus | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return leaseFinalizationStatuses.get(error);
}
