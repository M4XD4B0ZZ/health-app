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
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH } from '../representativeHybridV1/RepresentativeHybridV1SourceSnapshotManifest';
import { REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT } from '../representativeHybridV1/live/RepresentativeHybridV1LiveVersions';
import type {
  RepresentativeHybridV1Partition,
  RepresentativeHybridV1ResolutionScenario,
} from '../representativeHybridV1/RepresentativeHybridV1Types';

export const PROTOCOL_V4_VERSION = 'resolver-v3-048-protocol-v4-phase-a-v1';
export const PROTOCOL_V4_EXECUTION_TREE_VERSION = 'resolver-v3-048-execution-tree-v1';
export const PROTOCOL_V4_CANDIDATE_SET_VERSION = 'resolver-v3-047-h0-h1-h2-v1';
export const PROTOCOL_V4_PRICING_VERSION = 'anthropic-haiku-4-5-usd-2026-07-22';
export const PROTOCOL_V4_EVALUATOR_VERSION = 'resolver-v3-042-corrected-g2-evaluator-v1';
export const PROTOCOL_V4_ARTIFACT_SCHEMA_VERSION = 'resolver-v3-048-artifacts-v1';
export const PROTOCOL_V4_DRY_RUN_ROOT = 'tmp/resolver-v3-048-protocol-v4-dry-run';
export const PROTOCOL_V4_LIVE_ROOT = 'logs/resolver-v3-048-protocol-v4';

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

export interface ProtocolV4Observation {
  scenarioId: string;
  partition: RepresentativeHybridV1Partition;
  category: string;
  difficulty: string;
  candidateId: ResolverV3047CandidateId;
  runIndex: number;
  expectedBehavior: string;
}
export interface ProtocolV4Plan {
  protocolVersion: typeof PROTOCOL_V4_VERSION;
  executionTreeVersion: typeof PROTOCOL_V4_EXECUTION_TREE_VERSION;
  executionTreeHash: string;
  corpus: { version: string; hash: string };
  groundTruth: { version: string; hash: string };
  sourceManifest: { version: string; hash: string };
  evaluator: { version: string; hash: string };
  candidateSetVersion: typeof PROTOCOL_V4_CANDIDATE_SET_VERSION;
  candidates: readonly CandidateIdentity[];
  contextPolicy: 'C0';
  modelId: 'claude-haiku-4-5-20251001';
  pricingVersion: typeof PROTOCOL_V4_PRICING_VERSION;
  transportTimeoutMs: 15000;
  wallClockCeilingMs: 20000;
  retryCount: 0;
  maxTokens: 1536;
  temperature: 0;
  partitions: { development: 'development'; holdout: 'holdout' };
  repetitionPolicy: 'corpus_overlay_v1';
  observations: readonly ProtocolV4Observation[];
  selectionRule: typeof SELECTION_RULE;
  g2Gates: readonly ['G2-A', 'G2-B', 'G2-C', 'G2-D', 'G2-E', 'G2-F', 'G2-G'];
  budget: ProtocolV4Budget;
  noCachePolicy: {
    promptCachingConfigured: false;
    positiveCacheTokensFailure: 'usage_cost_contract_error';
  };
  artifactPaths: typeof ARTIFACT_PATHS;
  planHash: string;
}
interface CandidateIdentity {
  id: ResolverV3047CandidateId;
  version: string;
  promptVersion: string;
  promptHash: string;
  schemaVersion: string;
  schemaHash: string;
  routingVersion: string;
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
  plan: 'protocol-v4-plan.json',
  planManifest: 'protocol-v4-plan-manifest.json',
  sourceManifest: 'source-manifest.json',
  candidateManifest: 'candidate-manifest.json',
  pricingManifest: 'pricing-manifest.json',
  developmentCheckpoint: 'development/checkpoint.json',
  developmentRawResults: 'development/raw-results.json',
  developmentCategoryTable: 'development/category-table.json',
  developmentTelemetry: 'development/telemetry.json',
  developmentLedger: 'development/ledger.json',
  developmentEvaluation: 'development/evaluation.json',
  candidateSelectionRecord: 'selection/candidate-selection-record.json',
  holdoutAuthorizationRecord: 'authorization/holdout-authorization-record.json',
  holdoutCheckpoint: 'holdout/checkpoint.json',
  holdoutRawResults: 'holdout/raw-results.json',
  holdoutCategoryTable: 'holdout/category-table.json',
  holdoutTelemetry: 'holdout/telemetry.json',
  holdoutLedger: 'holdout/ledger.json',
  holdoutEvaluation: 'holdout/evaluation.json',
  finalG2DecisionReport: 'final/g2-decision-report.json',
} as const;

const canonical = (value: unknown): string => JSON.stringify(sortDeep(value));
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
export const hashProtocolV4 = (value: unknown): string =>
  createHash('sha256').update(canonical(value)).digest('hex');

