import { createHash } from 'node:crypto';
import {
  RESOLVER_V3_047_CANDIDATES,
  type ResolverV3047CandidateId,
} from '../ResolverV3047Candidates';
import {
  REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
  REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
  REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS,
} from '../representativeHybridV1/RepresentativeHybridV1Manifest';
import {
  REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
  REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION,
} from '../representativeHybridV1/RepresentativeHybridV1SourceSnapshotManifest';
import type {
  RepresentativeHybridV1Partition,
  RepresentativeHybridV1ResolutionScenario,
} from '../representativeHybridV1/RepresentativeHybridV1Types';
import {
  assertProtocolV4PricingIdentityMatches,
  resolveProtocolV4Pricing,
  type ProtocolV4PricingIdentity,
} from './ResolverV3048ProtocolV4Pricing';
import {
  computeProtocolV4EvaluatorManifestHash,
  PROTOCOL_V4_EVALUATOR_HASH_ALGORITHM_VERSION,
  PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS,
} from './ResolverV3048ProtocolV4EvaluatorHash';

export type { ResolverV3047CandidateId };

/**
 * RESOLVER-V3-048 Phase A -- post-merge remediation of PR #190
 * (`dd81439a36ac4122cce5d3bdeeb2562ce84271ac`).
 *
 * This file replaces the PR #190 merge's plan/artifact/selection/authorization contract. The prior
 * version's specific, independently-reviewed defects (single self-declared pricing literal that
 * diverged from the real pricing table; a self-labelled, content-blind "evaluator hash"; a single-
 * stage plan that tripled all three candidates into the Holdout partition while deriving the Holdout
 * budget from a hard-coded `candidateId === 'H0'` filter; boolean-only Development
 * checkpoint/evaluation gates; an unproven, freely-constructible candidate-selection record; a
 * Holdout-authorization gate that never checked its own recorded `maxCalls`/`maxTokens`/`maxCostUsd`
 * against the plan; and terminal/count validators that ignored most of their own fields) are fixed
 * here, not patched in place, because the shapes involved changed structurally (two-stage plan
 * identity, artifact-bound evidence, a single pricing/hash authority). See
 * `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md`'s post-merge correction section for the
 * full defect-by-defect mapping and the red-baseline command/output that reproduced each one before
 * this file changed.
 */

export const PROTOCOL_V4_VERSION = 'resolver-v3-048-protocol-v4-phase-a-v1';
export const PROTOCOL_V4_EXECUTION_TREE_VERSION = 'resolver-v3-048-execution-tree-v2';
export const PROTOCOL_V4_CANDIDATE_SET_VERSION = 'resolver-v3-047-h0-h1-h2-v1';
export const PROTOCOL_V4_MODEL_ID = 'claude-haiku-4-5-20251001' as const;
export const PROTOCOL_V4_EVALUATOR_VERSION = 'resolver-v3-042-corrected-g2-evaluator-v1';
export const PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION = 'resolver-v3-048-artifacts-v2';
export const PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION = 'resolver-v3-048-authorization-v1';
export const PROTOCOL_V4_SELECTION_RECORD_SCHEMA_VERSION = 'resolver-v3-048-selection-record-v1';
export const PROTOCOL_V4_DRY_RUN_ROOT = 'tmp/resolver-v3-048-protocol-v4-dry-run';
export const PROTOCOL_V4_LIVE_ROOT = 'logs/resolver-v3-048-protocol-v4';

export const PROTOCOL_V4_G2_GATES = [
  'G2-A',
  'G2-B',
  'G2-C',
  'G2-D',
  'G2-E',
  'G2-F',
  'G2-G',
] as const;
export type ProtocolV4G2Gate = (typeof PROTOCOL_V4_G2_GATES)[number];
export type ProtocolV4GateVerdict =
  | 'passed'
  | 'failed'
  | 'not_evaluable'
  | 'requires_human_judgment';

// -------------------------------------------------------------------------------------------------
// Counts, pricing/usage/cost status, terminal metadata (Part 8: closed validators)
// -------------------------------------------------------------------------------------------------

export type AccuracyStatus = 'exact' | 'lower_bound' | 'unknown' | 'not_applicable';
export type CountBoundary =
  | 'benchmark_dispatch'
  | 'provider_transport'
  | 'source_adapter'
  | 'resolver_legacy_aggregate'
  | 'retry_controller';
export interface MeasuredCount {
  value: number | null;
  accuracy: AccuracyStatus;
  boundary: CountBoundary;
}
export interface ProtocolV4CallCounts {
  aiDispatches: MeasuredCount;
  providerHttpRequests: MeasuredCount;
  blsCalls: MeasuredCount;
  offCalls: MeasuredCount;
  usdaCalls: MeasuredCount;
  totalExternalRequests: MeasuredCount;
  avoidedSourceCalls: MeasuredCount;
  automaticRetries: MeasuredCount;
}

export type ProtocolV4FailureKind =
  | 'transport_error'
  | 'timeout_abort'
  | 'wall_clock_ceiling'
  | 'http_error'
  | 'http_envelope_json_error'
  | 'http_envelope_contract_error'
  | 'missing_text_block'
  | 'text_block_json_error'
  | 'schema_contract_error'
  | 'internal_parser_error'
  | 'usage_cost_contract_error'
  | 'budget_config_error';

/** Failure kinds where the provider never returned a parseable, billable response at all -- these
 * can never legitimately carry reported usage or a computed cost. All other failure kinds
 * (`text_block_json_error`, `schema_contract_error`, `internal_parser_error`,
 * `usage_cost_contract_error`) can: the provider may have consumed real, billable tokens before the
 * response failed a later parse/schema/no-cache contract. */
export const NETWORK_LEVEL_FAILURE_KINDS: readonly ProtocolV4FailureKind[] = [
  'transport_error',
  'timeout_abort',
  'wall_clock_ceiling',
  'http_error',
  'http_envelope_json_error',
  'http_envelope_contract_error',
  'missing_text_block',
  'budget_config_error',
];
export type PricingStatus = 'known' | 'estimated';
export type UsageStatus = 'reported' | 'unknown' | 'not_applicable';
export type ActualCostStatus =
  | 'computed'
  | 'usage_unknown'
  | 'usage_cost_contract_error'
  | 'not_applicable';

export interface ProtocolV4RunIdentity {
  protocolVersion: typeof PROTOCOL_V4_VERSION;
  planHash: string;
  executionTreeHash: string;
  candidateId: ResolverV3047CandidateId;
  candidateVersion: string;
  promptVersion: string;
  schemaVersion: string;
  routingVersion: string;
  modelId: string;
  pricingVersion: string;
  partition: RepresentativeHybridV1Partition;
  scenarioId: string;
  runIndex: number;
  callId: string;
}
export interface ProtocolV4TerminalMetadata {
  schemaVersion: typeof PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION;
  runIdentity: ProtocolV4RunIdentity;
  pricingStatus: PricingStatus;
  usageStatus: UsageStatus;
  actualCostStatus: ActualCostStatus;
  reservationId: string | null;
  reservedWorstCaseCostUsd: number;
  actualCostUsd: number | null;
  failureKind: ProtocolV4FailureKind | null;
  retryable: boolean;
  httpStatus: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  providerLatencyMs: number | null;
  endToEndLatencyMs: number;
  counts: ProtocolV4CallCounts;
}

