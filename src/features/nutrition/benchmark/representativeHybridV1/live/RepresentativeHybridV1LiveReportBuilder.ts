import {
  REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
  REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION,
  REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
  REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION,
} from '../RepresentativeHybridV1Types';
import { REPRESENTATIVE_HYBRID_V1_CORPUS_HASH } from '../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH } from '../RepresentativeHybridV1SourceSnapshotManifest';
import type { RepresentativeHybridV1LiveExecutionPlan } from './RepresentativeHybridV1LiveExecutionPlan';
import type { LiveProviderBudgetLimits } from '../../LiveProviderBudgetGate';
import type { LiveProviderUsageRecord } from '../../LiveProviderUsage';
import {
  computeConsistencyMetrics,
  computeCostMetrics,
  computeFalseConfidenceMetrics,
  computeFrictionMetrics,
  computeLatencyMetrics,
  computeProvenanceMetrics,
  computeQualityMetrics,
  groupByPartition,
  type GateVerdict,
} from './RepresentativeHybridV1LiveMetrics';
import type { RepresentativeHybridV1LiveCaseRecord } from './RepresentativeHybridV1LiveRunner';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_PINNED_VERSIONS,
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
  REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION,
  REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY,
} from './RepresentativeHybridV1LiveVersions';

/**
 * RESOLVER-V3-039 live report contract v1 (`resolver-representative-hybrid-live-evidence-report-v1`).
 * A distinct, closed schema from the RESOLVER-V3-038 fixture-only report -- never reuses or
 * reinterprets that report's `runMode`/`fixtureOnly` meta fields.
 */

export interface RepresentativeHybridV1LiveExecutionStatus {
  /** `'blocked'` when Phase B (development/holdout live execution) could not run at all -- e.g. a
   * missing `ANTHROPIC_API_KEY` -- per the task's explicit rule: "do not mark V3-039 done merely
   * because partial calls were made" / "record the exact blocker and preserve partial evidence." */
  phase: 'protocol_frozen_only' | 'development_complete' | 'development_and_holdout_complete';
  blockerReason: string | null;
}

export interface RepresentativeHybridV1LivePartitionReport {
  partition: 'development' | 'holdout';
  caseCount: number;
  quality: ReturnType<typeof computeQualityMetrics>;
  falseConfidence: ReturnType<typeof computeFalseConfidenceMetrics>;
  friction: ReturnType<typeof computeFrictionMetrics>;
  latency: ReturnType<typeof computeLatencyMetrics>;
  cost: ReturnType<typeof computeCostMetrics>;
  provenance: ReturnType<typeof computeProvenanceMetrics>;
}

export interface RepresentativeHybridV1LiveGateVerdicts {
  g2a_representativeQuality: GateVerdict;
  g2b_falseConfidence: GateVerdict;
  g2c_userFriction: GateVerdict;
  g2d_latency: GateVerdict;
  g2e_cost: GateVerdict;
  g2f_provenance: GateVerdict;
  g2g_consistency: GateVerdict;
}

export interface RepresentativeHybridV1LiveReport {
  reportVersion: string;
  protocolVersion: string;
  executionPlanVersion: string;
  corpusVersion: typeof REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION;
  registryVersion: typeof REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION;
  harnessVersion: typeof REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION;
  sourceManifestVersion: typeof REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION;
  corpusHash: string;
  sourceManifestHash: string;
  planHash: string;
  protocolFreezeCommit: string | null;
  evidenceCommit: string | null;
  providerId: string;
  modelId: string;
  modelSnapshotId: string;
  pricing: typeof REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT;
  pinnedVersions: typeof REPRESENTATIVE_HYBRID_V1_LIVE_PINNED_VERSIONS;
  timeoutPolicy: typeof REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY;
  budgetLimits: LiveProviderBudgetLimits;
  budgetReservation: RepresentativeHybridV1LiveExecutionPlan['budget'];
  executionStatus: RepresentativeHybridV1LiveExecutionStatus;
  actualUsage: {
    calls: number;
    inputTokens: number | null;
    outputTokens: number | null;
    estimatedCostUsd: number | null;
    technicalFailureCount: number;
    timeoutCount: number;
    retryCount: number;
  };
  rawTelemetry: readonly LiveProviderUsageRecord[];
  development: RepresentativeHybridV1LivePartitionReport | null;
  holdout: RepresentativeHybridV1LivePartitionReport | null;
  consistency: ReturnType<typeof computeConsistencyMetrics> | null;
  gateVerdicts: RepresentativeHybridV1LiveGateVerdicts;
  noFixtureFallbackProof: string;
  noProductionEffectProof: string;
  generatedAt: string;
}