function resolutionScenarios(): RepresentativeHybridV1ResolutionScenario[] {
  return REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS.filter(
    (s): s is RepresentativeHybridV1ResolutionScenario =>
      s.scenarioType === 'resolution_decomposition',
  );
}
function repeatCount(s: RepresentativeHybridV1ResolutionScenario): number {
  return s.repeatOverlay ? 3 : 1;
}
function observations(): ProtocolV4Observation[] {
  return resolutionScenarios()
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

export function buildProtocolV4Plan(): ProtocolV4Plan {
  const candidates = RESOLVER_V3_047_CANDIDATES.map((c) => ({
    id: c.id,
    version: c.version,
    promptVersion: c.promptVersion,
    promptHash: hashProtocolV4(c.prompt),
    schemaVersion: c.schemaVersion,
    schemaHash: hashProtocolV4(c.schema),
    routingVersion: c.routingVersion,
  }));
  const obs = observations();
  const developmentCalls = obs.filter((o) => o.partition === 'development').length;
  const holdoutCalls = obs.filter(
    (o) => o.partition === 'holdout' && o.candidateId === 'H0',
  ).length;
  const perCallTokens = 8192 + 1536;
  const perCallCost =
    (8192 / 1e6) * REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.inputPerMillion +
    (1536 / 1e6) * REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.outputPerMillion;
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
  const executionTreeHash = hashProtocolV4({
    version: PROTOCOL_V4_EXECUTION_TREE_VERSION,
    candidates,
    observations: obs,
    selectionRule: SELECTION_RULE,
    automaticContinuation: false,
  });
  const withoutHash: Omit<ProtocolV4Plan, 'planHash'> = {
    protocolVersion: PROTOCOL_V4_VERSION,
    executionTreeVersion: PROTOCOL_V4_EXECUTION_TREE_VERSION,
    executionTreeHash,
    corpus: {
      version: REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
      hash: REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
    },
    groundTruth: {
      version: `${REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION}-ground-truth-v1`,
      hash: hashProtocolV4(resolutionScenarios().map((s) => ({ id: s.scenarioId, case: s.case }))),
    },
    sourceManifest: {
      version: 'representative-hybrid-v1-source-manifest-v1',
      hash: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
    },
    evaluator: {
      version: PROTOCOL_V4_EVALUATOR_VERSION,
      hash: hashProtocolV4({
        version: PROTOCOL_V4_EVALUATOR_VERSION,
        authority: 'RESOLVER-V3-042',
      }),
    },
    candidateSetVersion: PROTOCOL_V4_CANDIDATE_SET_VERSION,
    candidates,
    contextPolicy: 'C0' as const,
    modelId: 'claude-haiku-4-5-20251001' as const,
    pricingVersion: PROTOCOL_V4_PRICING_VERSION,
    transportTimeoutMs: 15000 as const,
    wallClockCeilingMs: 20000 as const,
    retryCount: 0 as const,
    maxTokens: 1536 as const,
    temperature: 0 as const,
    partitions: { development: 'development' as const, holdout: 'holdout' as const },
    repetitionPolicy: 'corpus_overlay_v1' as const,
    observations: obs,
    selectionRule: SELECTION_RULE,
    g2Gates: ['G2-A', 'G2-B', 'G2-C', 'G2-D', 'G2-E', 'G2-F', 'G2-G'] as const,
    budget,
    noCachePolicy: {
      promptCachingConfigured: false as const,
      positiveCacheTokensFailure: 'usage_cost_contract_error' as const,
    },
    artifactPaths: ARTIFACT_PATHS,
  };
  return { ...withoutHash, planHash: hashProtocolV4(withoutHash) };
}

export function validateProtocolV4Plan(plan: ProtocolV4Plan): void {
  const { planHash, ...body } = plan;
  if (!planHash || hashProtocolV4(body) !== planHash)
    throw new Error('PROTOCOL_V4_PLAN_HASH_MISMATCH');
  if (
    plan.executionTreeHash !==
    hashProtocolV4({
      version: plan.executionTreeVersion,
      candidates: plan.candidates,
      observations: plan.observations,
      selectionRule: plan.selectionRule,
      automaticContinuation: false,
    })
  )
    throw new Error('PROTOCOL_V4_EXECUTION_TREE_HASH_MISMATCH');
  if (
    plan.modelId !== 'claude-haiku-4-5-20251001' ||
    plan.retryCount !== 0 ||
    plan.noCachePolicy.promptCachingConfigured
  )
    throw new Error('PROTOCOL_V4_PINNED_CONFIGURATION_MISMATCH');
}

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
  plan: ProtocolV4Plan,
  partition: RepresentativeHybridV1Partition,
  candidateId: ResolverV3047CandidateId,
  rows: readonly CategoryEvidence[],
): void {
  const expected = plan.observations.filter(
    (o) => o.partition === partition && o.candidateId === candidateId,
  );
  const keys = new Set<string>();
  for (const row of rows) {
    const key = `${row.scenarioId}:${row.runIndex}`;
    if (keys.has(key)) throw new Error('PROTOCOL_V4_DUPLICATE_SCENARIO_RUN');
    keys.add(key);
    const frozen = expected.find(
      (o) => o.scenarioId === row.scenarioId && o.runIndex === row.runIndex,
    );
    if (!frozen) throw new Error('PROTOCOL_V4_UNKNOWN_SCENARIO_OR_REPETITION');
    if (row.planHash !== plan.planHash) throw new Error('PROTOCOL_V4_CATEGORY_PLAN_HASH_MISMATCH');
    if (row.candidateId !== candidateId) throw new Error('PROTOCOL_V4_MIXED_CANDIDATE');
    if (row.partition !== frozen.partition) throw new Error('PROTOCOL_V4_WRONG_PARTITION');
    if (row.category !== frozen.category)
      throw new Error('PROTOCOL_V4_UNKNOWN_OR_DERIVED_CATEGORY');
  }
  if (keys.size !== expected.length) throw new Error('PROTOCOL_V4_MISSING_SCENARIO_OR_REPETITION');
}

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