export interface ProtocolV4TerminalContext {
  planHash: string;
  executionTreeHash: string;
  candidateId: ResolverV3047CandidateId;
  scenarioId: string;
  partition: RepresentativeHybridV1Partition;
}

/** Every field individually validated -- fails closed on `null` where a numeric value is required,
 * a numeric value where `null` is required, non-integers, negatives, and non-finite numbers. */
export function validateMeasuredCount(count: MeasuredCount, fieldName: string): void {
  if (count.accuracy === 'exact' || count.accuracy === 'lower_bound') {
    if (
      count.value === null ||
      !Number.isFinite(count.value) ||
      !Number.isInteger(count.value) ||
      count.value < 0
    )
      throw new Error(`PROTOCOL_V4_MEASURED_COUNT_INVALID:${fieldName}`);
  } else if (count.value !== null) {
    throw new Error(`PROTOCOL_V4_MEASURED_COUNT_VALUE_FORBIDDEN:${fieldName}`);
  }
  if (count.boundary === 'resolver_legacy_aggregate' && count.accuracy === 'exact')
    throw new Error(`PROTOCOL_V4_LEGACY_AGGREGATE_NEVER_EXACT:${fieldName}`);
}

export function validateProtocolV4CallCounts(counts: ProtocolV4CallCounts): void {
  (Object.keys(counts) as (keyof ProtocolV4CallCounts)[]).forEach((key) =>
    validateMeasuredCount(counts[key], key),
  );
  if (counts.automaticRetries.accuracy === 'exact' && counts.automaticRetries.value !== 0)
    throw new Error('PROTOCOL_V4_AUTOMATIC_RETRIES_MUST_BE_ZERO');
  const sourcesExact = (['blsCalls', 'offCalls', 'usdaCalls'] as const).every(
    (k) => counts[k].accuracy === 'exact',
  );
  if (sourcesExact && counts.totalExternalRequests.accuracy === 'exact') {
    const sourceSum =
      (counts.blsCalls.value ?? 0) + (counts.offCalls.value ?? 0) + (counts.usdaCalls.value ?? 0);
    if ((counts.totalExternalRequests.value ?? 0) < sourceSum)
      throw new Error('PROTOCOL_V4_TOTAL_EXTERNAL_REQUESTS_INCONSISTENT');
  }
}

export function validateTerminalMetadata(
  meta: ProtocolV4TerminalMetadata,
  context?: ProtocolV4TerminalContext,
): void {
  if (meta.runIdentity.protocolVersion !== PROTOCOL_V4_VERSION)
    throw new Error('PROTOCOL_V4_RUN_IDENTITY_REQUIRED');
  validateProtocolV4CallCounts(meta.counts);

  if (!Number.isFinite(meta.reservedWorstCaseCostUsd) || meta.reservedWorstCaseCostUsd < 0)
    throw new Error('PROTOCOL_V4_RESERVED_COST_INVALID');
  if (!Number.isFinite(meta.endToEndLatencyMs) || meta.endToEndLatencyMs < 0)
    throw new Error('PROTOCOL_V4_END_TO_END_LATENCY_INVALID');
  if (
    meta.providerLatencyMs !== null &&
    (!Number.isFinite(meta.providerLatencyMs) || meta.providerLatencyMs < 0)
  )
    throw new Error('PROTOCOL_V4_PROVIDER_LATENCY_INVALID');
  if (
    meta.actualCostUsd !== null &&
    (!Number.isFinite(meta.actualCostUsd) || meta.actualCostUsd < 0)
  )
    throw new Error('PROTOCOL_V4_ACTUAL_COST_INVALID');

  if (meta.usageStatus === 'reported' && (meta.inputTokens === null || meta.outputTokens === null))
    throw new Error('PROTOCOL_V4_REPORTED_USAGE_TOKENS_REQUIRED');
  if (meta.usageStatus !== 'reported' && (meta.inputTokens !== null || meta.outputTokens !== null))
    throw new Error('PROTOCOL_V4_UNREPORTED_USAGE_TOKENS_FORBIDDEN');

  if (meta.actualCostStatus === 'computed' && meta.actualCostUsd === null)
    throw new Error('PROTOCOL_V4_COMPUTED_REQUIRES_ACTUAL_COST');
  if (meta.actualCostStatus !== 'computed' && meta.actualCostUsd !== null)
    throw new Error('PROTOCOL_V4_NON_COMPUTED_FORBIDS_ACTUAL_COST');

  // A network-level failure (never reached, or never returned, a parseable billable response) can
  // never report real usage/cost -- but a downstream parse/schema/internal failure legitimately can:
  // the provider may have consumed real, billable tokens before the response failed a later contract
  // (e.g. `text_block_json_error`/`schema_contract_error`). Only the network-level kinds below are
  // incompatible with reported usage/computed cost.
  if (
    meta.failureKind !== null &&
    (NETWORK_LEVEL_FAILURE_KINDS as readonly (string | null)[]).includes(meta.failureKind) &&
    (meta.usageStatus === 'reported' || meta.actualCostStatus === 'computed')
  )
    throw new Error('PROTOCOL_V4_NETWORK_FAILURE_CANNOT_REPORT_USAGE');
  if (
    (meta.usageStatus === 'unknown' ||
      meta.actualCostStatus === 'usage_unknown' ||
      meta.actualCostStatus === 'usage_cost_contract_error') &&
    meta.failureKind === null
  )
    throw new Error('PROTOCOL_V4_FAILURE_REQUIRES_FAILURE_KIND');
  if (meta.failureKind === null && meta.retryable)
    throw new Error('PROTOCOL_V4_SUCCESS_CANNOT_BE_RETRYABLE');

  if ((meta.cacheCreationTokens ?? 0) > 0 || (meta.cacheReadTokens ?? 0) > 0) {
    if (
      meta.failureKind !== 'usage_cost_contract_error' ||
      meta.actualCostStatus !== 'usage_cost_contract_error' ||
      meta.actualCostUsd !== null ||
      meta.retryable
    )
      throw new Error('PROTOCOL_V4_NO_CACHE_CONTRACT');
  }
  if (
    meta.failureKind === 'wall_clock_ceiling' &&
    (meta.pricingStatus !== 'estimated' ||
      meta.usageStatus !== 'unknown' ||
      meta.actualCostStatus !== 'usage_unknown' ||
      meta.actualCostUsd !== null ||
      meta.retryable)
  )
    throw new Error('PROTOCOL_V4_WALL_CLOCK_CONTRACT');

  if (context) {
    if (
      meta.runIdentity.planHash !== context.planHash ||
      meta.runIdentity.executionTreeHash !== context.executionTreeHash ||
      meta.runIdentity.candidateId !== context.candidateId ||
      meta.runIdentity.scenarioId !== context.scenarioId ||
      meta.runIdentity.partition !== context.partition
    )
      throw new Error('PROTOCOL_V4_RUN_IDENTITY_CONTEXT_MISMATCH');
  }
}

