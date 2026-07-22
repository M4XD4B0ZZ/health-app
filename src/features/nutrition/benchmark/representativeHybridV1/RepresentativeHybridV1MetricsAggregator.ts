import type { CaseEvaluation } from '../evaluateVariantACase';
import type { CaseEvaluationB } from '../evaluateVariantBCase';
import type { CaseEvaluationC } from '../evaluateVariantCCase';
import type { RepresentativeHybridV1Partition } from './RepresentativeHybridV1Types';

/**
 * RESOLVER-V3-038 metrics aggregation (requirements 30-33). Reports separately by arm and
 * partition -- never collapses A/B/C authority (requirement 31). Every arm keeps its own
 * false-confidence/expected-behavior judgment (they are computed by each variant's own reused
 * evaluator, never re-derived here); this module only counts/aggregates what each evaluator already
 * decided.
 */

export interface RepresentativeHybridV1CaseRecord {
  scenarioId: string;
  partition: RepresentativeHybridV1Partition;
  category: string;
  difficulty: string;
  locale: string;
  isFixtureOnly: boolean;
  variantA: CaseEvaluation;
  variantB: CaseEvaluationB[];
  variantC: CaseEvaluationC;
}

export interface RepresentativeHybridV1ArmAggregate {
  caseCount: number;
  evaluableCount: number;
  expectedBehaviorMatch: number;
  expectedBehaviorPartial: number;
  expectedBehaviorMismatch: number;
  identificationCorrect: number;
  identificationAcceptableEquivalent: number;
  identificationWrong: number;
  identificationNoResolution: number;
  identificationNotApplicable: number;
  falseConfidentCount: number;
  falseConfidentRate: number | null;
  criticalFailureCount: number;
  technicalErrorCount: number;
  notEvaluableCount: number;
  categoryBreakdown: Record<string, number>;
  difficultyBreakdown: Record<string, number>;
  localeBreakdown: Record<string, number>;
}

function emptyArmAggregate(): RepresentativeHybridV1ArmAggregate {
  return {
    caseCount: 0,
    evaluableCount: 0,
    expectedBehaviorMatch: 0,
    expectedBehaviorPartial: 0,
    expectedBehaviorMismatch: 0,
    identificationCorrect: 0,
    identificationAcceptableEquivalent: 0,
    identificationWrong: 0,
    identificationNoResolution: 0,
    identificationNotApplicable: 0,
    falseConfidentCount: 0,
    falseConfidentRate: null,
    criticalFailureCount: 0,
    technicalErrorCount: 0,
    notEvaluableCount: 0,
    categoryBreakdown: {},
    difficultyBreakdown: {},
    localeBreakdown: {},
  };
}

function bumpBreakdown(breakdown: Record<string, number>, key: string): void {
  breakdown[key] = (breakdown[key] ?? 0) + 1;
}

function bumpIdentification(agg: RepresentativeHybridV1ArmAggregate, outcome: string): void {
  if (outcome === 'correct') agg.identificationCorrect += 1;
  else if (outcome === 'acceptable_equivalent') agg.identificationAcceptableEquivalent += 1;
  else if (outcome === 'wrong') agg.identificationWrong += 1;
  else if (outcome === 'no_resolution') agg.identificationNoResolution += 1;
  else agg.identificationNotApplicable += 1;
}

function bumpExpectedBehavior(agg: RepresentativeHybridV1ArmAggregate, result: string): void {
  if (result === 'match') agg.expectedBehaviorMatch += 1;
  else if (result === 'partial') agg.expectedBehaviorPartial += 1;
  else agg.expectedBehaviorMismatch += 1;
}

export interface RepresentativeHybridV1PartitionAggregate {
  partition: RepresentativeHybridV1Partition;
  variantA: RepresentativeHybridV1ArmAggregate;
  variantB: RepresentativeHybridV1ArmAggregate;
  variantC: RepresentativeHybridV1ArmAggregate;
  variantCFastPathUsedCount: number;
  variantCAiCalledCount: number;
  variantCAvoidedAiCalls: number;
  variantCUnbackedNumericResultCount: number;
  variantCSourceIdRate: number | null;
  variantAUnbackedNumericResultCount: number;
  variantBAiEstimateCount: number;
}

function emptyPartitionAggregate(
  partition: RepresentativeHybridV1Partition,
): RepresentativeHybridV1PartitionAggregate {
  return {
    partition,
    variantA: emptyArmAggregate(),
    variantB: emptyArmAggregate(),
    variantC: emptyArmAggregate(),
    variantCFastPathUsedCount: 0,
    variantCAiCalledCount: 0,
    variantCAvoidedAiCalls: 0,
    variantCUnbackedNumericResultCount: 0,
    variantCSourceIdRate: null,
    variantAUnbackedNumericResultCount: 0,
    variantBAiEstimateCount: 0,
  };
}

