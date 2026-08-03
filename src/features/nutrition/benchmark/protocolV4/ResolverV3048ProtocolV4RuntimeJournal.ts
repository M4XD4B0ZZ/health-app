import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { hashProtocolV4 } from './ResolverV3048ProtocolV4';
import { assertProtocolV4LiveRootMatchesStore } from './ResolverV3048ProtocolV4ArtifactStore';
import {
  readProtocolV4ExecutionLease,
  type ProtocolV4ExecutionLease,
  type ProtocolV4ExecutionLeasePhase,
  type ProtocolV4ExecutionLeaseRunKind,
  type ProtocolV4ExecutionLeaseStatus,
} from './ResolverV3048ProtocolV4ExecutionLease';
import { deriveProtocolV4AuthorizationStorageKey } from './ResolverV3048ProtocolV4StorageKey';

/**
 * RESOLVER-V3-048-INCIDENT-002 Remediation A + B + D -- the append-only, crash-durable runtime
 * journal for `human_live` Protocol-v4 Development execution, and the canonical reducer that derives
 * ONLY defensible accounting states from it after an abrupt process termination.
 *
 * Defect this module closes: provider-request accounting existed exclusively in process memory (the
 * execution context's `cumulativeProviderHttpRequestCount` closure and the `WeakMap` failure-metadata
 * side channel), and candidate telemetry/ledger/results were persisted only AFTER a candidate's full
 * observation loop finished. A process killed mid-run therefore left an `executing` lease, zero
 * artifacts, and no durable evidence whatsoever about whether provider requests had happened -- and
 * anything reading that state could only either guess or fabricate an exact zero. RESOLVER-V3-048's
 * own real incident (an interrupted Development attempt: v1 `claimed`, v2 `executing`, no terminal
 * version, no candidate artifacts) is exactly that shape.
 *
 * Contract, in the order the dispatch path must follow it:
 *
 * 1. Reserve through the canonical budget gate (unchanged, already done by the caller).
 * 2. Durably persist AND read back a `dispatch_intent` event -- `append*` below only returns after
 *    the event has been exclusively created, re-read from disk, and re-hashed. If this throws, the
 *    caller must not dispatch: no provider HTTP attempt may follow a failed intent persist.
 * 3. Only then enter the transport-authoritative HTTP-attempt boundary and call the provider.
 *
 * A `dispatch_intent` deliberately does NOT prove a billed request. It proves a request MAY have
 * occurred -- it is written strictly before `fetch` is entered, so `intents >= requests actually
 * issued`. Conversely a `dispatch_completed` proves a real HTTP response was observed, so completions
 * are a genuine LOWER bound. `reduceProtocolV4RuntimeJournal` keeps those two dimensions separate and
 * never collapses them into a single fabricated number.
 *
 * Every event is: exclusively created (`wx` temp + `linkSync`, never an overwrite), sequence-addressed
 * (`e<N>.json`, the filename IS the sequence), immediately read back and hash-validated, bound to the
 * authorization ID / lease ID+version+status+hash / plan hash / execution-tree hash / candidate ID /
 * call ID / dispatch ID / model ID / pricing version where applicable, written only under the
 * canonical live root, and immutable after creation.
 *
 * Remediation D: every event additionally carries durable liveness/run identity (process ID, host
 * identity, process start time, event time). The dispatch-boundary events themselves are the
 * heartbeat -- no background timer exists, because a `dispatch_intent`/`dispatch_completed` pair
 * around every provider attempt already gives a strictly stronger, deterministic contract than a
 * periodic tick, and recovery never infers from this data that a process is dead (see
 * `ResolverV3048ProtocolV4LeaseRecovery.ts`, which requires explicit human confirmation instead).
 */

export class ProtocolV4RuntimeJournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4RuntimeJournalError';
  }
}

/** Thrown when a leftover `e<N>.json.tmp-*` sibling with no matching final `e<N>.json` is found --
 * an explicit crash-mid-append state, never silently treated as "the journal simply ends here".
 * Mirrors `ProtocolV4ExecutionLeaseCrashError`'s own contract. */