export function assertTelemetryLedgerParity(
  telemetry: ProtocolV4TerminalMetadata,
  ledger: ProtocolV4TerminalMetadata,
): void {
  for (const key of [
    'runIdentity',
    'pricingStatus',
    'usageStatus',
    'actualCostStatus',
    'reservationId',
    'reservedWorstCaseCostUsd',
    'actualCostUsd',
    'failureKind',
    'retryable',
    'httpStatus',
    'inputTokens',
    'outputTokens',
    'cacheCreationTokens',
    'cacheReadTokens',
    'providerLatencyMs',
    'endToEndLatencyMs',
    'counts',
  ] as const)
    if (canonical(telemetry[key]) !== canonical(ledger[key]))
      throw new Error(`PROTOCOL_V4_TELEMETRY_LEDGER_MISMATCH:${key}`);
}

// -------------------------------------------------------------------------------------------------
// Canonical hashing
// -------------------------------------------------------------------------------------------------

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object')
    return Object.keys(value as object)
      .sort()
      .reduce<Record<string, unknown>>(
        (o, k) => ((o[k] = sortDeep((value as Record<string, unknown>)[k])), o),
        {},
      );
  return value;
}
const canonical = (value: unknown): string => JSON.stringify(sortDeep(value));
export const hashProtocolV4 = (value: unknown): string =>
  createHash('sha256').update(canonical(value)).digest('hex');

// -------------------------------------------------------------------------------------------------
// Part 4A: Master Protocol Plan (frozen before Development; never claims all 3 candidates run Holdout)
// -------------------------------------------------------------------------------------------------

export interface CandidateIdentity {
  id: ResolverV3047CandidateId;
  version: string;
  promptVersion: string;
  promptHash: string;
  schemaVersion: string;
  schemaHash: string;
  routingVersion: string;
}
export interface ProtocolV4Observation {
  scenarioId: string;
  partition: RepresentativeHybridV1Partition;
  category: string;
  difficulty: string;
  candidateId: ResolverV3047CandidateId;
  runIndex: number;
  expectedBehavior: string;
}
/** Candidate-agnostic: the Master Plan may not pin which single candidate will run Holdout. */
export interface ProtocolV4HoldoutTemplateObservation {
  scenarioId: string;
  partition: 'holdout';
  category: string;
  difficulty: string;
  runIndex: number;
  expectedBehavior: string;
}
export interface ProtocolV4Budget {
  developmentCalls: number;
  developmentMaxTokens: number;
  developmentMaxCostUsd: number;
  holdoutCalls: number;
  holdoutMaxTokens: number;
  holdoutMaxCostUsd: number;
  totalCalls: number;
  totalMaxTokens: number;
  totalMaxCostUsd: number;
  maxConcurrentRequests: 1;
  currency: 'USD';
  authorization: 'proposal_only';
}

export const SELECTION_RULE = {
  version: 'resolver-v3-048-selection-rule-v1',
  eligibility: [
    'zero_critical_false_confidence',
    'complete_contract_envelope_parsing_failure_taxonomy',
    'all_existing_mandatory_g2_criteria_pass_individually',
  ] as const,
  orderedComparison: [
    'identification_and_complex_component_quality',
    'clarification_and_abstention',
    'repeat_consistency',
    'cost_per_successful_validated_log',
    'p50_then_p95',
    'failure_rate',
    'ai_then_source_call_counts',
  ] as const,
  direction: [
    'existing_g2_contract',
    'existing_g2_contract',
    'existing_g2_contract',
    'lower',
    'lower',
    'lower',
    'lower',
  ] as const,
  tieBreakers: [
    'lower_critical_failure_count',
    'higher_complex_component_quality',
    'higher_identification_quality',
    'lower_validated_log_cost',
    'lower_p95',
    'lower_p50',
    'lower_candidate_id_lexicographic',
  ] as const,
  averagesMayMaskMandatoryGate: false,
} as const;

export const ARTIFACT_PATHS = {
  plan: 'master-plan.json',
  planManifest: 'protocol-v4-plan-manifest.json',
  sourceManifest: 'source-manifest.json',
  candidateManifest: 'candidate-manifest.json',
  pricingManifest: 'pricing-manifest.json',
  developmentCheckpointH0: 'development/H0/checkpoint.json',
  developmentCheckpointH1: 'development/H1/checkpoint.json',
  developmentCheckpointH2: 'development/H2/checkpoint.json',
  developmentRawResultsH0: 'development/H0/raw-results.json',
  developmentRawResultsH1: 'development/H1/raw-results.json',
  developmentRawResultsH2: 'development/H2/raw-results.json',
  developmentCategoryTableH0: 'development/H0/category-table.json',
  developmentCategoryTableH1: 'development/H1/category-table.json',
  developmentCategoryTableH2: 'development/H2/category-table.json',
  developmentTelemetryH0: 'development/H0/telemetry.json',
  developmentTelemetryH1: 'development/H1/telemetry.json',
  developmentTelemetryH2: 'development/H2/telemetry.json',
  developmentLedgerH0: 'development/H0/ledger.json',
  developmentLedgerH1: 'development/H1/ledger.json',
  developmentLedgerH2: 'development/H2/ledger.json',
  developmentEvaluationH0: 'development/H0/evaluation.json',
  developmentEvaluationH1: 'development/H1/evaluation.json',
  developmentEvaluationH2: 'development/H2/evaluation.json',
  candidateEvaluationTable: 'selection/candidate-evaluation-table.json',
  candidateSelectionRecord: 'selection/candidate-selection-record.json',
  holdoutExecutionPlan: 'holdout/holdout-execution-plan.json',
  holdoutAuthorizationRecord: 'authorization/holdout-authorization-record.json',
  holdoutCheckpoint: 'holdout/checkpoint.json',
  holdoutRawResults: 'holdout/raw-results.json',
  holdoutCategoryTable: 'holdout/category-table.json',
  holdoutTelemetry: 'holdout/telemetry.json',
  holdoutLedger: 'holdout/ledger.json',
  holdoutEvaluation: 'holdout/evaluation.json',
  finalG2DecisionReport: 'final/g2-decision-report.json',
} as const;