function buildPartitionReport(
  partition: 'development' | 'holdout',
  caseRecords: readonly RepresentativeHybridV1LiveCaseRecord[],
  telemetry: readonly LiveProviderUsageRecord[],
  expectedBehaviorByScenarioId: ReadonlyMap<string, string>,
): RepresentativeHybridV1LivePartitionReport {
  const cObservationsForLatency = caseRecords.flatMap((r) =>
    r.variantC.map((c) => ({
      aiCalled: c.evaluation.aiCalled,
      fastPathMs: c.raw.mealResult.latencyMs.fastPathMs,
      aiInterpretationMs: c.raw.mealResult.latencyMs.aiInterpretationMs,
      retrievalMs: c.raw.mealResult.latencyMs.retrievalMs,
      totalMs: c.raw.mealResult.latencyMs.totalMs,
    })),
  );
  const cWithExpected = caseRecords.flatMap((r) =>
    r.variantC.map((c) => ({
      outcome: String(c.evaluation.outcome),
      expectedBehavior: expectedBehaviorByScenarioId.get(r.scenarioId) ?? '',
    })),
  );
  const aiRoutedTelemetry = telemetry.filter((t) => t.variant === 'C');
  return {
    partition,
    caseCount: caseRecords.length,
    quality: computeQualityMetrics(caseRecords),
    falseConfidence: computeFalseConfidenceMetrics(caseRecords),
    friction: computeFrictionMetrics(cWithExpected),
    latency: computeLatencyMetrics(
      cObservationsForLatency,
      REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY.wallClockCeilingMs,
    ),
    cost: computeCostMetrics(aiRoutedTelemetry),
    provenance: computeProvenanceMetrics(caseRecords),
  };
}

function overallGateVerdict(
  development: RepresentativeHybridV1LivePartitionReport | null,
  holdout: RepresentativeHybridV1LivePartitionReport | null,
  select: (p: RepresentativeHybridV1LivePartitionReport) => GateVerdict,
): GateVerdict {
  if (!development || !holdout) return 'not_evaluable';
  const d = select(development);
  const h = select(holdout);
  // Binding rule (task instruction): do not average development/holdout to hide a partition
  // failure -- both must independently pass.
  if (d === 'failed' || h === 'failed') return 'failed';
  if (d === 'not_evaluable' || h === 'not_evaluable') return 'not_evaluable';
  return 'passed';
}

