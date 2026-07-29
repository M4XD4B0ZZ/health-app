import {
  canonicalizeProtocolV4,
  hashProtocolV4,
  protocolV4ScenarioByScenarioId,
  validateCandidateEvaluation,
  validateCategoryEvidence,
  validateProtocolV4Artifact,
  validateProtocolV4DevelopmentEvidence,
  validateTerminalMetadata,
  assertTelemetryLedgerParity,
  PROTOCOL_V4_G2_GATES,
  PROTOCOL_V4_EVALUATOR_VERSION,
  type CandidateEvaluation,
  type CategoryEvidence,
  type ProtocolV4DevelopmentCandidateArtifacts,
  type ProtocolV4DevelopmentEvidence,
  type ProtocolV4G2Gate,
  type ProtocolV4GateVerdict,
  type ProtocolV4MasterPlan,
  type ProtocolV4Observation,
  type ProtocolV4TerminalMetadata,
  type ResolverV3047CandidateId,
} from './ResolverV3048ProtocolV4';
import {
  validateProtocolV4DryRunCandidateChoice,
  validateProtocolV4DryRunHoldoutExecutionPlan,
  type ProtocolV4DryRunCandidateChoice,
  type ProtocolV4DryRunHoldoutAuthorization,
  type ProtocolV4DryRunHoldoutExecutionPlan,
} from './ResolverV3048ProtocolV4DryRunChoice';
import { computeProtocolV4EvaluatorManifestHash } from './ResolverV3048ProtocolV4EvaluatorHash';
import {
  assembleProtocolV4LiveCaseRecord,
  buildProtocolV4LiveProviderUsageRecord,
  buildProtocolV4RealCandidateReport,
  computeProtocolV4RealArmBaseline,
  judgeProtocolV4VariantCObservation,
  mapProtocolV4GateVerdicts,
  type ProtocolV4RealArmBaseline,
} from './ResolverV3048ProtocolV4RealEvaluator';
import type { RepresentativeHybridV1LiveCObservation } from '../representativeHybridV1/live/RepresentativeHybridV1LiveRunner';
import type { VariantCRawCaseResult } from '../VariantCTypes';

/**
 * RESOLVER-V3-048 Final Phase-A Execution Closure remediation -- "Wire the real pinned G2 evaluator
 * into the evaluation adapter" (Teil 8 continued).
 *
 * The prior version of this module computed G2 gate verdicts from a benchmark-local structural
 * approximation over `CategoryEvidence` rows -- a documented but ultimately insufficient scope
 * decision. This version executes the REAL, UNMODIFIED evaluator
 * (`RepresentativeHybridV1LiveMetrics.ts`/`RepresentativeHybridV1LiveReportBuilder.ts`, via
 * `ResolverV3048ProtocolV4RealEvaluator.ts`) over real judged case records: real, zero-network,
 * deterministic Variant A (BLS-only), the real `NoopVariantBProvider` (honestly `unavailable`), and
 * each candidate's own executed `VariantCRawCaseResult`s judged against real corpus ground truth via
 * `evaluateVariantCCase` (unmodified). `evaluateVariantCCase` and the Variant A/B baseline are pure,
 * deterministic functions of (real corpus scenario, stored raw result) -- so the validator below can
 * re-derive the entire evaluation from nothing but the sealed `rawResults`/`telemetry`/`ledger`
 * artifacts and the always-available real corpus, without re-executing any dispatch.
 */

export class ProtocolV4EvaluationDerivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4EvaluationDerivationError';
  }
}

export interface ProtocolV4DerivedCandidateEvaluation {
  candidateId: ResolverV3047CandidateId;
  evaluatorVersion: string;
  evaluatorAlgorithmHash: string;
  inputArtifactHashes: {
    categoryTableHash: string;
    telemetryHash: string;
    ledgerHash: string;
    rawResultsHash: string;
  };
  evaluation: CandidateEvaluation;
  evaluationHash: string;
}

/** One AI-dispatched Development raw result, explicitly tagged with the observation it belongs to --
 * `evaluateVariantCCase`/the real Variant A/B baseline are both pure functions of (real corpus
 * scenario, stored raw result), so this is everything needed to re-derive the full judged evaluation
 * without re-executing any dispatch. */
export interface ProtocolV4RawObservationResult {
  status: 'ai_dispatched';
  scenarioId: string;
  runIndex: number;
  raw: VariantCRawCaseResult;
}
export interface ProtocolV4FastPathObservationResult {
  status: 'fast_path_no_call';
  scenarioId: string;
  runIndex: number;
}
export type ProtocolV4ObservationResult =
  | ProtocolV4RawObservationResult
  | ProtocolV4FastPathObservationResult;

function isAiDispatchedResult(r: unknown): r is ProtocolV4RawObservationResult {
  return !!r && typeof r === 'object' && (r as { status?: unknown }).status === 'ai_dispatched';
}

/** Builds the real `RepresentativeHybridV1LiveCaseRecord[]` (grouping AI-dispatched raw results by
 * scenario, pairing each with the shared, candidate-independent Variant A/B baseline) and the real
 * `LiveProviderUsageRecord[]` telemetry projection -- purely from sealed artifacts plus the
 * always-available real corpus, never from a second independently-invented projection.
 *
 * `partition` is a required, explicit input (Final Phase-A closure remediation: previously
 * `assembleProtocolV4LiveCaseRecord` hard-coded `'development'`, so Holdout evidence was silently
 * mislabeled and evaluated through the Development path). The returned `caseRecords` carry the real
 * partition on every record; callers route them into `developmentCaseRecords`/`holdoutCaseRecords`
 * accordingly (see `deriveProtocolV4CandidateEvaluation`/`deriveProtocolV4FinalG2Report` below). */