export class ProtocolV4RuntimeJournalCrashError extends ProtocolV4RuntimeJournalError {}

export const PROTOCOL_V4_RUNTIME_JOURNAL_SCHEMA_VERSION = 'resolver-v3-048-runtime-journal-v1';

export type ProtocolV4RuntimeJournalEventKind =
  | 'executing_started'
  | 'dispatch_intent'
  | 'dispatch_completed'
  | 'dispatch_failed'
  | 'terminalization_started'
  | 'recovery_recorded';

/** RESOLVER-V3-048-INCIDENT-002 Remediation D: durable process/run identity, captured per event.
 * Never includes a credential, URL, header, or proxy value. */
export interface ProtocolV4RuntimeJournalLiveness {
  pid: number;
  hostId: string;
  processStartedAtIso: string;
  recordedAtIso: string;
}

/** Provider usage for a completed dispatch, using ONLY the fields the existing usage contract
 * (`ProtocolV4TerminalMetadata`) already accepts -- never a second usage/pricing parser. */
export interface ProtocolV4RuntimeJournalUsage {
  usageStatus: 'reported' | 'unknown';
  inputTokens: number | null;
  outputTokens: number | null;
  actualCostUsd: number | null;
  httpStatus: number | null;
}

export interface ProtocolV4RuntimeJournalEvent {
  journalSchemaVersion: typeof PROTOCOL_V4_RUNTIME_JOURNAL_SCHEMA_VERSION;
  /** 1-based, monotonic, and identical to this event's own `e<N>.json` filename -- re-validated on
   * every read, so a renamed/reordered file is a hard failure, not a silent reordering. */
  sequence: number;
  kind: ProtocolV4RuntimeJournalEventKind;
  authorizationId: string;
  leaseId: string;
  /** The CURRENT persisted lease version/status/hash at the moment this event was appended -- always
   * re-read from storage, never a caller-held in-memory lease object. */
  leaseVersion: number;
  leaseStatus: ProtocolV4ExecutionLeaseStatus;
  leaseHash: string;
  planHash: string;
  executionTreeHash: string;
  phase: ProtocolV4ExecutionLeasePhase;
  runKind: ProtocolV4ExecutionLeaseRunKind;
  candidateId: string | null;
  callId: string | null;
  /** Stable identity pairing a `dispatch_intent` with its own `dispatch_completed`/`dispatch_failed`
   * (`<callId>#<attempt>`) -- the reducer's only join key, never positional order. */
  dispatchId: string | null;
  modelId: string | null;
  pricingVersion: string | null;
  reservedInputTokensUpperBound: number | null;
  reservedOutputTokensUpperBound: number | null;
  reservedCostUsdUpperBound: number | null;
  usage: ProtocolV4RuntimeJournalUsage | null;
  failureKind: string | null;
  /** Free-form ONLY within an enumerated recovery vocabulary supplied by the recovery command; never
   * a raw error message, path, or credential. */
  detail: string | null;
  liveness: ProtocolV4RuntimeJournalLiveness;
  eventHash: string;
}

export interface ProtocolV4RuntimeJournalDispatchScope {
  candidateId: string;
  callId: string;
  dispatchId: string;
  modelId: string;
  pricingVersion: string;
}

export interface ProtocolV4RuntimeJournalIntentInput extends ProtocolV4RuntimeJournalDispatchScope {
  reservedInputTokensUpperBound: number;
  reservedOutputTokensUpperBound: number;
  reservedCostUsdUpperBound: number;
}

export interface ProtocolV4RuntimeJournalCompletedInput extends ProtocolV4RuntimeJournalDispatchScope {
  usage: ProtocolV4RuntimeJournalUsage;
}

export interface ProtocolV4RuntimeJournalFailedInput extends ProtocolV4RuntimeJournalDispatchScope {
  failureKind: string;
}