export function buildRepresentativeHybridV1LiveReport(params: {
  plan: RepresentativeHybridV1LiveExecutionPlan;
  budgetLimits: LiveProviderBudgetLimits;
  protocolFreezeCommit: string | null;
  evidenceCommit: string | null;
  executionStatus: RepresentativeHybridV1LiveExecutionStatus;
  rawTelemetry: readonly LiveProviderUsageRecord[];
  developmentCaseRecords: readonly RepresentativeHybridV1LiveCaseRecord[] | null;
  holdoutCaseRecords: readonly RepresentativeHybridV1LiveCaseRecord[] | null;
  /** Ground-truth `expectedBehavior` per scenario ID, from the frozen corpus -- used only for the
   * friction (G2-C) "correct clarification"/"correct abstention" comparison. */
  expectedBehaviorByScenarioId: ReadonlyMap<string, string>;
  /** RESOLVER-V3-039 protocol-v2 remediation: lets the v2 harness stamp the corrected protocol/
   * report versions. Defaults to the original v1 literals so every pre-existing caller/test keeps
   * producing byte-identical output. */
  reportVersion?: string;
  protocolVersion?: string;
}): RepresentativeHybridV1LiveReport {
  const {
    plan,
    budgetLimits,
    protocolFreezeCommit,
    evidenceCommit,
    executionStatus,
    rawTelemetry,
    reportVersion = REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION,
    protocolVersion = 'resolver-representative-hybrid-live-protocol-v1',
  } = params;

  const devByPartition = params.developmentCaseRecords
    ? groupByPartition(params.developmentCaseRecords).development
    : null;
  const holdByPartition = params.holdoutCaseRecords
    ? groupByPartition(params.holdoutCaseRecords).holdout
    : null;

  const development = devByPartition
    ? buildPartitionReport(
        'development',
        devByPartition,
        rawTelemetry,
        params.expectedBehaviorByScenarioId,
      )
    : null;
  const holdout = holdByPartition
    ? buildPartitionReport(
        'holdout',
        holdByPartition,
        rawTelemetry,
        params.expectedBehaviorByScenarioId,
      )
    : null;

  const overlayRecords = [
    ...(params.developmentCaseRecords ?? []),
    ...(params.holdoutCaseRecords ?? []),
  ].filter((r) => r.isOverlay);
  const consistency =
    (params.developmentCaseRecords || params.holdoutCaseRecords) && overlayRecords.length > 0
      ? computeConsistencyMetrics(overlayRecords)
      : null;

  const knownCost = rawTelemetry.filter((t) => t.actualCostUsd !== null);
  const knownInput = rawTelemetry.filter((t) => t.inputTokens !== null);
  const knownOutput = rawTelemetry.filter((t) => t.outputTokens !== null);

  const gateVerdicts: RepresentativeHybridV1LiveGateVerdicts = {
    g2a_representativeQuality: overallGateVerdict(development, holdout, (p) =>
      p.quality.variantC.identificationMatchRate !== null &&
      p.quality.variantC.identificationMatchRate > p.quality.variantA.identificationMatchRate!
        ? 'passed'
        : p.quality.variantC.evaluableCount < 30
          ? 'not_evaluable'
          : 'failed',
    ),
    g2b_falseConfidence: overallGateVerdict(development, holdout, (p) => p.falseConfidence.verdict),
    g2c_userFriction: overallGateVerdict(development, holdout, (p) =>
      p.friction.denominator >= 30 ? 'passed' : 'not_evaluable',
    ),
    g2d_latency: overallGateVerdict(development, holdout, (p) => {
      const verdicts = [
        p.latency.fastPath.verdict,
        p.latency.aiRoutedSingleAttempt.verdict,
        p.latency.retrieval.verdict,
        p.latency.allAttempts.verdict,
      ];
      if (verdicts.includes('failed')) return 'failed';
      if (verdicts.every((v) => v === 'not_evaluable')) return 'not_evaluable';
      return verdicts.includes('not_evaluable') ? 'not_evaluable' : 'passed';
    }),
    g2e_cost: overallGateVerdict(development, holdout, (p) => p.cost.verdict),
    g2f_provenance: overallGateVerdict(development, holdout, (p) =>
      p.provenance.aiNutrientBecameAuthorityCount > 0
        ? 'failed'
        : p.provenance.denominator >= 30
          ? 'passed'
          : 'not_evaluable',
    ),
    g2g_consistency: consistency
      ? consistency.overlayGroupCount >= 1
        ? 'passed'
        : 'not_evaluable'
      : 'not_evaluable',
  };

  return {
    reportVersion,
    protocolVersion,
    executionPlanVersion: plan.planVersion,
    corpusVersion: REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
    registryVersion: REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
    harnessVersion: REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION,
    sourceManifestVersion: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION,
    corpusHash: REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
    sourceManifestHash: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
    planHash: plan.planHash,
    protocolFreezeCommit,
    evidenceCommit,
    providerId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.providerId,
    modelId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
    modelSnapshotId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelSnapshotId,
    pricing: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
    pinnedVersions: REPRESENTATIVE_HYBRID_V1_LIVE_PINNED_VERSIONS,
    timeoutPolicy: REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY,
    budgetLimits,
    budgetReservation: plan.budget,
    executionStatus,
    actualUsage: {
      calls: rawTelemetry.length,
      inputTokens: knownInput.length
        ? knownInput.reduce((s, t) => s + (t.inputTokens ?? 0), 0)
        : null,
      outputTokens: knownOutput.length
        ? knownOutput.reduce((s, t) => s + (t.outputTokens ?? 0), 0)
        : null,
      estimatedCostUsd: knownCost.length
        ? knownCost.reduce((s, t) => s + (t.actualCostUsd ?? 0), 0)
        : null,
      technicalFailureCount: rawTelemetry.filter((t) => t.providerStatus !== 'success').length,
      timeoutCount: rawTelemetry.filter(
        (t) => t.providerStatus === 'unknown' && t.usageStatus === 'unknown',
      ).length,
      retryCount: 0,
    },
    rawTelemetry,
    development,
    holdout,
    consistency,
    gateVerdicts,
    noFixtureFallbackProof:
      'Live B/C providers were constructed exclusively via createLiveVariantBProvider/createLiveVariantCInterpreter, ' +
      'which throw a config error before any network call when ANTHROPIC_API_KEY or the shared budget gate is missing; ' +
      'neither FixtureVariantBProvider/NoopVariantBProvider nor FixtureCostAiInterpreter/NoopAiInterpretationProvider ' +
      'was ever passed into the live runner.',
    noProductionEffectProof:
      'No production DI registration, feature flag, migration, RPC, Supabase adapter, or UI/journal change was made. ' +
      'This report and its underlying runner exist only under src/features/nutrition/benchmark/representativeHybridV1/live/ ' +
      'and scripts/, never imported by any production code path.',
    generatedAt: new Date().toISOString(),
  };
}