export interface ProtocolV4MasterPlan {
  protocolVersion: typeof PROTOCOL_V4_VERSION;
  executionTreeVersion: typeof PROTOCOL_V4_EXECUTION_TREE_VERSION;
  developmentExecutionTreeHash: string;
  corpus: { version: string; hash: string };
  groundTruth: { version: string; hash: string };
  sourceManifest: { version: string; hash: string };
  evaluator: {
    version: string;
    hash: string;
    algorithmVersion: string;
    manifestPaths: readonly string[];
  };
  candidateSetVersion: typeof PROTOCOL_V4_CANDIDATE_SET_VERSION;
  candidates: readonly CandidateIdentity[];
  candidateManifestHash: string;
  promptManifestHash: string;
  schemaManifestHash: string;
  pricing: ProtocolV4PricingIdentity;
  pricingManifestHash: string;
  contextPolicy: 'C0';
  modelId: typeof PROTOCOL_V4_MODEL_ID;
  transportTimeoutMs: 15000;
  wallClockCeilingMs: 20000;
  retryCount: 0;
  maxTokens: 1536;
  temperature: 0;
  partitions: { development: 'development'; holdout: 'holdout' };
  repetitionPolicy: 'corpus_overlay_v1';
  /** All 3 candidates, Development only -- Holdout is never enumerated per-candidate here. */
  developmentObservations: readonly ProtocolV4Observation[];
  /** Candidate-agnostic Holdout template: the scenario/run structure for whichever ONE candidate is
   * later selected. The Master Plan explicitly does not claim all three candidates run Holdout. */
  holdoutTemplate: { observations: readonly ProtocolV4HoldoutTemplateObservation[] };
  selectionRule: typeof SELECTION_RULE;
  g2Gates: typeof PROTOCOL_V4_G2_GATES;
  budget: ProtocolV4Budget;
  noCachePolicy: {
    promptCachingConfigured: false;
    positiveCacheTokensFailure: 'usage_cost_contract_error';
  };
  artifactContract: typeof ARTIFACT_PATHS;
  automaticContinuation: false;
  planHash: string;
}

function resolutionScenarios(): RepresentativeHybridV1ResolutionScenario[] {
  return REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS.filter(
    (s): s is RepresentativeHybridV1ResolutionScenario =>
      s.scenarioType === 'resolution_decomposition',
  );
}
function repeatCount(s: RepresentativeHybridV1ResolutionScenario): number {
  return s.repeatOverlay ? 3 : 1;
}

function developmentObservations(): ProtocolV4Observation[] {
  return resolutionScenarios()
    .filter((s) => s.partition === 'development')
    .flatMap((s) =>
      RESOLVER_V3_047_CANDIDATES.flatMap((c) =>
        Array.from({ length: repeatCount(s) }, (_, runIndex) => ({
          scenarioId: s.scenarioId,
          partition: s.partition,
          category: s.case.category,
          difficulty: s.difficulty,
          candidateId: c.id,
          runIndex,
          expectedBehavior: s.case.expectedBehavior,
        })),
      ),
    )
    .sort((a, b) => canonical(a).localeCompare(canonical(b)));
}

function holdoutTemplateObservations(): ProtocolV4HoldoutTemplateObservation[] {
  return resolutionScenarios()
    .filter((s) => s.partition === 'holdout')
    .flatMap((s) =>
      Array.from({ length: repeatCount(s) }, (_, runIndex) => ({
        scenarioId: s.scenarioId,
        partition: 'holdout' as const,
        category: s.case.category,
        difficulty: s.difficulty,
        runIndex,
        expectedBehavior: s.case.expectedBehavior,
      })),
    )
    .sort((a, b) => canonical(a).localeCompare(canonical(b)));
}

/** Builds the immutable Master Protocol Plan, frozen before any Development call. `repoRoot`
 * defaults to the process working directory (the repository root under `npm test`/CI). */
export function buildProtocolV4MasterPlan(repoRoot: string = process.cwd()): ProtocolV4MasterPlan {
  const candidates: CandidateIdentity[] = RESOLVER_V3_047_CANDIDATES.map((c) => ({
    id: c.id,
    version: c.version,
    promptVersion: c.promptVersion,
    promptHash: hashProtocolV4(c.prompt),
    schemaVersion: c.schemaVersion,
    schemaHash: hashProtocolV4(c.schema),
    routingVersion: c.routingVersion,
  }));
  const devObs = developmentObservations();
  const holdoutTemplate = { observations: holdoutTemplateObservations() };
  const pricing = resolveProtocolV4Pricing(PROTOCOL_V4_MODEL_ID);

  const developmentExecutionTreeHash = hashProtocolV4({
    version: PROTOCOL_V4_EXECUTION_TREE_VERSION,
    candidates,
    developmentObservations: devObs,
    holdoutTemplate,
    selectionRule: SELECTION_RULE,
    automaticContinuation: false,
  });

  const perCallTokens = 8192 + 1536;
  const perCallCost =
    (8192 / 1e6) * pricing.inputPerMillion + (1536 / 1e6) * pricing.outputPerMillion;
  const developmentCalls = devObs.length;
  const holdoutCalls = holdoutTemplate.observations.length;
  const budget: ProtocolV4Budget = {
    developmentCalls,
    developmentMaxTokens: developmentCalls * perCallTokens,
    developmentMaxCostUsd: developmentCalls * perCallCost,
    holdoutCalls,
    holdoutMaxTokens: holdoutCalls * perCallTokens,
    holdoutMaxCostUsd: holdoutCalls * perCallCost,
    totalCalls: developmentCalls + holdoutCalls,
    totalMaxTokens: (developmentCalls + holdoutCalls) * perCallTokens,
    totalMaxCostUsd: (developmentCalls + holdoutCalls) * perCallCost,
    maxConcurrentRequests: 1,
    currency: 'USD',
    authorization: 'proposal_only',
  };

  const withoutHash: Omit<ProtocolV4MasterPlan, 'planHash'> = {
    protocolVersion: PROTOCOL_V4_VERSION,
    executionTreeVersion: PROTOCOL_V4_EXECUTION_TREE_VERSION,
    developmentExecutionTreeHash,
    corpus: {
      version: REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
      hash: REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
    },
    groundTruth: {
      version: `${REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION}-ground-truth-v1`,
      hash: hashProtocolV4(resolutionScenarios().map((s) => ({ id: s.scenarioId, case: s.case }))),
    },
    sourceManifest: {
      version: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION,
      hash: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
    },
    evaluator: {
      version: PROTOCOL_V4_EVALUATOR_VERSION,
      hash: computeProtocolV4EvaluatorManifestHash(repoRoot),
      algorithmVersion: PROTOCOL_V4_EVALUATOR_HASH_ALGORITHM_VERSION,
      manifestPaths: PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS,
    },
    candidateSetVersion: PROTOCOL_V4_CANDIDATE_SET_VERSION,
    candidates,
    candidateManifestHash: hashProtocolV4(candidates),
    promptManifestHash: hashProtocolV4(
      candidates.map((c) => ({ id: c.id, promptHash: c.promptHash })),
    ),
    schemaManifestHash: hashProtocolV4(
      candidates.map((c) => ({ id: c.id, schemaHash: c.schemaHash })),
    ),
    pricing,
    pricingManifestHash: hashProtocolV4(pricing),
    contextPolicy: 'C0' as const,
    modelId: PROTOCOL_V4_MODEL_ID,
    transportTimeoutMs: 15000 as const,
    wallClockCeilingMs: 20000 as const,
    retryCount: 0 as const,
    maxTokens: 1536 as const,
    temperature: 0 as const,
    partitions: { development: 'development' as const, holdout: 'holdout' as const },
    repetitionPolicy: 'corpus_overlay_v1' as const,
    developmentObservations: devObs,
    holdoutTemplate,
    selectionRule: SELECTION_RULE,
    g2Gates: PROTOCOL_V4_G2_GATES,
    budget,
    noCachePolicy: {
      promptCachingConfigured: false as const,
      positiveCacheTokensFailure: 'usage_cost_contract_error' as const,
    },
    artifactContract: ARTIFACT_PATHS,
    automaticContinuation: false as const,
  };
  return { ...withoutHash, planHash: hashProtocolV4(withoutHash) };
}