function buildRealEvidenceForCandidate(input: {
  candidateId: ResolverV3047CandidateId;
  partition: 'development' | 'holdout';
  rawResults: readonly ProtocolV4ObservationResult[];
  telemetry: readonly ProtocolV4TerminalMetadata[];
  armBaseline: ProtocolV4RealArmBaseline;
}) {
  const scenarios = protocolV4ScenarioByScenarioId();
  const byScenario = new Map<string, RepresentativeHybridV1LiveCObservation[]>();
  for (const r of input.rawResults) {
    if (!isAiDispatchedResult(r)) continue;
    const scenario = scenarios.get(r.scenarioId);
    if (!scenario)
      throw new ProtocolV4EvaluationDerivationError(
        `PROTOCOL_V4_EVALUATION_UNKNOWN_SCENARIO:${r.scenarioId}`,
      );
    const evaluation = judgeProtocolV4VariantCObservation(scenario.case, r.raw);
    const list = byScenario.get(r.scenarioId) ?? [];
    list.push({
      runIndex: r.runIndex,
      kind: r.runIndex === 0 ? 'primary' : 'consistency',
      raw: r.raw,
      evaluation,
    });
    byScenario.set(r.scenarioId, list);
  }
  const caseRecords = Array.from(byScenario.entries()).map(([scenarioId, variantC]) => {
    const baseline = input.armBaseline.get(scenarioId);
    if (!baseline)
      throw new ProtocolV4EvaluationDerivationError(
        `PROTOCOL_V4_EVALUATION_MISSING_ARM_BASELINE:${scenarioId}`,
      );
    const scenario = scenarios.get(scenarioId);
    return assembleProtocolV4LiveCaseRecord({
      scenarioId,
      partition: input.partition,
      isOverlay: scenario?.repeatOverlay !== undefined,
      baseline,
      variantC: variantC.sort((a, b) => a.runIndex - b.runIndex),
    });
  });
  const rawTelemetry = input.telemetry.map((t, i) => buildProtocolV4LiveProviderUsageRecord(t, i));
  const expectedBehaviorByScenarioId = new Map<string, string>();
  const categoryByScenarioId = new Map<string, string>();
  for (const [scenarioId, scenario] of scenarios) {
    expectedBehaviorByScenarioId.set(scenarioId, scenario.case.expectedBehavior);
    categoryByScenarioId.set(scenarioId, scenario.case.category);
  }
  return {
    caseRecords,
    rawTelemetry,
    expectedBehaviorByScenarioId,
    categoryByScenarioId,
  };
}

/** Precomputes the candidate-independent real Variant A/B baseline for every Development scenario --
 * call ONCE per Development run (never per candidate) and pass the result to every candidate's
 * derivation, so all three H-candidates are judged against the identical real baseline. */