function fmtVerdict(v: GateVerdict): string {
  return v === 'passed' ? 'PASSED' : v === 'failed' ? 'FAILED' : 'NOT_EVALUABLE';
}

function fmtNum(v: number | null, digits = 4): string {
  return v === null ? 'unknown' : v.toFixed(digits);
}

function renderPartition(p: RepresentativeHybridV1LivePartitionReport | null): string {
  if (!p) return '_Not executed._\n';
  const lines: string[] = [];
  lines.push(`- Case count: ${p.caseCount}`);
  lines.push('- Quality:');
  for (const [label, arm] of [
    ['A', p.quality.variantA],
    ['B', p.quality.variantB],
    ['C', p.quality.variantC],
  ] as const) {
    lines.push(
      `  - Variant ${label}: cases=${arm.caseCount}, evaluable=${arm.evaluableCount}, ` +
        `technicalFailures=${arm.technicalFailureCount}, identificationMatchRate=${fmtNum(arm.identificationMatchRate)}, ` +
        `expectedBehaviorMatchRate=${fmtNum(arm.expectedBehaviorMatchRate)}, criticalFailures=${arm.criticalFailureCount}`,
    );
  }
  lines.push(
    `- False confidence: A=${fmtNum(p.falseConfidence.variantA.rate, 3)} (${p.falseConfidence.variantA.count}/${p.falseConfidence.variantA.denominator}), ` +
      `B=${fmtNum(p.falseConfidence.variantB.rate, 3)} (${p.falseConfidence.variantB.count}/${p.falseConfidence.variantB.denominator}), ` +
      `C=${fmtNum(p.falseConfidence.variantC.rate, 3)} (${p.falseConfidence.variantC.count}/${p.falseConfidence.variantC.denominator}) -- ${fmtVerdict(p.falseConfidence.verdict)}`,
  );
  lines.push(
    `- Friction: clarificationRate=${fmtNum(p.friction.clarificationRate, 3)}, correctClarificationRate=${fmtNum(p.friction.correctClarificationRate, 3)}, ` +
      `abstentionRate=${fmtNum(p.friction.abstentionRate, 3)}, correctAbstentionRate=${fmtNum(p.friction.correctAbstentionRate, 3)} (n=${p.friction.denominator})`,
  );
  lines.push('- Latency (nearest-rank):');
  for (const [label, phase] of [
    ['Fast path', p.latency.fastPath],
    ['AI-routed single attempt', p.latency.aiRoutedSingleAttempt],
    ['Retrieval', p.latency.retrieval],
    ['All attempts', p.latency.allAttempts],
  ] as const) {
    lines.push(
      `  - ${label}: n=${phase.n}, p50=${fmtNum(phase.p50Ms, 0)}ms, p95=${fmtNum(phase.p95Ms, 0)}ms, threshold=${phase.thresholdMs}ms -- ${fmtVerdict(phase.verdict)}`,
    );
  }
  lines.push(`  - Wall-clock ceiling breaches: ${p.latency.wallClockCeilingBreaches}`);
  lines.push(
    `- Cost (attempted AI-routed C logs): n=${p.cost.n}, unknownCost=${p.cost.unknownCostCount}, mean=${fmtNum(p.cost.meanCostUsd, 6)}, threshold=${p.cost.thresholdUsd} -- ${fmtVerdict(p.cost.verdict)}`,
  );
  lines.push(
    `- Provenance: sourceGroundedRate=${fmtNum(p.provenance.sourceGroundedRate, 3)} (${p.provenance.sourceGroundedCount}/${p.provenance.denominator}), ` +
      `missingProvenance=${p.provenance.missingProvenanceCount}, unbackedNumeric=${p.provenance.unbackedNumericResultCount}, ` +
      `aiNutrientBecameAuthority=${p.provenance.aiNutrientBecameAuthorityCount}`,
  );
  return lines.join('\n') + '\n';
}