export function validateTerminalMetadata(meta: ProtocolV4TerminalMetadata): void {
  if (meta.runIdentity.protocolVersion !== PROTOCOL_V4_VERSION)
    throw new Error('PROTOCOL_V4_RUN_IDENTITY_REQUIRED');
  if (meta.usageStatus === 'reported' && (meta.inputTokens === null || meta.outputTokens === null))
    throw new Error('PROTOCOL_V4_REPORTED_USAGE_TOKENS_REQUIRED');
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
    'actualCostUsd',
    'failureKind',
  ] as const)
    if (canonical(telemetry[key]) !== canonical(ledger[key]))
      throw new Error(`PROTOCOL_V4_TELEMETRY_LEDGER_MISMATCH:${key}`);
}

export interface CandidateSelectionRecord {
  planHash: string;
  executionTreeHash: string;
  candidateId: ResolverV3047CandidateId;
  developmentComplete: true;
  frozen: true;
}
export interface HoldoutAuthorizationRecord {
  kind: 'fake_dry_run' | 'human_live';
  planHash: string;
  candidateId: ResolverV3047CandidateId;
  maxCalls: number;
  maxTokens: number;
  maxCostUsd: number;
  currency: 'USD';
}
export function assertHoldoutAuthorized(input: {
  plan: ProtocolV4Plan;
  developmentCheckpoint: boolean;
  developmentEvaluation: boolean;
  selection: CandidateSelectionRecord | null;
  authorization: HoldoutAuthorizationRecord | null;
  artifactTargetUnused: boolean;
  remainingCalls: number;
  remainingTokens: number;
  remainingCostUsd: number;
  executionTreeHash: string;
  corpusHash: string;
  groundTruthHash: string;
  sourceManifestHash: string;
  evaluatorHash: string;
  liveExecution: boolean;
}): void {
  const { plan } = input;
  validateProtocolV4Plan(plan);
  if (
    !input.developmentCheckpoint ||
    !input.developmentEvaluation ||
    !input.selection ||
    !input.authorization ||
    !input.artifactTargetUnused
  )
    throw new Error('PROTOCOL_V4_HOLDOUT_PREREQUISITE_MISSING');
  if (
    input.selection.planHash !== plan.planHash ||
    input.selection.executionTreeHash !== plan.executionTreeHash ||
    input.authorization.planHash !== plan.planHash ||
    input.authorization.candidateId !== input.selection.candidateId ||
    input.executionTreeHash !== plan.executionTreeHash ||
    input.corpusHash !== plan.corpus.hash ||
    input.groundTruthHash !== plan.groundTruth.hash ||
    input.sourceManifestHash !== plan.sourceManifest.hash ||
    input.evaluatorHash !== plan.evaluator.hash
  )
    throw new Error('PROTOCOL_V4_HOLDOUT_IDENTITY_MISMATCH');
  if (input.liveExecution && input.authorization.kind !== 'human_live')
    throw new Error('PROTOCOL_V4_HUMAN_LIVE_AUTHORIZATION_REQUIRED');
  if (
    input.remainingCalls < plan.budget.holdoutCalls ||
    input.remainingTokens < plan.budget.holdoutMaxTokens ||
    input.remainingCostUsd < plan.budget.holdoutMaxCostUsd
  )
    throw new Error('PROTOCOL_V4_HOLDOUT_BUDGET_INSUFFICIENT');
}