export async function computeProtocolV4DevelopmentArmBaseline(
  plan: ProtocolV4MasterPlan,
): Promise<ProtocolV4RealArmBaseline> {
  const scenarios = protocolV4ScenarioByScenarioId();
  const developmentScenarioIds = new Set(
    plan.developmentObservations
      .filter((o) => o.partition === 'development')
      .map((o) => o.scenarioId),
  );
  const relevant = Array.from(developmentScenarioIds)
    .map((id) => scenarios.get(id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map((s) => ({ scenarioId: s.scenarioId, case: s.case }));
  return computeProtocolV4RealArmBaseline(relevant);
}

/** Holdout counterpart of `computeProtocolV4DevelopmentArmBaseline` -- the real Variant A/B baseline
 * for exactly the scenarios in the (candidate-bound) Holdout Execution Plan, computed once per
 * Holdout run. Holdout scenarios are disjoint in general from Development's, so this is intentionally
 * a separate baseline, never a subset/reuse of the Development one.
 *
 * Accepts a minimal structural shape (`holdoutObservations` only) so both the real, authoritative
 * `HoldoutExecutionPlan` and the separate, non-authoritative `ProtocolV4DryRunHoldoutExecutionPlan`
 * (`ResolverV3048ProtocolV4DryRunChoice.ts`) satisfy it without this function needing to know or care
 * which one produced the plan it was given. */
export async function computeProtocolV4HoldoutArmBaseline(holdoutPlan: {
  holdoutObservations: readonly ProtocolV4Observation[];
}): Promise<ProtocolV4RealArmBaseline> {
  const scenarios = protocolV4ScenarioByScenarioId();
  const holdoutScenarioIds = new Set(holdoutPlan.holdoutObservations.map((o) => o.scenarioId));
  const relevant = Array.from(holdoutScenarioIds)
    .map((id) => scenarios.get(id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map((s) => ({ scenarioId: s.scenarioId, case: s.case }));
  return computeProtocolV4RealArmBaseline(relevant);
}

/** The only supported entry point for producing a `CandidateEvaluation`: executes the real, pinned
 * G2 evaluator over real judged case records built from sealed artifacts -- never a free-form input,
 * never a benchmark-local structural approximation. */
export function deriveProtocolV4CandidateEvaluation(input: {
  plan: ProtocolV4MasterPlan;
  candidateId: ResolverV3047CandidateId;
  /** Which real partition this observation set belongs to -- required, never defaulted (Final
   * Phase-A closure remediation: a prior version always routed records into the Development bucket
   * regardless of what actually ran, which is exactly the "Holdout evaluated as Development" defect).
   * Defaults to `'development'` only for backward compatibility with the Development Runner's own
   * pre-existing call sites, all of which explicitly pass it anyway. */
  partition?: 'development' | 'holdout';
  categoryTableContentHash: string;
  telemetryContentHash: string;
  ledgerContentHash: string;
  rawResultsContentHash: string;
  categoryRows: readonly CategoryEvidence[];
  telemetry: readonly ProtocolV4TerminalMetadata[];
  ledger: readonly ProtocolV4TerminalMetadata[];
  rawResults: readonly ProtocolV4ObservationResult[];
  armBaseline: ProtocolV4RealArmBaseline;
  repoRoot?: string;
  /** Override for the expected observation set this evaluation is checked against. Defaults to the
   * Master Plan's own Development observations for this candidate; the Holdout Runner passes the
   * (candidate-bound) Holdout Execution Plan's `holdoutObservations` instead, since Holdout scenarios
   * are never enumerated in `plan.developmentObservations`. */
  expectedObservations?: readonly ProtocolV4Observation[];
}): ProtocolV4DerivedCandidateEvaluation {
  const partitionKind = input.partition ?? 'development';
  const expected =
    input.expectedObservations ??
    input.plan.developmentObservations.filter(
      (o) => o.partition === 'development' && o.candidateId === input.candidateId,
    );
  validateCategoryEvidence(expected, input.plan.planHash, input.candidateId, input.categoryRows);
  if (input.telemetry.length !== input.ledger.length)
    throw new ProtocolV4EvaluationDerivationError(
      'PROTOCOL_V4_EVALUATION_TELEMETRY_LEDGER_LENGTH_MISMATCH',
    );
  input.telemetry.forEach((t, i) => {
    validateTerminalMetadata(t);
    assertTelemetryLedgerParity(t, input.ledger[i]);
  });

  const { caseRecords, rawTelemetry, expectedBehaviorByScenarioId, categoryByScenarioId } =
    buildRealEvidenceForCandidate({
      candidateId: input.candidateId,
      partition: partitionKind,
      rawResults: input.rawResults,
      telemetry: input.telemetry,
      armBaseline: input.armBaseline,
    });

  const report = buildProtocolV4RealCandidateReport({
    planHash: input.plan.planHash,
    developmentCaseRecords: partitionKind === 'development' ? caseRecords : null,
    holdoutCaseRecords: partitionKind === 'holdout' ? caseRecords : null,
    rawTelemetry,
    expectedBehaviorByScenarioId,
    categoryByScenarioId,
  });
  const partitionReport = partitionKind === 'development' ? report.development : report.holdout;
  if (!partitionReport)
    throw new ProtocolV4EvaluationDerivationError(
      `PROTOCOL_V4_EVALUATION_NO_${partitionKind.toUpperCase()}_REPORT`,
    );
  const partition = partitionReport;

  const g2Results = mapProtocolV4GateVerdicts(report.gateVerdicts);
  const allMandatoryG2CriteriaPass = PROTOCOL_V4_G2_GATES.every((g) => g2Results[g] === 'passed');

  const criticalFalseConfidenceCount = input.categoryRows.filter((r) => r.criticalError).length;
  const failedRows = input.categoryRows.filter(
    (r) => r.failureKind !== null && r.failureKind !== undefined,
  ).length;
  const failureRate = input.categoryRows.length > 0 ? failedRows / input.categoryRows.length : 0;

  const completedLedger = input.ledger.filter((t) => t.actualCostStatus === 'computed');
  const totalCostUsd = completedLedger.reduce((sum, t) => sum + (t.actualCostUsd ?? 0), 0);
  const costPerValidatedLogUsd =
    completedLedger.length > 0 ? totalCostUsd / completedLedger.length : 0;

  const aiCalls = input.ledger.reduce((sum, t) => sum + (t.counts.aiDispatches.value ?? 0), 0);
  const sourceCalls = input.ledger.reduce(
    (sum, t) =>
      sum +
      (t.counts.blsCalls.value ?? 0) +
      (t.counts.offCalls.value ?? 0) +
      (t.counts.usdaCalls.value ?? 0),
    0,
  );

  // Repeat consistency, derived from the real, judged per-scenario outcomes the report itself used
  // (`consistency`), falling back to 1 (vacuously consistent) when no overlay scenarios exist.
  const repeatConsistency =
    report.consistency?.variantCOutcomeAgreementRate ??
    report.consistency?.variantCIdentificationAgreementRate ??
    1;

  const contractsComplete =
    input.categoryRows.length === expected.length &&
    input.telemetry.every((t) => {
      try {
        validateTerminalMetadata(t);
        return true;
      } catch {
        return false;
      }
    });

  const evaluation: CandidateEvaluation = {
    candidateId: input.candidateId,
    allMandatoryG2CriteriaPass,
    criticalFalseConfidenceCount,
    contractsComplete,
    identificationQuality: partition.quality.variantC.identificationMatchRate ?? 0,
    complexComponentQuality: partition.quality.variantC.expectedBehaviorMatchRate ?? 0,
    clarificationAbstentionQuality: partition.friction.correctClarificationRate ?? 1,
    repeatConsistency,
    costPerValidatedLogUsd,
    p50Ms: partition.latency.allAttempts.p50Ms ?? 0,
    p95Ms: partition.latency.allAttempts.p95Ms ?? 0,
    failureRate,
    aiCalls,
    sourceCalls,
    g2Results,
  };
  validateCandidateEvaluation(evaluation);

  const evaluatorAlgorithmHash = computeProtocolV4EvaluatorManifestHash(
    input.repoRoot ?? process.cwd(),
  );
  const inputArtifactHashes = {
    categoryTableHash: input.categoryTableContentHash,
    telemetryHash: input.telemetryContentHash,
    ledgerHash: input.ledgerContentHash,
    rawResultsHash: input.rawResultsContentHash,
  };
  const withoutHash: Omit<ProtocolV4DerivedCandidateEvaluation, 'evaluationHash'> = {
    candidateId: input.candidateId,
    evaluatorVersion: PROTOCOL_V4_EVALUATOR_VERSION,
    evaluatorAlgorithmHash,
    inputArtifactHashes,
    evaluation,
  };
  return { ...withoutHash, evaluationHash: hashProtocolV4(withoutHash) };
}

/** Recomputes the evaluation from the same inputs and requires exact equality -- the concrete
 * "Validator berechnet die Evaluation erneut und verlangt Gleichheit" requirement. Because
 * `deriveProtocolV4CandidateEvaluation` is a pure function of its inputs (the real corpus is always
 * available; Variant A/B/C judging is deterministic), any drift (a different artifact, a different
 * evaluator file) produces a different `evaluationHash`. */
export function validateDerivedProtocolV4CandidateEvaluation(
  input: Parameters<typeof deriveProtocolV4CandidateEvaluation>[0],
  claimed: ProtocolV4DerivedCandidateEvaluation,
): void {
  const recomputed = deriveProtocolV4CandidateEvaluation(input);
  if (recomputed.evaluationHash !== claimed.evaluationHash)
    throw new ProtocolV4EvaluationDerivationError('PROTOCOL_V4_EVALUATION_RECOMPUTATION_MISMATCH');
}

/** Full Development Evidence validation PLUS evaluation re-derivation (Teil 9: "neu berechnete
 * Evaluation" / "Evaluatoridentität"). Runs the base structural/coverage validator first
 * (`validateProtocolV4DevelopmentEvidence`), then, for every candidate, independently re-derives the
 * `CandidateEvaluation` -- via the real pinned G2 evaluator -- from that candidate's own sealed
 * category/telemetry/ledger/raw-results artifacts and requires canonical equality with the stored
 * evaluation artifact's content -- a sealed evaluation that does not match what the real evaluator
 * would compute from the same artifacts is rejected, even if its own artifact hash is internally
 * self-consistent. */
export async function validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation(
  plan: ProtocolV4MasterPlan,
  evidence: ProtocolV4DevelopmentEvidence,
  repoRoot?: string,
): Promise<void> {
  validateProtocolV4DevelopmentEvidence(plan, evidence);
  const armBaseline = await computeProtocolV4DevelopmentArmBaseline(plan);
  for (const c of evidence.candidates) {
    const recomputed = deriveProtocolV4CandidateEvaluation({
      plan,
      candidateId: c.candidateId,
      partition: 'development',
      categoryTableContentHash: c.categoryTable.contentHash,
      telemetryContentHash: c.telemetry.contentHash,
      ledgerContentHash: c.ledger.contentHash,
      rawResultsContentHash: c.rawResults.contentHash,
      categoryRows: c.categoryTable.content,
      telemetry: c.telemetry.content,
      ledger: c.ledger.content,
      rawResults: (c.rawResults.content as { results: readonly ProtocolV4ObservationResult[] })
        .results,
      armBaseline,
      repoRoot,
    });
    if (
      canonicalizeProtocolV4(recomputed.evaluation) !== canonicalizeProtocolV4(c.evaluation.content)
    )
      throw new ProtocolV4EvaluationDerivationError(
        `PROTOCOL_V4_DEVELOPMENT_EVIDENCE_EVALUATION_NOT_DERIVED:${c.candidateId}`,
      );
  }
}

// -------------------------------------------------------------------------------------------------
// Final combined Development+Holdout G2 report (RESOLVER-V3-048 Final Dispatch-Lease,
// Authorization-Binding and G2-Evidence Closure remediation).
//
// The previously-merged `deriveProtocolV4FinalG2Report` only checked that the outer
// `development.candidateId`/`holdout.candidateId` strings matched the requested candidate -- it read
// `rawResults`/`telemetry`/`categoryTable`/`ledger`/`evaluation` content DIRECTLY off the artifacts it
// was handed, never recomputing or re-checking a single content hash, never re-running
// `validateCategoryEvidence`/`validateTerminalMetadata`/`assertTelemetryLedgerParity` on them, and
// never checking coverage against the plan's/Holdout plan's own expected observation set. A caller
// (or a compromised/buggy upstream step) that mutated a sealed artifact's `.content` in place after
// sealing -- while its `.contentHash` field still read the pre-tamper value -- was accepted without
// complaint, as long as the outer `candidateId` still matched (proven directly by this task's red
// baseline, item 17/18). `revalidateProtocolV4CandidatePartitionArtifacts` below closes this: BEFORE
// any evaluator call, it independently re-derives every artifact's content hash from its OWN
// `.content`, requires exact equality with the artifact's own `.contentHash` (and, transitively, with
// whatever hash a caller intends to trust downstream), re-validates category-evidence coverage
// against the real expected observation set (no missing/extra scenario-run), re-validates
// telemetry/ledger internal coherence and parity, and independently RE-DERIVES the whole
// `CandidateEvaluation` from those now-proven-genuine artifacts and requires it to equal the sealed
// evaluation artifact's own content -- closing the "Content Hash blind übernehmen" and "Evaluation-
// Rekomputation" requirements for BOTH partitions before they are ever combined.
// -------------------------------------------------------------------------------------------------

const DEVELOPMENT_ARTIFACT_NAME_PREFIX = 'development';
const HOLDOUT_ARTIFACT_NAME_PREFIX = 'holdout';

/** Independently re-validates one partition's full sealed candidate artifact set against the plan
 * and the real, expected observation set for that partition -- never trusting any content hash or
 * count the artifacts merely claim about themselves. Throws on the first mismatch. Returns nothing;
 * callers re-read `.content`/`.contentHash` off the (now proven genuine) artifacts afterward. */
function revalidateProtocolV4CandidatePartitionArtifacts(input: {
  plan: ProtocolV4MasterPlan;
  candidateId: ResolverV3047CandidateId;
  partition: 'development' | 'holdout';
  expectedObservations: readonly ProtocolV4Observation[];
  artifacts: ProtocolV4DevelopmentCandidateArtifacts;
  armBaseline: ProtocolV4RealArmBaseline;
  repoRoot?: string;
}): void {
  const { plan, candidateId, partition, expectedObservations, artifacts } = input;
  if (artifacts.candidateId !== candidateId)
    throw new ProtocolV4EvaluationDerivationError(
      `PROTOCOL_V4_FINAL_G2_ARTIFACT_CANDIDATE_MISMATCH:${partition}`,
    );
  const prefix =
    partition === 'development' ? DEVELOPMENT_ARTIFACT_NAME_PREFIX : HOLDOUT_ARTIFACT_NAME_PREFIX;
  // Artifact Type + Content Hash: `validateProtocolV4Artifact` recomputes `hashProtocolV4(content)`
  // from the artifact's OWN `.content` and requires it match the artifact's OWN `.contentHash` (never
  // a caller-supplied expectation) -- a tampered `.content` with a stale `.contentHash` is rejected
  // right here, before anything downstream ever reads it.
  validateProtocolV4Artifact(
    artifacts.checkpoint,
    `${prefix}-checkpoint-${candidateId}`,
    plan.planHash,
  );
  validateProtocolV4Artifact(
    artifacts.rawResults,
    `${prefix}-raw-results-${candidateId}`,
    plan.planHash,
  );
  validateProtocolV4Artifact(
    artifacts.categoryTable,
    `${prefix}-category-table-${candidateId}`,
    plan.planHash,
  );
  validateProtocolV4Artifact(
    artifacts.telemetry,
    `${prefix}-telemetry-${candidateId}`,
    plan.planHash,
  );
  validateProtocolV4Artifact(artifacts.ledger, `${prefix}-ledger-${candidateId}`, plan.planHash);
  validateProtocolV4Artifact(
    artifacts.evaluation,
    `${prefix}-evaluation-${candidateId}`,
    plan.planHash,
  );

  // Raw-Result-Coverage + Category Table + expected Scenario-/Run-Tupel: exactly the plan's/Holdout
  // plan's own expected observations, no more, no fewer, no wrong partition/category/candidate.
  validateCategoryEvidence(
    expectedObservations,
    plan.planHash,
    candidateId,
    artifacts.categoryTable.content,
  );
  const rawResultsContent = artifacts.rawResults.content as {
    candidateId: ResolverV3047CandidateId;
    results: readonly ProtocolV4ObservationResult[];
  };
  if (rawResultsContent.candidateId !== candidateId)
    throw new ProtocolV4EvaluationDerivationError(
      `PROTOCOL_V4_FINAL_G2_RAW_RESULTS_CANDIDATE_MISMATCH:${partition}`,
    );
  const rawResultKeys = new Set(
    rawResultsContent.results.map((r) => `${r.scenarioId}:${r.runIndex}`),
  );
  const expectedKeys = new Set(expectedObservations.map((o) => `${o.scenarioId}:${o.runIndex}`));
  if (
    rawResultKeys.size !== expectedKeys.size ||
    [...expectedKeys].some((k) => !rawResultKeys.has(k))
  )
    throw new ProtocolV4EvaluationDerivationError(
      `PROTOCOL_V4_FINAL_G2_RAW_RESULTS_COVERAGE_MISMATCH:${partition}`,
    );

  // Telemetry + Ledger + Parity: every record individually coherent, and telemetry/ledger pairwise
  // identical -- never merely counted.
  if (artifacts.telemetry.content.length !== artifacts.ledger.content.length)
    throw new ProtocolV4EvaluationDerivationError(
      `PROTOCOL_V4_FINAL_G2_TELEMETRY_LEDGER_LENGTH_MISMATCH:${partition}`,
    );
  artifacts.telemetry.content.forEach((t, i) => {
    validateTerminalMetadata(t);
    assertTelemetryLedgerParity(t, artifacts.ledger.content[i]);
  });

  // Evaluation: coherence, then full re-derivation and exact-equality comparison against the sealed
  // evaluation artifact's own content -- never accepted as given.
  validateCandidateEvaluation(artifacts.evaluation.content);
  const recomputed = deriveProtocolV4CandidateEvaluation({
    plan,
    candidateId,
    partition,
    categoryTableContentHash: artifacts.categoryTable.contentHash,
    telemetryContentHash: artifacts.telemetry.contentHash,
    ledgerContentHash: artifacts.ledger.contentHash,
    rawResultsContentHash: artifacts.rawResults.contentHash,
    categoryRows: artifacts.categoryTable.content,
    telemetry: artifacts.telemetry.content,
    ledger: artifacts.ledger.content,
    rawResults: rawResultsContent.results,
    armBaseline: input.armBaseline,
    repoRoot: input.repoRoot,
    expectedObservations,
  });
  if (
    canonicalizeProtocolV4(recomputed.evaluation) !==
    canonicalizeProtocolV4(artifacts.evaluation.content)
  )
    throw new ProtocolV4EvaluationDerivationError(
      `PROTOCOL_V4_FINAL_G2_EVALUATION_NOT_DERIVED:${partition}`,
    );
}

/** Shared core: independently revalidates BOTH partitions (never one alone, never a caller-supplied
 * content hash blindly trusted), then combines the now-proven-genuine evidence through the real,
 * unmodified evaluator TOGETHER -- the only place joint-only mandatory G2 gates can genuinely resolve
 * beyond `not_evaluable`/`requires_human_judgment`, because it is the only place both partitions' real
 * case records are ever passed to `buildRepresentativeHybridV1LiveReport` together. Every artifact
 * hash placed in the returned report is read off the artifacts AFTER this revalidation, never before. */
function deriveProtocolV4JointG2Verdict(input: {
  plan: ProtocolV4MasterPlan;
  candidateId: ResolverV3047CandidateId;
  development: ProtocolV4DevelopmentCandidateArtifacts;
  holdout: ProtocolV4DevelopmentCandidateArtifacts;
  developmentExpectedObservations: readonly ProtocolV4Observation[];
  holdoutExpectedObservations: readonly ProtocolV4Observation[];
  developmentArmBaseline: ProtocolV4RealArmBaseline;
  holdoutArmBaseline: ProtocolV4RealArmBaseline;
  repoRoot?: string;
}): {
  evaluatorAlgorithmHash: string;
  developmentArtifactHashes: {
    categoryTableHash: string;
    telemetryHash: string;
    ledgerHash: string;
    rawResultsHash: string;
  };
  holdoutArtifactHashes: {
    categoryTableHash: string;
    telemetryHash: string;
    ledgerHash: string;
    rawResultsHash: string;
  };
  g2Results: Readonly<Record<ProtocolV4G2Gate, ProtocolV4GateVerdict>>;
  allMandatoryG2CriteriaPass: boolean;
} {
  if (
    input.development.candidateId !== input.candidateId ||
    input.holdout.candidateId !== input.candidateId
  )
    throw new ProtocolV4EvaluationDerivationError('PROTOCOL_V4_FINAL_G2_CANDIDATE_MISMATCH');

  revalidateProtocolV4CandidatePartitionArtifacts({
    plan: input.plan,
    candidateId: input.candidateId,
    partition: 'development',
    expectedObservations: input.developmentExpectedObservations,
    artifacts: input.development,
    armBaseline: input.developmentArmBaseline,
    repoRoot: input.repoRoot,
  });
  revalidateProtocolV4CandidatePartitionArtifacts({
    plan: input.plan,
    candidateId: input.candidateId,
    partition: 'holdout',
    expectedObservations: input.holdoutExpectedObservations,
    artifacts: input.holdout,
    armBaseline: input.holdoutArmBaseline,
    repoRoot: input.repoRoot,
  });

  const developmentRawResults = (
    input.development.rawResults.content as { results: readonly ProtocolV4ObservationResult[] }
  ).results;
  const holdoutRawResults = (
    input.holdout.rawResults.content as { results: readonly ProtocolV4ObservationResult[] }
  ).results;

  const developmentEvidence = buildRealEvidenceForCandidate({
    candidateId: input.candidateId,
    partition: 'development',
    rawResults: developmentRawResults,
    telemetry: input.development.telemetry.content,
    armBaseline: input.developmentArmBaseline,
  });
  const holdoutEvidence = buildRealEvidenceForCandidate({
    candidateId: input.candidateId,
    partition: 'holdout',
    rawResults: holdoutRawResults,
    telemetry: input.holdout.telemetry.content,
    armBaseline: input.holdoutArmBaseline,
  });

  const expectedBehaviorByScenarioId = new Map([
    ...developmentEvidence.expectedBehaviorByScenarioId,
    ...holdoutEvidence.expectedBehaviorByScenarioId,
  ]);
  const categoryByScenarioId = new Map([
    ...developmentEvidence.categoryByScenarioId,
    ...holdoutEvidence.categoryByScenarioId,
  ]);

  const report = buildProtocolV4RealCandidateReport({
    planHash: input.plan.planHash,
    developmentCaseRecords: developmentEvidence.caseRecords,
    holdoutCaseRecords: holdoutEvidence.caseRecords,
    rawTelemetry: [...developmentEvidence.rawTelemetry, ...holdoutEvidence.rawTelemetry],
    expectedBehaviorByScenarioId,
    categoryByScenarioId,
    executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
  });

  const g2Results = mapProtocolV4GateVerdicts(report.gateVerdicts);
  const allMandatoryG2CriteriaPass = PROTOCOL_V4_G2_GATES.every((g) => g2Results[g] === 'passed');
  const evaluatorAlgorithmHash = computeProtocolV4EvaluatorManifestHash(
    input.repoRoot ?? process.cwd(),
  );

  return {
    evaluatorAlgorithmHash,
    developmentArtifactHashes: {
      categoryTableHash: input.development.categoryTable.contentHash,
      telemetryHash: input.development.telemetry.contentHash,
      ledgerHash: input.development.ledger.contentHash,
      rawResultsHash: input.development.rawResults.contentHash,
    },
    holdoutArtifactHashes: {
      categoryTableHash: input.holdout.categoryTable.contentHash,
      telemetryHash: input.holdout.telemetry.contentHash,
      ledgerHash: input.holdout.ledger.contentHash,
      rawResultsHash: input.holdout.rawResults.contentHash,
    },
    g2Results,
    allMandatoryG2CriteriaPass,
  };
}

// ---------------------------------------------------------------------------------------------
// Type A: explicitly non-authoritative Dry-Run Final G2 Technical Report -- the ONLY report type
// this task's zero-network Mini-Run ever produces.
// ---------------------------------------------------------------------------------------------

export const PROTOCOL_V4_DRY_RUN_FINAL_REPORT_SCHEMA_VERSION =
  'resolver-v3-048-dry-run-final-g2-technical-report-v1';

export const PROTOCOL_V4_DRY_RUN_FINAL_REPORT_DISCLAIMER =
  'Technical zero-network dry-run evidence only, produced from fake_dry_run_only Development and ' +
  'Holdout authorizations against fake transport/sources. Does NOT constitute a live superiority ' +
  'claim, a passed G2 verdict, a human_live authorization, or a production-wiring approval. No ' +
  'real provider call was made and no real cost was incurred to produce this report.';

/** Type A per the task's "8. Trennung technischer Dry-Run-Bericht versus autoritativer Final-G2-
 * Report" requirement. Structurally, permanently non-authoritative: `runKind`/`authoritative` are
 * literal types (`'fake_dry_run_only'`/`false`), never `boolean`/a free string -- there is no
 * optional `authoritative?: boolean` anywhere on this type, and no code path in this module ever
 * constructs one with `authoritative: true`. */
export interface ProtocolV4DryRunFinalG2TechnicalReport {
  schemaVersion: typeof PROTOCOL_V4_DRY_RUN_FINAL_REPORT_SCHEMA_VERSION;
  runKind: 'fake_dry_run_only';
  authoritative: false;
  candidateId: ResolverV3047CandidateId;
  candidateChoiceHash: string;
  dryRunHoldoutPlanHash: string;
  dryRunAuthorizationHash: string;
  developmentEvidenceRootHash: string;
  evaluatorVersion: string;
  evaluatorAlgorithmHash: string;
  developmentArtifactHashes: {
    categoryTableHash: string;
    telemetryHash: string;
    ledgerHash: string;
    rawResultsHash: string;
  };
  holdoutArtifactHashes: {
    categoryTableHash: string;
    telemetryHash: string;
    ledgerHash: string;
    rawResultsHash: string;
  };
  g2Results: Readonly<Record<ProtocolV4G2Gate, ProtocolV4GateVerdict>>;
  allMandatoryG2CriteriaPass: boolean;
  explicitDisclaimer: typeof PROTOCOL_V4_DRY_RUN_FINAL_REPORT_DISCLAIMER;
  reportHash: string;
}

/** The ONLY entry point this task's Mini-Run/fault-matrix reference chain may call to produce a
 * final joint G2 report. Requires the full non-authoritative Dry-Run chain (`choice`/`holdoutPlan`/
 * `holdoutAuthorization`, each independently re-validated here via the real
 * `validateProtocolV4DryRunCandidateChoice`/`validateProtocolV4DryRunHoldoutExecutionPlan`
 * functions) plus both partitions' sealed artifacts, which are independently revalidated (never
 * trusted) before the real evaluator ever sees them. Always produces `authoritative: false`,
 * `runKind: 'fake_dry_run_only'`, and the fixed `explicitDisclaimer` text -- there is no parameter
 * or code path that can flip either to an authoritative value. */
export function deriveProtocolV4DryRunFinalG2TechnicalReport(input: {
  plan: ProtocolV4MasterPlan;
  choice: ProtocolV4DryRunCandidateChoice;
  holdoutPlan: ProtocolV4DryRunHoldoutExecutionPlan;
  holdoutAuthorization: ProtocolV4DryRunHoldoutAuthorization;
  development: ProtocolV4DevelopmentCandidateArtifacts;
  holdout: ProtocolV4DevelopmentCandidateArtifacts;
  developmentArmBaseline: ProtocolV4RealArmBaseline;
  holdoutArmBaseline: ProtocolV4RealArmBaseline;
  repoRoot?: string;
}): ProtocolV4DryRunFinalG2TechnicalReport {
  const { plan, choice, holdoutPlan, holdoutAuthorization } = input;
  validateProtocolV4DryRunCandidateChoice(plan, choice);
  validateProtocolV4DryRunHoldoutExecutionPlan(
    plan,
    holdoutPlan,
    holdoutPlan.developmentEvidenceRootHash,
    choice,
  );
  if (
    holdoutAuthorization.masterPlanHash !== plan.planHash ||
    holdoutAuthorization.dryRunHoldoutPlanHash !== holdoutPlan.dryRunHoldoutPlanHash ||
    holdoutAuthorization.developmentEvidenceRootHash !== holdoutPlan.developmentEvidenceRootHash ||
    holdoutAuthorization.dryRunChoiceHash !== choice.choiceHash ||
    holdoutAuthorization.candidateId !== holdoutPlan.candidateId
  )
    throw new ProtocolV4EvaluationDerivationError(
      'PROTOCOL_V4_DRY_RUN_FINAL_REPORT_AUTHORIZATION_IDENTITY_MISMATCH',
    );
  const candidateId = holdoutPlan.candidateId;
  if (input.development.candidateId !== candidateId || input.holdout.candidateId !== candidateId)
    throw new ProtocolV4EvaluationDerivationError(
      'PROTOCOL_V4_DRY_RUN_FINAL_REPORT_CANDIDATE_MISMATCH',
    );

  const developmentExpectedObservations = plan.developmentObservations.filter(
    (o) => o.partition === 'development' && o.candidateId === candidateId,
  );

  const joint = deriveProtocolV4JointG2Verdict({
    plan,
    candidateId,
    development: input.development,
    holdout: input.holdout,
    developmentExpectedObservations,
    holdoutExpectedObservations: holdoutPlan.holdoutObservations,
    developmentArmBaseline: input.developmentArmBaseline,
    holdoutArmBaseline: input.holdoutArmBaseline,
    repoRoot: input.repoRoot,
  });

  const withoutHash: Omit<ProtocolV4DryRunFinalG2TechnicalReport, 'reportHash'> = {
    schemaVersion: PROTOCOL_V4_DRY_RUN_FINAL_REPORT_SCHEMA_VERSION,
    runKind: 'fake_dry_run_only',
    authoritative: false,
    candidateId,
    candidateChoiceHash: choice.choiceHash,
    dryRunHoldoutPlanHash: holdoutPlan.dryRunHoldoutPlanHash,
    dryRunAuthorizationHash: hashProtocolV4(holdoutAuthorization),
    developmentEvidenceRootHash: holdoutPlan.developmentEvidenceRootHash,
    evaluatorVersion: PROTOCOL_V4_EVALUATOR_VERSION,
    evaluatorAlgorithmHash: joint.evaluatorAlgorithmHash,
    developmentArtifactHashes: joint.developmentArtifactHashes,
    holdoutArtifactHashes: joint.holdoutArtifactHashes,
    g2Results: joint.g2Results,
    allMandatoryG2CriteriaPass: joint.allMandatoryG2CriteriaPass,
    explicitDisclaimer: PROTOCOL_V4_DRY_RUN_FINAL_REPORT_DISCLAIMER,
  };
  return { ...withoutHash, reportHash: hashProtocolV4(withoutHash) };
}

/** Re-derives the ENTIRE final report from the same inputs and requires exact hash equality --
 * closing the "Validator ergänzen, der den gesamten Final Report erneut ableitet und exakte
 * Gleichheit verlangt" requirement. Because `deriveProtocolV4DryRunFinalG2TechnicalReport` is a pure
 * function of its inputs (real corpus, real evaluator files, real sealed artifacts), any drift in
 * any artifact, hash, or identity produces a different `reportHash`. */
export function revalidateProtocolV4DryRunFinalG2TechnicalReport(
  input: Parameters<typeof deriveProtocolV4DryRunFinalG2TechnicalReport>[0],
  claimed: ProtocolV4DryRunFinalG2TechnicalReport,
): void {
  const recomputed = deriveProtocolV4DryRunFinalG2TechnicalReport(input);
  if (recomputed.reportHash !== claimed.reportHash)
    throw new ProtocolV4EvaluationDerivationError(
      'PROTOCOL_V4_DRY_RUN_FINAL_REPORT_REDERIVATION_MISMATCH',
    );
}

// ---------------------------------------------------------------------------------------------
// Type B: authoritative Final G2 Report -- STRUCTURAL DECLARATION ONLY, per the task's explicit
// instruction. No builder function exists for this type anywhere in this module or this task: an
// authoritative report may only ever be produced from a real, authoritative `CandidateSelectionRecord`,
// a validated real `HoldoutExecutionPlan`, validated `human_live` Development/Holdout evidence,
// matching Authorization/Lease hashes, and full evidence revalidation -- none of which this
// zero-network, fake-dry-run-only task ever constructs. There is deliberately no
// `deriveProtocolV4AuthoritativeFinalG2Report` function; adding one is explicitly out of this
// task's scope.
// ---------------------------------------------------------------------------------------------

export interface ProtocolV4AuthoritativeFinalG2Report {
  schemaVersion: string;
  runKind: 'human_live';
  authoritative: true;
  candidateId: ResolverV3047CandidateId;
  candidateSelectionRecordHash: string;
  holdoutExecutionPlanHash: string;
  holdoutAuthorizationId: string;
  developmentEvidenceRootHash: string;
  evaluatorVersion: string;
  evaluatorAlgorithmHash: string;
  developmentArtifactHashes: {
    categoryTableHash: string;
    telemetryHash: string;
    ledgerHash: string;
    rawResultsHash: string;
  };
  holdoutArtifactHashes: {
    categoryTableHash: string;
    telemetryHash: string;
    ledgerHash: string;
    rawResultsHash: string;
  };
  g2Results: Readonly<Record<ProtocolV4G2Gate, ProtocolV4GateVerdict>>;
  allMandatoryG2CriteriaPass: boolean;
  g2PassedClaim: boolean;
  reportHash: string;
}