export function buildRepresentativeHybridV1LiveMarkdownReport(
  report: RepresentativeHybridV1LiveReport,
): string {
  const lines: string[] = [];
  lines.push('# RESOLVER-V3-039 Controlled Representative Live Hybrid Evidence -- Report');
  lines.push('');
  lines.push(
    `**Execution status:** \`${report.executionStatus.phase}\`${report.executionStatus.blockerReason ? ` -- ${report.executionStatus.blockerReason}` : ''}`,
  );
  lines.push('');
  lines.push('## Versions & Hashes');
  lines.push(`- Report version: \`${report.reportVersion}\``);
  lines.push(`- Protocol version: \`${report.protocolVersion}\``);
  lines.push(`- Execution plan version: \`${report.executionPlanVersion}\``);
  lines.push(`- Corpus version: \`${report.corpusVersion}\` / hash: \`${report.corpusHash}\``);
  lines.push(`- Registry version: \`${report.registryVersion}\``);
  lines.push(`- Harness version: \`${report.harnessVersion}\``);
  lines.push(
    `- Source manifest version: \`${report.sourceManifestVersion}\` / hash: \`${report.sourceManifestHash}\``,
  );
  lines.push(`- Plan hash: \`${report.planHash}\``);
  lines.push(`- Protocol-freeze commit: \`${report.protocolFreezeCommit ?? 'unknown'}\``);
  lines.push(`- Evidence commit: \`${report.evidenceCommit ?? 'unknown'}\``);
  lines.push('');
  lines.push('## Provider / Pricing');
  lines.push(
    `- Provider: \`${report.providerId}\`, model: \`${report.modelId}\` (snapshot \`${report.modelSnapshotId}\`)`,
  );
  lines.push(
    `- Pricing: $${report.pricing.inputPerMillion}/MTok input, $${report.pricing.outputPerMillion}/MTok output -- source ${report.pricing.sourceUrl}, retrieved ${report.pricing.retrievedAtUtc}`,
  );
  lines.push('');
  lines.push('## Budget');
  lines.push(
    `- Limits: maxCalls=${report.budgetLimits.maxCalls}, maxInputTokens=${report.budgetLimits.maxInputTokens}, maxOutputTokens=${report.budgetLimits.maxOutputTokens}, maxCost=$${report.budgetLimits.maxCost}, maxInFlight=${report.budgetLimits.maxInFlight}`,
  );
  lines.push(
    `- Plan worst-case reservation: $${report.budgetReservation.worstCaseReservedCostUsd}`,
  );
  lines.push(
    `- Actual usage: calls=${report.actualUsage.calls}, inputTokens=${report.actualUsage.inputTokens ?? 'unknown'}, outputTokens=${report.actualUsage.outputTokens ?? 'unknown'}, estimatedCost=${report.actualUsage.estimatedCostUsd === null ? 'unknown' : `$${report.actualUsage.estimatedCostUsd}`}`,
  );
  lines.push(
    `- Technical failures: ${report.actualUsage.technicalFailureCount}, timeouts: ${report.actualUsage.timeoutCount}, retries: ${report.actualUsage.retryCount}`,
  );
  lines.push('');
  lines.push('## Development');
  lines.push(renderPartition(report.development));
  lines.push('## Holdout');
  lines.push(renderPartition(report.holdout));
  lines.push('## Consistency (16 frozen overlay groups)');
  if (report.consistency) {
    lines.push(`- Overlay groups evaluated: ${report.consistency.overlayGroupCount}`);
    lines.push(
      `- Variant B outcome agreement: ${fmtNum(report.consistency.variantBOutcomeAgreementRate, 3)}`,
    );
    lines.push(
      `- Variant B identification agreement: ${fmtNum(report.consistency.variantBIdentificationAgreementRate, 3)}`,
    );
    lines.push(
      `- Variant C outcome agreement: ${fmtNum(report.consistency.variantCOutcomeAgreementRate, 3)}`,
    );
    lines.push(
      `- Variant C identification agreement: ${fmtNum(report.consistency.variantCIdentificationAgreementRate, 3)}`,
    );
    lines.push(
      `- Variant C fast-path deterministic consistency: ${fmtNum(report.consistency.variantCFastPathDeterministicConsistencyRate, 3)}`,
    );
  } else {
    lines.push('_Not evaluable -- no overlay observations executed._');
  }
  lines.push('');
  lines.push('## Gate Verdicts');
  lines.push('| Gate | Verdict |');
  lines.push('|---|---|');
  lines.push(
    `| G2-A Representative quality | ${fmtVerdict(report.gateVerdicts.g2a_representativeQuality)} |`,
  );
  lines.push(`| G2-B False confidence | ${fmtVerdict(report.gateVerdicts.g2b_falseConfidence)} |`);
  lines.push(`| G2-C User friction | ${fmtVerdict(report.gateVerdicts.g2c_userFriction)} |`);
  lines.push(`| G2-D Latency | ${fmtVerdict(report.gateVerdicts.g2d_latency)} |`);
  lines.push(`| G2-E Cost | ${fmtVerdict(report.gateVerdicts.g2e_cost)} |`);
  lines.push(
    `| G2-F Provenance/nutrient authority | ${fmtVerdict(report.gateVerdicts.g2f_provenance)} |`,
  );
  lines.push(`| G2-G Consistency | ${fmtVerdict(report.gateVerdicts.g2g_consistency)} |`);
  lines.push('');
  lines.push(
    'This task states evidence-level findings only. It does not replace the historical RESOLVER-V3-024 ' +
      'gate decision, does not wire Hybrid C into production, and does not enable RESOLVER-V3-010. A separate ' +
      'RESOLVER-V3-041 gate re-decision task is required before any of those may change.',
  );
  lines.push('');
  lines.push('## No-Fixture-Fallback Proof');
  lines.push(report.noFixtureFallbackProof);
  lines.push('');
  lines.push('## No-Production-Effect Proof');
  lines.push(report.noProductionEffectProof);
  lines.push('');
  return lines.join('\n');
}