export interface ProtocolV4RuntimeJournalWriter {
  readonly authorizationId: string;
  readonly artifactStoreRoot: string;
  appendExecutingStarted(): ProtocolV4RuntimeJournalEvent;
  appendDispatchIntent(input: ProtocolV4RuntimeJournalIntentInput): ProtocolV4RuntimeJournalEvent;
  appendDispatchCompleted(
    input: ProtocolV4RuntimeJournalCompletedInput,
  ): ProtocolV4RuntimeJournalEvent;
  appendDispatchFailed(input: ProtocolV4RuntimeJournalFailedInput): ProtocolV4RuntimeJournalEvent;
  appendTerminalizationStarted(): ProtocolV4RuntimeJournalEvent;
  appendRecoveryRecorded(detail: string): ProtocolV4RuntimeJournalEvent;
}

// ---------------------------------------------------------------------------------------------
// Storage layout -- always under the canonical live root, keyed by the platform-neutral storage key
// (the same one the lease store and the authorization-consumption marker already use).
// ---------------------------------------------------------------------------------------------

function assertSafeAuthorizationId(authorizationId: string): void {
  if (!authorizationId || /[\\/]|\.\./.test(authorizationId))
    throw new ProtocolV4RuntimeJournalError(
      `PROTOCOL_V4_RUNTIME_JOURNAL_UNSAFE_AUTHORIZATION_ID:${authorizationId}`,
    );
}

export function protocolV4RuntimeJournalDirectory(root: string, authorizationId: string): string {
  assertSafeAuthorizationId(authorizationId);
  return path.join(
    path.resolve(root),
    'runtime-journal',
    deriveProtocolV4AuthorizationStorageKey(authorizationId),
  );
}

function eventPath(root: string, authorizationId: string, sequence: number): string {
  return path.join(protocolV4RuntimeJournalDirectory(root, authorizationId), `e${sequence}.json`);
}