export function validateProtocolV4MasterPlan(plan: ProtocolV4MasterPlan): void {
  const { planHash, ...body } = plan;
  if (!planHash || hashProtocolV4(body) !== planHash)
    throw new Error('PROTOCOL_V4_PLAN_HASH_MISMATCH');
  if (
    plan.developmentExecutionTreeHash !==
    hashProtocolV4({
      version: plan.executionTreeVersion,
      candidates: plan.candidates,
      developmentObservations: plan.developmentObservations,
      holdoutTemplate: plan.holdoutTemplate,
      selectionRule: plan.selectionRule,
      automaticContinuation: false,
    })
  )
    throw new Error('PROTOCOL_V4_EXECUTION_TREE_HASH_MISMATCH');
  if (
    plan.modelId !== PROTOCOL_V4_MODEL_ID ||
    plan.retryCount !== 0 ||
    plan.noCachePolicy.promptCachingConfigured
  )
    throw new Error('PROTOCOL_V4_PINNED_CONFIGURATION_MISMATCH');
  // Part 2: single pricing authority -- blocks before dispatch on any drift.
  assertProtocolV4PricingIdentityMatches(plan.modelId, plan.pricing.pricingVersion);
  if (hashProtocolV4(plan.pricing) !== plan.pricingManifestHash)
    throw new Error('PROTOCOL_V4_PRICING_MANIFEST_HASH_MISMATCH');
  // Master Plan must never claim all three candidates run Holdout.
  const firstHoldoutTemplateRow = plan.holdoutTemplate.observations[0] as unknown as
    | Record<string, unknown>
    | undefined;
  if (firstHoldoutTemplateRow && 'candidateId' in firstHoldoutTemplateRow)
    throw new Error('PROTOCOL_V4_HOLDOUT_TEMPLATE_MUST_NOT_PIN_CANDIDATE');
}

// -------------------------------------------------------------------------------------------------
// Part 5: category evidence (frozen partition/category/repetition closure)
// -------------------------------------------------------------------------------------------------

export interface CategoryEvidence {
  scenarioId: string;
  partition: RepresentativeHybridV1Partition;
  category: string;
  difficulty: string;
  candidateId: ResolverV3047CandidateId;
  runIndex: number;
  planHash: string;
  expectedBehavior: string;
  identificationOutcome: string;
  criticalError: boolean;
  failureKind: ProtocolV4FailureKind | null;
  resolverOutcome: string;
  componentCount: number;
  clarification: boolean;
  abstention: boolean;
}
export function validateCategoryEvidence(
  expected: readonly {
    scenarioId: string;
    partition: RepresentativeHybridV1Partition;
    category: string;
    runIndex: number;
  }[],
  planHash: string,
  candidateId: ResolverV3047CandidateId,
  rows: readonly CategoryEvidence[],
): void {
  const keys = new Set<string>();
  for (const row of rows) {
    const key = `${row.scenarioId}:${row.runIndex}`;
    if (keys.has(key)) throw new Error('PROTOCOL_V4_DUPLICATE_SCENARIO_RUN');
    keys.add(key);
    const frozen = expected.find(
      (o) => o.scenarioId === row.scenarioId && o.runIndex === row.runIndex,
    );
    if (!frozen) throw new Error('PROTOCOL_V4_UNKNOWN_SCENARIO_OR_REPETITION');
    if (row.planHash !== planHash) throw new Error('PROTOCOL_V4_CATEGORY_PLAN_HASH_MISMATCH');
    if (row.candidateId !== candidateId) throw new Error('PROTOCOL_V4_MIXED_CANDIDATE');
    if (row.partition !== frozen.partition) throw new Error('PROTOCOL_V4_WRONG_PARTITION');
    if (row.category !== frozen.category)
      throw new Error('PROTOCOL_V4_UNKNOWN_OR_DERIVED_CATEGORY');
  }
  if (keys.size !== expected.length) throw new Error('PROTOCOL_V4_MISSING_SCENARIO_OR_REPETITION');
}

// -------------------------------------------------------------------------------------------------
// Part 5: candidate evaluation + artifact-bound development evidence + candidate selection record
// -------------------------------------------------------------------------------------------------

export interface CandidateEvaluation {
  candidateId: ResolverV3047CandidateId;
  allMandatoryG2CriteriaPass: boolean;
  criticalFalseConfidenceCount: number;
  contractsComplete: boolean;
  identificationQuality: number;
  complexComponentQuality: number;
  clarificationAbstentionQuality: number;
  repeatConsistency: number;
  costPerValidatedLogUsd: number;
  p50Ms: number;
  p95Ms: number;
  failureRate: number;
  aiCalls: number;
  sourceCalls: number;
  g2Results: Readonly<Record<ProtocolV4G2Gate, ProtocolV4GateVerdict>>;
}

export function validateCandidateEvaluation(e: CandidateEvaluation): void {
  const numericFields: (keyof CandidateEvaluation)[] = [
    'identificationQuality',
    'complexComponentQuality',
    'clarificationAbstentionQuality',
    'repeatConsistency',
    'costPerValidatedLogUsd',
    'p50Ms',
    'p95Ms',
    'failureRate',
    'aiCalls',
    'sourceCalls',
    'criticalFalseConfidenceCount',
  ];
  for (const field of numericFields) {
    const value = e[field] as unknown as number;
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(`PROTOCOL_V4_CANDIDATE_EVALUATION_NON_FINITE:${String(field)}`);
  }
  if (e.criticalFalseConfidenceCount < 0 || e.aiCalls < 0 || e.sourceCalls < 0)
    throw new Error('PROTOCOL_V4_CANDIDATE_EVALUATION_NEGATIVE_COUNT');
  if (e.failureRate < 0 || e.failureRate > 1)
    throw new Error('PROTOCOL_V4_CANDIDATE_EVALUATION_FAILURE_RATE_RANGE');
  for (const gate of PROTOCOL_V4_G2_GATES)
    if (!(gate in e.g2Results)) throw new Error(`PROTOCOL_V4_MISSING_G2_RESULT:${gate}`);
  const anyFailed = PROTOCOL_V4_G2_GATES.some((gate) => e.g2Results[gate] === 'failed');
  if (anyFailed && e.allMandatoryG2CriteriaPass)
    throw new Error('PROTOCOL_V4_G2_RESULT_INCOHERENT');
}