export interface RepresentativeHybridV1AggregatedMetrics {
  development: RepresentativeHybridV1PartitionAggregate;
  holdout: RepresentativeHybridV1PartitionAggregate;
  combined: RepresentativeHybridV1PartitionAggregate;
}

function fold(
  target: RepresentativeHybridV1PartitionAggregate,
  record: RepresentativeHybridV1CaseRecord,
): void {
  // Variant A
  target.variantA.caseCount += 1;
  bumpBreakdown(target.variantA.categoryBreakdown, record.category);
  bumpBreakdown(target.variantA.difficultyBreakdown, record.difficulty);
  bumpBreakdown(target.variantA.localeBreakdown, record.locale);
  bumpIdentification(target.variantA, record.variantA.identification);
  bumpExpectedBehavior(target.variantA, record.variantA.expectedBehavior.result);
  if (record.variantA.identification !== 'not_applicable') target.variantA.evaluableCount += 1;
  if (record.variantA.falseConfident) target.variantA.falseConfidentCount += 1;
  if (record.variantA.isCriticalFailure) target.variantA.criticalFailureCount += 1;
  if (record.variantA.provenance.hasUnbackedNumericResult)
    target.variantAUnbackedNumericResultCount += 1;

  // Variant B (primary run only, runIndex 0 -- repeat-consistency runs are aggregated separately)
  const primaryB = record.variantB.find((b) => b.runIndex === 0) ?? record.variantB[0];
  if (primaryB) {
    target.variantB.caseCount += 1;
    bumpBreakdown(target.variantB.categoryBreakdown, record.category);
    bumpBreakdown(target.variantB.difficultyBreakdown, record.difficulty);
    bumpBreakdown(target.variantB.localeBreakdown, record.locale);
    bumpIdentification(target.variantB, primaryB.identification);
    bumpExpectedBehavior(target.variantB, primaryB.expectedBehavior.result);
    if (primaryB.identification !== 'not_applicable') target.variantB.evaluableCount += 1;
    if (primaryB.falseConfident) target.variantB.falseConfidentCount += 1;
    if (primaryB.isCriticalFailure) target.variantB.criticalFailureCount += 1;
    if (primaryB.technicalFailure) target.variantB.technicalErrorCount += 1;
    if (primaryB.outcome === 'estimated') target.variantBAiEstimateCount += 1;
  }

  // Variant C
  target.variantC.caseCount += 1;
  bumpBreakdown(target.variantC.categoryBreakdown, record.category);
  bumpBreakdown(target.variantC.difficultyBreakdown, record.difficulty);
  bumpBreakdown(target.variantC.localeBreakdown, record.locale);
  bumpIdentification(target.variantC, record.variantC.identification);
  bumpExpectedBehavior(target.variantC, record.variantC.expectedBehavior.result);
  if (record.variantC.identification !== 'not_applicable') target.variantC.evaluableCount += 1;
  if (record.variantC.falseConfident) target.variantC.falseConfidentCount += 1;
  if (record.variantC.isCriticalFailure) target.variantC.criticalFailureCount += 1;
  if (record.variantC.provenance.hasUnbackedNumericResult)
    target.variantCUnbackedNumericResultCount += 1;
  if (record.variantC.fastPathUsed) target.variantCFastPathUsedCount += 1;
  if (record.variantC.aiCalled) target.variantCAiCalledCount += 1;
  else target.variantCAvoidedAiCalls += 1;
}

function finalizeRates(agg: RepresentativeHybridV1PartitionAggregate): void {
  for (const arm of [agg.variantA, agg.variantB, agg.variantC]) {
    arm.falseConfidentRate = arm.caseCount === 0 ? null : arm.falseConfidentCount / arm.caseCount;
    arm.notEvaluableCount = arm.caseCount - arm.evaluableCount;
  }
  agg.variantCSourceIdRate =
    agg.variantC.caseCount === 0
      ? null
      : (agg.variantC.caseCount - agg.variantCUnbackedNumericResultCount) / agg.variantC.caseCount;
}

/** Aggregates a flat list of per-case three-arm records into development/holdout/combined
 * per-arm metrics. Excludes any record whose `isFixtureOnly` is `true` (harness-conformance
 * records never enter representative-quality metrics, requirement 19/32). */
export function aggregateRepresentativeHybridV1Metrics(
  records: readonly RepresentativeHybridV1CaseRecord[],
): RepresentativeHybridV1AggregatedMetrics {
  const development = emptyPartitionAggregate('development');
  const holdout = emptyPartitionAggregate('holdout');
  const combined = emptyPartitionAggregate('development');
  combined.partition = 'development';

  for (const record of records) {
    if (record.isFixtureOnly) continue;
    fold(record.partition === 'holdout' ? holdout : development, record);
    fold(combined, record);
  }

  finalizeRates(development);
  finalizeRates(holdout);
  finalizeRates(combined);

  return { development, holdout, combined };
}