function listSequences(root: string, authorizationId: string): number[] {
  const dir = protocolV4RuntimeJournalDirectory(root, authorizationId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((entry) => /^e(\d+)\.json$/.exec(entry))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function listTmpSequences(root: string, authorizationId: string): number[] {
  const dir = protocolV4RuntimeJournalDirectory(root, authorizationId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((entry) => /^e(\d+)\.json\.tmp-/.exec(entry))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
}

/** A leftover `e<N>.json.tmp-*` with no final `e<N>.json`: the process died between opening the temp
 * file and committing it. Reported explicitly rather than silently truncating the journal. */
export function detectProtocolV4RuntimeJournalCrash(
  root: string,
  authorizationId: string,
): boolean {
  const finals = new Set(listSequences(root, authorizationId));
  return listTmpSequences(root, authorizationId).some((s) => !finals.has(s));
}

function hashEventBody(body: Omit<ProtocolV4RuntimeJournalEvent, 'eventHash'>): string {
  return hashProtocolV4(body);
}

function currentLiveness(): ProtocolV4RuntimeJournalLiveness {
  const nowMs = Date.now();
  return {
    pid: process.pid,
    hostId: os.hostname(),
    processStartedAtIso: new Date(nowMs - Math.round(process.uptime() * 1000)).toISOString(),
    recordedAtIso: new Date(nowMs).toISOString(),
  };
}

// ---------------------------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------------------------

/** Opens an append-only journal bound to ONE canonical live root, ONE authorization ID, and the
 * lease currently persisted for it. Fails closed if no lease exists, if the lease's own
 * plan/execution-tree/authorization identity disagrees with what the caller is executing, or if the
 * root is not the canonical live root. The lease is re-read from storage on EVERY append (never
 * cached), so each event carries the genuinely current lease version/status/hash. */
export function openProtocolV4RuntimeJournal(input: {
  artifactStoreRoot: string;
  authorizationId: string;
  planHash: string;
  executionTreeHash: string;
  repoRoot?: string;
}): ProtocolV4RuntimeJournalWriter {
  const artifactStoreRoot = assertProtocolV4LiveRootMatchesStore(
    input.artifactStoreRoot,
    input.repoRoot,
  );
  assertSafeAuthorizationId(input.authorizationId);

  function readBoundLease(): ProtocolV4ExecutionLease {
    const lease = readProtocolV4ExecutionLease(artifactStoreRoot, input.authorizationId);
    if (!lease)
      throw new ProtocolV4RuntimeJournalError(
        `PROTOCOL_V4_RUNTIME_JOURNAL_LEASE_NOT_FOUND:${input.authorizationId}`,
      );
    if (lease.authorizationId !== input.authorizationId)
      throw new ProtocolV4RuntimeJournalError(
        'PROTOCOL_V4_RUNTIME_JOURNAL_AUTHORIZATION_ID_MISMATCH',
      );
    if (lease.planHash !== input.planHash)
      throw new ProtocolV4RuntimeJournalError('PROTOCOL_V4_RUNTIME_JOURNAL_PLAN_HASH_MISMATCH');
    if (lease.executionTreeHash !== input.executionTreeHash)
      throw new ProtocolV4RuntimeJournalError(
        'PROTOCOL_V4_RUNTIME_JOURNAL_EXECUTION_TREE_MISMATCH',
      );
    return lease;
  }

  // Validate the binding once at open time so a misconfigured journal fails before any dispatch,
  // never for the first time in the middle of the pre-dispatch intent write.
  readBoundLease();

  function append(
    partial: Pick<ProtocolV4RuntimeJournalEvent, 'kind'> &
      Partial<
        Pick<
          ProtocolV4RuntimeJournalEvent,
          | 'candidateId'
          | 'callId'
          | 'dispatchId'
          | 'modelId'
          | 'pricingVersion'
          | 'reservedInputTokensUpperBound'
          | 'reservedOutputTokensUpperBound'
          | 'reservedCostUsdUpperBound'
          | 'usage'
          | 'failureKind'
          | 'detail'
        >
      >,
  ): ProtocolV4RuntimeJournalEvent {
    if (detectProtocolV4RuntimeJournalCrash(artifactStoreRoot, input.authorizationId))
      throw new ProtocolV4RuntimeJournalCrashError(
        `PROTOCOL_V4_RUNTIME_JOURNAL_CRASH_EVIDENCE_DETECTED:${input.authorizationId}`,
      );
    const lease = readBoundLease();
    const sequences = listSequences(artifactStoreRoot, input.authorizationId);
    const sequence = (sequences.length === 0 ? 0 : sequences[sequences.length - 1]) + 1;
    const body: Omit<ProtocolV4RuntimeJournalEvent, 'eventHash'> = {
      journalSchemaVersion: PROTOCOL_V4_RUNTIME_JOURNAL_SCHEMA_VERSION,
      sequence,
      kind: partial.kind,
      authorizationId: input.authorizationId,
      leaseId: lease.leaseId,
      leaseVersion: lease.version,
      leaseStatus: lease.status,
      leaseHash: lease.leaseHash,
      planHash: lease.planHash,
      executionTreeHash: lease.executionTreeHash,
      phase: lease.phase,
      runKind: lease.runKind,
      candidateId: partial.candidateId ?? null,
      callId: partial.callId ?? null,
      dispatchId: partial.dispatchId ?? null,
      modelId: partial.modelId ?? null,
      pricingVersion: partial.pricingVersion ?? null,
      reservedInputTokensUpperBound: partial.reservedInputTokensUpperBound ?? null,
      reservedOutputTokensUpperBound: partial.reservedOutputTokensUpperBound ?? null,
      reservedCostUsdUpperBound: partial.reservedCostUsdUpperBound ?? null,
      usage: partial.usage ?? null,
      failureKind: partial.failureKind ?? null,
      detail: partial.detail ?? null,
      liveness: currentLiveness(),
    };
    const event: ProtocolV4RuntimeJournalEvent = { ...body, eventHash: hashEventBody(body) };
    writeEventExclusive(artifactStoreRoot, input.authorizationId, sequence, event);
    // Immediate, independent readback + hash re-validation -- `append` only returns once the event
    // is provably durable and provably intact on disk.
    const readBack = readEventFile(artifactStoreRoot, input.authorizationId, sequence);
    if (readBack.eventHash !== event.eventHash)
      throw new ProtocolV4RuntimeJournalError(
        `PROTOCOL_V4_RUNTIME_JOURNAL_READBACK_HASH_MISMATCH:${input.authorizationId}:e${sequence}`,
      );
    return readBack;
  }

  return {
    authorizationId: input.authorizationId,
    artifactStoreRoot,
    appendExecutingStarted: () => append({ kind: 'executing_started' }),
    appendDispatchIntent: (i) =>
      append({
        kind: 'dispatch_intent',
        candidateId: i.candidateId,
        callId: i.callId,
        dispatchId: i.dispatchId,
        modelId: i.modelId,
        pricingVersion: i.pricingVersion,
        reservedInputTokensUpperBound: i.reservedInputTokensUpperBound,
        reservedOutputTokensUpperBound: i.reservedOutputTokensUpperBound,
        reservedCostUsdUpperBound: i.reservedCostUsdUpperBound,
      }),
    appendDispatchCompleted: (i) =>
      append({
        kind: 'dispatch_completed',
        candidateId: i.candidateId,
        callId: i.callId,
        dispatchId: i.dispatchId,
        modelId: i.modelId,
        pricingVersion: i.pricingVersion,
        usage: i.usage,
      }),
    appendDispatchFailed: (i) =>
      append({
        kind: 'dispatch_failed',
        candidateId: i.candidateId,
        callId: i.callId,
        dispatchId: i.dispatchId,
        modelId: i.modelId,
        pricingVersion: i.pricingVersion,
        failureKind: i.failureKind,
      }),
    appendTerminalizationStarted: () => append({ kind: 'terminalization_started' }),
    appendRecoveryRecorded: (detail) => append({ kind: 'recovery_recorded', detail }),
  };
}

function writeEventExclusive(
  root: string,
  authorizationId: string,
  sequence: number,
  event: ProtocolV4RuntimeJournalEvent,
): void {
  const finalPath = eventPath(root, authorizationId, sequence);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const tempPath = `${finalPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const fd = fs.openSync(tempPath, 'wx');
  try {
    fs.writeSync(fd, JSON.stringify(event));
    // Force the bytes to the device before the commit link -- an abruptly terminated process must
    // never leave a committed-but-empty event behind.
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.linkSync(tempPath, finalPath);
  } catch (e) {
    fs.unlinkSync(tempPath);
    if ((e as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ProtocolV4RuntimeJournalError(
        `PROTOCOL_V4_RUNTIME_JOURNAL_SEQUENCE_RACE:${authorizationId}:e${sequence}`,
      );
    throw e;
  }
  fs.unlinkSync(tempPath);
}

function readEventFile(
  root: string,
  authorizationId: string,
  sequence: number,
): ProtocolV4RuntimeJournalEvent {
  const raw = fs.readFileSync(eventPath(root, authorizationId, sequence), 'utf-8');
  const parsed = JSON.parse(raw) as ProtocolV4RuntimeJournalEvent;
  const { eventHash, ...body } = parsed;
  if (hashEventBody(body) !== eventHash)
    throw new ProtocolV4RuntimeJournalError(
      `PROTOCOL_V4_RUNTIME_JOURNAL_READBACK_HASH_MISMATCH:${authorizationId}:e${sequence}`,
    );
  if (parsed.sequence !== sequence)
    throw new ProtocolV4RuntimeJournalError(
      `PROTOCOL_V4_RUNTIME_JOURNAL_SEQUENCE_FILENAME_MISMATCH:${authorizationId}:e${sequence}`,
    );
  if (parsed.authorizationId !== authorizationId)
    throw new ProtocolV4RuntimeJournalError(
      `PROTOCOL_V4_RUNTIME_JOURNAL_AUTHORIZATION_ID_MISMATCH:${authorizationId}:e${sequence}`,
    );
  return parsed;
}

/** Reads the full journal in ascending sequence order, hash-validating every event and requiring the
 * sequence to be gapless. Returns `[]` when no journal exists at all (which is itself meaningful --
 * see `reduceProtocolV4RuntimeJournal`'s legacy/no-journal rule). */
export function readProtocolV4RuntimeJournal(
  root: string,
  authorizationId: string,
  repoRoot?: string,
): readonly ProtocolV4RuntimeJournalEvent[] {
  const resolvedRoot = assertProtocolV4LiveRootMatchesStore(root, repoRoot);
  if (detectProtocolV4RuntimeJournalCrash(resolvedRoot, authorizationId))
    throw new ProtocolV4RuntimeJournalCrashError(
      `PROTOCOL_V4_RUNTIME_JOURNAL_CRASH_EVIDENCE_DETECTED:${authorizationId}`,
    );
  const sequences = listSequences(resolvedRoot, authorizationId);
  return sequences.map((sequence, index) => {
    if (sequence !== index + 1)
      throw new ProtocolV4RuntimeJournalError(
        `PROTOCOL_V4_RUNTIME_JOURNAL_SEQUENCE_GAP:${authorizationId}:e${sequence}`,
      );
    return readEventFile(resolvedRoot, authorizationId, sequence);
  });
}

// ---------------------------------------------------------------------------------------------
// Remediation B -- the canonical reducer. Derives ONLY defensible states; never an invented exact
// token/cost value for an unresolved intent, and never an exact zero without durable proof.
// ---------------------------------------------------------------------------------------------

export type ProtocolV4DurableAccountingClassification =
  /** Journal proves execution started and contains no dispatch intent at all. */
  | 'EXACT_ZERO'
  /** Every intent resolved with a completion carrying accepted (`reported`) usage and a cost. */
  | 'EXACT'
  /** Every intent resolved, but at least one resolution carries no accepted usage/cost. */
  | 'PARTIAL'
  /** At least one intent never resolved, or no journal exists at all (legacy/uninstrumented run). */
  | 'POSSIBLE_NONZERO';

export interface ProtocolV4DurableAccounting {
  classification: ProtocolV4DurableAccountingClassification;
  /** False when no journal exists at all -- the legacy/uninstrumented shape. */
  journalPresent: boolean;
  executionStarted: boolean;
  terminalizationStarted: boolean;
  dispatchIntents: number;
  resolvedDispatchIntents: number;
  openDispatchIntents: number;
  /** Durable LOWER bound on real provider HTTP requests: each `dispatch_completed` proves a real
   * response was observed, therefore a real request definitely happened. */
  providerHttpRequestsLowerBound: number;
  /** Durable UPPER bound: an intent is written strictly BEFORE `fetch` is entered, so no request can
   * exist without one. `null` when no journal exists -- genuinely unknown, never fabricated. */
  providerHttpRequestsUpperBound: number | null;
  confirmedInputTokens: number;
  confirmedOutputTokens: number;
  confirmedCostUsd: number;
  /** Reserved worst-case ceilings summed from every intent. `null` when the accounting is EXACT or
   * EXACT_ZERO (an upper bound adds no information beyond confirmed figures) -- the same
   * null-when-exact convention `buildProtocolV4SuccessUsageSnapshot` already uses. */
  reservedInputTokensUpperBound: number | null;
  reservedOutputTokensUpperBound: number | null;
  reservedCostUsdUpperBound: number | null;
  /** Candidate IDs that appear on at least one durable dispatch event. */
  observedCandidateIds: readonly string[];
}

/** Pure reduction over an already-read, already-hash-validated event list. */
export function reduceProtocolV4RuntimeJournal(
  events: readonly ProtocolV4RuntimeJournalEvent[],
): ProtocolV4DurableAccounting {
  const journalPresent = events.length > 0;
  const executionStarted = events.some((e) => e.kind === 'executing_started');
  const terminalizationStarted = events.some((e) => e.kind === 'terminalization_started');

  const intents = events.filter((e) => e.kind === 'dispatch_intent');
  const completions = events.filter((e) => e.kind === 'dispatch_completed');
  const failures = events.filter((e) => e.kind === 'dispatch_failed');
  const resolvedIds = new Set(
    [...completions, ...failures]
      .map((e) => e.dispatchId)
      .filter((id): id is string => id !== null),
  );
  const openDispatchIntents = intents.filter(
    (e) => e.dispatchId === null || !resolvedIds.has(e.dispatchId),
  ).length;
  const resolvedDispatchIntents = intents.length - openDispatchIntents;

  let confirmedInputTokens = 0;
  let confirmedOutputTokens = 0;
  let confirmedCostUsd = 0;
  let everyCompletionHasAcceptedUsage = true;
  for (const completion of completions) {
    const usage = completion.usage;
    if (usage && usage.usageStatus === 'reported' && typeof usage.actualCostUsd === 'number') {
      confirmedInputTokens += usage.inputTokens ?? 0;
      confirmedOutputTokens += usage.outputTokens ?? 0;
      confirmedCostUsd += usage.actualCostUsd;
    } else {
      everyCompletionHasAcceptedUsage = false;
    }
  }

  const reservedInputTokens = intents.reduce(
    (sum, e) => sum + (e.reservedInputTokensUpperBound ?? 0),
    0,
  );
  const reservedOutputTokens = intents.reduce(
    (sum, e) => sum + (e.reservedOutputTokensUpperBound ?? 0),
    0,
  );
  const reservedCostUsd = intents.reduce((sum, e) => sum + (e.reservedCostUsdUpperBound ?? 0), 0);

  let classification: ProtocolV4DurableAccountingClassification;
  if (!journalPresent || !executionStarted) {
    // No durable proof that execution even started -- an exact zero would be a fabrication. This is
    // the legacy/uninstrumented `executing` lease shape (RESOLVER-V3-048-INCIDENT-002 itself).
    classification = 'POSSIBLE_NONZERO';
  } else if (openDispatchIntents > 0) {
    classification = 'POSSIBLE_NONZERO';
  } else if (intents.length === 0) {
    classification = 'EXACT_ZERO';
  } else if (failures.length === 0 && everyCompletionHasAcceptedUsage) {
    classification = 'EXACT';
  } else {
    classification = 'PARTIAL';
  }

  const boundsAreInformative = classification !== 'EXACT' && classification !== 'EXACT_ZERO';
  return {
    classification,
    journalPresent,
    executionStarted,
    terminalizationStarted,
    dispatchIntents: intents.length,
    resolvedDispatchIntents,
    openDispatchIntents,
    providerHttpRequestsLowerBound: completions.length,
    providerHttpRequestsUpperBound: journalPresent ? intents.length : null,
    confirmedInputTokens,
    confirmedOutputTokens,
    confirmedCostUsd,
    reservedInputTokensUpperBound: boundsAreInformative ? reservedInputTokens : null,
    reservedOutputTokensUpperBound: boundsAreInformative ? reservedOutputTokens : null,
    reservedCostUsdUpperBound: boundsAreInformative ? reservedCostUsd : null,
    observedCandidateIds: [
      ...new Set(
        events.map((e) => e.candidateId).filter((id): id is string => typeof id === 'string'),
      ),
    ].sort(),
  };
}

/** Storage-backed entry point: reads the durable journal for `authorizationId` under the canonical
 * live root and reduces it. This is the ONLY function that may be used to answer "what usage can be
 * proven for this authorization after a crash" -- the in-memory `WeakMap` failure metadata remains a
 * same-process fast path, but is no longer the only thing standing between an abrupt termination and
 * a fabricated exact zero. */
export function classifyProtocolV4DurableAccounting(input: {
  artifactStoreRoot: string;
  authorizationId: string;
  repoRoot?: string;
}): ProtocolV4DurableAccounting {
  return reduceProtocolV4RuntimeJournal(
    readProtocolV4RuntimeJournal(input.artifactStoreRoot, input.authorizationId, input.repoRoot),
  );
}