export function selectCandidate(
  evaluations: readonly CandidateEvaluation[],
): ResolverV3047CandidateId {
  const eligible = evaluations.filter(
    (e) =>
      e.allMandatoryG2CriteriaPass && e.criticalFalseConfidenceCount === 0 && e.contractsComplete,
  );
  if (!eligible.length) throw new Error('PROTOCOL_V4_NO_ELIGIBLE_CANDIDATE');
  const sorted = [...eligible].sort(
    (a, b) =>
      b.complexComponentQuality - a.complexComponentQuality ||
      b.identificationQuality - a.identificationQuality ||
      b.clarificationAbstentionQuality - a.clarificationAbstentionQuality ||
      b.repeatConsistency - a.repeatConsistency ||
      a.costPerValidatedLogUsd - b.costPerValidatedLogUsd ||
      a.p95Ms - b.p95Ms ||
      a.p50Ms - b.p50Ms ||
      a.failureRate - b.failureRate ||
      a.aiCalls - b.aiCalls ||
      a.sourceCalls - b.sourceCalls ||
      a.candidateId.localeCompare(b.candidateId),
  );
  return sorted[0].candidateId;
}

export interface ProtocolV4Artifact<T> {
  artifactSchemaVersion: typeof PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION;
  artifactName: string;
  planHash: string;
  content: T;
  contentHash: string;
}
export function sealProtocolV4Artifact<T>(
  artifactName: string,
  planHash: string,
  content: T,
): ProtocolV4Artifact<T> {
  return {
    artifactSchemaVersion: PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION,
    artifactName,
    planHash,
    content,
    contentHash: hashProtocolV4(content),
  };
}
export function validateProtocolV4Artifact<T>(
  artifact: ProtocolV4Artifact<T>,
  expectedName: string,
  planHash: string,
): void {
  if (artifact.artifactSchemaVersion !== PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION)
    throw new Error('PROTOCOL_V4_ARTIFACT_SCHEMA_MISMATCH');
  if (artifact.artifactName !== expectedName) throw new Error('PROTOCOL_V4_ARTIFACT_NAME_MISMATCH');
  if (artifact.planHash !== planHash) throw new Error('PROTOCOL_V4_ARTIFACT_PLAN_HASH_MISMATCH');
  if (hashProtocolV4(artifact.content) !== artifact.contentHash)
    throw new Error('PROTOCOL_V4_ARTIFACT_CONTENT_HASH_MISMATCH');
}

export interface ProtocolV4DevelopmentCandidateArtifacts {
  candidateId: ResolverV3047CandidateId;
  checkpoint: ProtocolV4Artifact<{
    completedCallIds: readonly string[];
    candidateId: ResolverV3047CandidateId;
  }>;
  rawResults: ProtocolV4Artifact<{
    candidateId: ResolverV3047CandidateId;
    results: readonly unknown[];
  }>;
  categoryTable: ProtocolV4Artifact<readonly CategoryEvidence[]>;
  telemetry: ProtocolV4Artifact<readonly ProtocolV4TerminalMetadata[]>;
  ledger: ProtocolV4Artifact<readonly ProtocolV4TerminalMetadata[]>;
  evaluation: ProtocolV4Artifact<CandidateEvaluation>;
}
export interface ProtocolV4DevelopmentEvidence {
  planManifest: ProtocolV4Artifact<{ planHash: string; developmentExecutionTreeHash: string }>;
  candidates: readonly ProtocolV4DevelopmentCandidateArtifacts[];
  candidateEvaluationTable: ProtocolV4Artifact<readonly CandidateEvaluation[]>;
}

export function computeDevelopmentEvidenceRootHash(
  evidence: ProtocolV4DevelopmentEvidence,
): string {
  const perCandidate = evidence.candidates
    .map((c) => ({
      candidateId: c.candidateId,
      checkpointHash: c.checkpoint.contentHash,
      rawResultsHash: c.rawResults.contentHash,
      categoryTableHash: c.categoryTable.contentHash,
      telemetryHash: c.telemetry.contentHash,
      ledgerHash: c.ledger.contentHash,
      evaluationHash: c.evaluation.contentHash,
    }))
    .sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  return hashProtocolV4({
    planManifestHash: evidence.planManifest.contentHash,
    perCandidate,
    candidateEvaluationTableHash: evidence.candidateEvaluationTable.contentHash,
  });
}

export function validateProtocolV4DevelopmentEvidence(
  plan: ProtocolV4MasterPlan,
  evidence: ProtocolV4DevelopmentEvidence,
): void {
  validateProtocolV4Artifact(evidence.planManifest, 'development-plan-manifest', plan.planHash);
  if (
    evidence.planManifest.content.developmentExecutionTreeHash !== plan.developmentExecutionTreeHash
  )
    throw new Error('PROTOCOL_V4_DEVELOPMENT_EVIDENCE_TREE_MISMATCH');
  const ids = evidence.candidates.map((c) => c.candidateId);
  if (
    ids.length !== 3 ||
    new Set(ids).size !== 3 ||
    !(['H0', 'H1', 'H2'] as const).every((id) => ids.includes(id))
  )
    throw new Error('PROTOCOL_V4_DEVELOPMENT_EVIDENCE_CANDIDATE_SET_INCOMPLETE');
  for (const c of evidence.candidates) {
    const expected = plan.developmentObservations.filter(
      (o) => o.partition === 'development' && o.candidateId === c.candidateId,
    );
    validateProtocolV4Artifact(
      c.checkpoint,
      `development-checkpoint-${c.candidateId}`,
      plan.planHash,
    );
    validateProtocolV4Artifact(
      c.rawResults,
      `development-raw-results-${c.candidateId}`,
      plan.planHash,
    );
    validateProtocolV4Artifact(
      c.categoryTable,
      `development-category-table-${c.candidateId}`,
      plan.planHash,
    );
    validateCategoryEvidence(expected, plan.planHash, c.candidateId, c.categoryTable.content);
    validateProtocolV4Artifact(
      c.telemetry,
      `development-telemetry-${c.candidateId}`,
      plan.planHash,
    );
    validateProtocolV4Artifact(c.ledger, `development-ledger-${c.candidateId}`, plan.planHash);
    c.telemetry.content.forEach((t) => validateTerminalMetadata(t));
    c.ledger.content.forEach((t) => validateTerminalMetadata(t));
    validateProtocolV4Artifact(
      c.evaluation,
      `development-evaluation-${c.candidateId}`,
      plan.planHash,
    );
    if (c.evaluation.content.candidateId !== c.candidateId)
      throw new Error('PROTOCOL_V4_EVALUATION_CANDIDATE_MISMATCH');
    validateCandidateEvaluation(c.evaluation.content);
  }
  validateProtocolV4Artifact(
    evidence.candidateEvaluationTable,
    'candidate-evaluation-table',
    plan.planHash,
  );
  if (evidence.candidateEvaluationTable.content.length !== 3)
    throw new Error('PROTOCOL_V4_EVALUATION_TABLE_INCOMPLETE');
  const tableIds = evidence.candidateEvaluationTable.content.map((e) => e.candidateId);
  if (new Set(tableIds).size !== 3)
    throw new Error('PROTOCOL_V4_EVALUATION_TABLE_DUPLICATE_CANDIDATE');
  for (const c of evidence.candidates) {
    const row = evidence.candidateEvaluationTable.content.find(
      (e) => e.candidateId === c.candidateId,
    );
    if (!row || hashProtocolV4(row) !== c.evaluation.contentHash)
      throw new Error('PROTOCOL_V4_EVALUATION_TABLE_ARTIFACT_DRIFT');
  }
}

export interface CandidateSelectionRecord {
  selectionRecordSchemaVersion: typeof PROTOCOL_V4_SELECTION_RECORD_SCHEMA_VERSION;
  masterPlanHash: string;
  developmentExecutionTreeHash: string;
  developmentArtifactHashes: Readonly<
    Record<
      ResolverV3047CandidateId,
      {
        checkpointHash: string;
        rawResultsHash: string;
        categoryTableHash: string;
        telemetryHash: string;
        ledgerHash: string;
        evaluationHash: string;
      }
    >
  >;
  developmentEvidenceRootHash: string;
  selectionRuleVersion: string;
  selectionRuleHash: string;
  evaluations: Readonly<Record<ResolverV3047CandidateId, CandidateEvaluation>>;
  eligibility: Readonly<Record<ResolverV3047CandidateId, boolean>>;
  candidateId: ResolverV3047CandidateId;
  tieBreakTrace: readonly string[];
  frozen: true;
  selectionRecordHash: string;
}

/** `selectCandidate()` must never be called with freely-constructed numbers: this is the only
 * supported entry point for producing a `CandidateSelectionRecord`, and it requires all three
 * candidates' full, artifact-validated Development evidence first. */
export function selectCandidateFromDevelopmentEvidence(
  plan: ProtocolV4MasterPlan,
  evidence: ProtocolV4DevelopmentEvidence,
): CandidateSelectionRecord {
  validateProtocolV4DevelopmentEvidence(plan, evidence);
  const developmentEvidenceRootHash = computeDevelopmentEvidenceRootHash(evidence);
  const evaluations = evidence.candidateEvaluationTable.content;
  const byId = Object.fromEntries(evaluations.map((e) => [e.candidateId, e])) as Record<
    ResolverV3047CandidateId,
    CandidateEvaluation
  >;
  const candidateId = selectCandidate(evaluations);
  const eligible = new Set(
    evaluations
      .filter(
        (e) =>
          e.allMandatoryG2CriteriaPass &&
          e.criticalFalseConfidenceCount === 0 &&
          e.contractsComplete,
      )
      .map((e) => e.candidateId),
  );
  const developmentArtifactHashes = Object.fromEntries(
    evidence.candidates.map((c) => [
      c.candidateId,
      {
        checkpointHash: c.checkpoint.contentHash,
        rawResultsHash: c.rawResults.contentHash,
        categoryTableHash: c.categoryTable.contentHash,
        telemetryHash: c.telemetry.contentHash,
        ledgerHash: c.ledger.contentHash,
        evaluationHash: c.evaluation.contentHash,
      },
    ]),
  ) as CandidateSelectionRecord['developmentArtifactHashes'];
  const withoutHash: Omit<CandidateSelectionRecord, 'selectionRecordHash'> = {
    selectionRecordSchemaVersion: PROTOCOL_V4_SELECTION_RECORD_SCHEMA_VERSION,
    masterPlanHash: plan.planHash,
    developmentExecutionTreeHash: plan.developmentExecutionTreeHash,
    developmentArtifactHashes,
    developmentEvidenceRootHash,
    selectionRuleVersion: SELECTION_RULE.version,
    selectionRuleHash: hashProtocolV4(SELECTION_RULE),
    evaluations: byId,
    eligibility: Object.fromEntries(
      (['H0', 'H1', 'H2'] as const).map((id) => [id, eligible.has(id)]),
    ) as Record<ResolverV3047CandidateId, boolean>,
    candidateId,
    tieBreakTrace: SELECTION_RULE.orderedComparison,
    frozen: true,
  };
  return { ...withoutHash, selectionRecordHash: hashProtocolV4(withoutHash) };
}

export function validateCandidateSelectionRecord(
  plan: ProtocolV4MasterPlan,
  record: CandidateSelectionRecord,
): void {
  const { selectionRecordHash, ...body } = record;
  if (hashProtocolV4(body) !== selectionRecordHash)
    throw new Error('PROTOCOL_V4_SELECTION_RECORD_HASH_MISMATCH');
  if (
    record.masterPlanHash !== plan.planHash ||
    record.developmentExecutionTreeHash !== plan.developmentExecutionTreeHash
  )
    throw new Error('PROTOCOL_V4_SELECTION_RECORD_PLAN_MISMATCH');
  if (!record.frozen) throw new Error('PROTOCOL_V4_SELECTION_RECORD_NOT_FROZEN');
  if (!record.eligibility[record.candidateId])
    throw new Error('PROTOCOL_V4_SELECTED_CANDIDATE_NOT_ELIGIBLE');
}

// -------------------------------------------------------------------------------------------------
// Part 4B: Holdout Execution Plan (derivable only after Development + a frozen selection)
// -------------------------------------------------------------------------------------------------

export interface HoldoutExecutionPlan {
  masterPlanHash: string;
  developmentEvidenceRootHash: string;
  candidateSelectionRecordHash: string;
  candidateId: ResolverV3047CandidateId;
  candidateIdentity: CandidateIdentity;
  holdoutObservations: readonly ProtocolV4Observation[];
  holdoutExecutionTreeHash: string;
  holdoutCalls: number;
  holdoutMaxTokens: number;
  holdoutMaxCostUsd: number;
  unusedArtifactTargets: readonly string[];
  noCachePolicy: ProtocolV4MasterPlan['noCachePolicy'];
  transportTimeoutMs: 15000;
  wallClockCeilingMs: 20000;
  holdoutPlanHash: string;
}

export function deriveHoldoutExecutionPlan(
  plan: ProtocolV4MasterPlan,
  developmentEvidenceRootHash: string,
  selection: CandidateSelectionRecord,
): HoldoutExecutionPlan {
  validateCandidateSelectionRecord(plan, selection);
  if (selection.developmentEvidenceRootHash !== developmentEvidenceRootHash)
    throw new Error('PROTOCOL_V4_HOLDOUT_EVIDENCE_ROOT_MISMATCH');
  const candidateIdentity = plan.candidates.find((c) => c.id === selection.candidateId);
  if (!candidateIdentity) throw new Error('PROTOCOL_V4_HOLDOUT_UNKNOWN_CANDIDATE');
  const holdoutObservations: ProtocolV4Observation[] = plan.holdoutTemplate.observations.map(
    (o) => ({
      ...o,
      candidateId: selection.candidateId,
    }),
  );
  const holdoutExecutionTreeHash = hashProtocolV4({
    candidateIdentity,
    holdoutObservations,
    selectionRuleVersion: SELECTION_RULE.version,
  });
  const perCallTokens = 8192 + 1536;
  const perCallCost =
    (8192 / 1e6) * plan.pricing.inputPerMillion + (1536 / 1e6) * plan.pricing.outputPerMillion;
  const holdoutCalls = holdoutObservations.length;
  const withoutHash: Omit<HoldoutExecutionPlan, 'holdoutPlanHash'> = {
    masterPlanHash: plan.planHash,
    developmentEvidenceRootHash,
    candidateSelectionRecordHash: selection.selectionRecordHash,
    candidateId: selection.candidateId,
    candidateIdentity,
    holdoutObservations,
    holdoutExecutionTreeHash,
    holdoutCalls,
    holdoutMaxTokens: holdoutCalls * perCallTokens,
    holdoutMaxCostUsd: holdoutCalls * perCallCost,
    unusedArtifactTargets: [
      ARTIFACT_PATHS.holdoutCheckpoint,
      ARTIFACT_PATHS.holdoutRawResults,
      ARTIFACT_PATHS.holdoutCategoryTable,
      ARTIFACT_PATHS.holdoutTelemetry,
      ARTIFACT_PATHS.holdoutLedger,
      ARTIFACT_PATHS.holdoutEvaluation,
    ],
    noCachePolicy: plan.noCachePolicy,
    transportTimeoutMs: 15000,
    wallClockCeilingMs: 20000,
  };
  return { ...withoutHash, holdoutPlanHash: hashProtocolV4(withoutHash) };
}

export function validateHoldoutExecutionPlan(
  plan: ProtocolV4MasterPlan,
  holdoutPlan: HoldoutExecutionPlan,
): void {
  const { holdoutPlanHash, ...body } = holdoutPlan;
  if (hashProtocolV4(body) !== holdoutPlanHash)
    throw new Error('PROTOCOL_V4_HOLDOUT_PLAN_HASH_MISMATCH');
  if (holdoutPlan.masterPlanHash !== plan.planHash)
    throw new Error('PROTOCOL_V4_HOLDOUT_PLAN_MASTER_MISMATCH');
}

// -------------------------------------------------------------------------------------------------
// Part 6: strict Human/Fake Holdout authorization
// -------------------------------------------------------------------------------------------------

export interface HoldoutAuthorizationRecord {
  authorizationSchemaVersion: typeof PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION;
  kind: 'fake_dry_run' | 'human_live';
  masterPlanHash: string;
  holdoutExecutionPlanHash: string;
  developmentEvidenceRootHash: string;
  candidateSelectionRecordHash: string;
  candidateId: ResolverV3047CandidateId;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  maxCostUsd: number;
  currency: 'USD';
  maxConcurrency: number;
  authorizedPhase: 'holdout';
  authorizationId: string;
  humanApprovalReference: string | null;
  consumed: boolean;
}

export function assertHoldoutAuthorized(input: {
  plan: ProtocolV4MasterPlan;
  holdoutPlan: HoldoutExecutionPlan;
  selection: CandidateSelectionRecord;
  authorization: HoldoutAuthorizationRecord;
  artifactTargetUnused: boolean;
  remainingCalls: number;
  remainingInputTokens: number;
  remainingOutputTokens: number;
  remainingCostUsd: number;
  /** The maximum a human has actually, separately approved -- authorization limits may never
   * exceed this ceiling even if the plan/budget would technically allow more. Optional so a
   * caller that has no separate ceiling (fake dry-run self-authorization) may omit it. */
  humanApprovedCeiling?: { maxCalls: number; maxTotalTokens: number; maxCostUsd: number };
  liveExecution: boolean;
}): void {
  const { plan, holdoutPlan, selection, authorization } = input;
  validateProtocolV4MasterPlan(plan);
  validateHoldoutExecutionPlan(plan, holdoutPlan);
  validateCandidateSelectionRecord(plan, selection);

  if (authorization.authorizationSchemaVersion !== PROTOCOL_V4_AUTHORIZATION_SCHEMA_VERSION)
    throw new Error('PROTOCOL_V4_AUTHORIZATION_SCHEMA_MISMATCH');
  if (
    authorization.masterPlanHash !== plan.planHash ||
    authorization.holdoutExecutionPlanHash !== holdoutPlan.holdoutPlanHash ||
    authorization.developmentEvidenceRootHash !== holdoutPlan.developmentEvidenceRootHash ||
    authorization.candidateSelectionRecordHash !== selection.selectionRecordHash ||
    authorization.candidateId !== holdoutPlan.candidateId
  )
    throw new Error('PROTOCOL_V4_HOLDOUT_IDENTITY_MISMATCH');
  if (authorization.authorizedPhase !== 'holdout')
    throw new Error('PROTOCOL_V4_AUTHORIZATION_PHASE_MISMATCH');
  if (authorization.currency !== 'USD')
    throw new Error('PROTOCOL_V4_AUTHORIZATION_CURRENCY_MISMATCH');
  if (authorization.consumed) throw new Error('PROTOCOL_V4_AUTHORIZATION_ALREADY_CONSUMED');
  if (!input.artifactTargetUnused) throw new Error('PROTOCOL_V4_HOLDOUT_ARTIFACT_TARGET_REUSED');

  if (
    authorization.maxCalls < holdoutPlan.holdoutCalls ||
    authorization.maxTotalTokens < holdoutPlan.holdoutMaxTokens ||
    authorization.maxCostUsd < holdoutPlan.holdoutMaxCostUsd
  )
    throw new Error('PROTOCOL_V4_AUTHORIZATION_LIMITS_INSUFFICIENT');

  if (input.humanApprovedCeiling) {
    if (
      authorization.maxCalls > input.humanApprovedCeiling.maxCalls ||
      authorization.maxTotalTokens > input.humanApprovedCeiling.maxTotalTokens ||
      authorization.maxCostUsd > input.humanApprovedCeiling.maxCostUsd
    )
      throw new Error('PROTOCOL_V4_AUTHORIZATION_EXCEEDS_HUMAN_CEILING');
  }

  if (
    input.remainingCalls < authorization.maxCalls ||
    input.remainingInputTokens < authorization.maxInputTokens ||
    input.remainingOutputTokens < authorization.maxOutputTokens ||
    input.remainingCostUsd < authorization.maxCostUsd
  )
    throw new Error('PROTOCOL_V4_HOLDOUT_BUDGET_INSUFFICIENT');

  if (authorization.kind === 'fake_dry_run' && input.liveExecution)
    throw new Error('PROTOCOL_V4_FAKE_AUTHORIZATION_CANNOT_LIVE');
  if (input.liveExecution) {
    if (authorization.kind !== 'human_live')
      throw new Error('PROTOCOL_V4_HUMAN_LIVE_AUTHORIZATION_REQUIRED');
    if (!authorization.humanApprovalReference)
      throw new Error('PROTOCOL_V4_HUMAN_APPROVAL_REFERENCE_REQUIRED');
  }
}
