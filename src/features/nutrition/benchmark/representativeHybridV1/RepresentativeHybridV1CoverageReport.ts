import type {
  BenchmarkCategory,
  BenchmarkDifficulty,
  ExpectedBehavior,
} from '../BenchmarkCaseTypes';
import {
  REPRESENTATIVE_HYBRID_V1_CORPUS,
  REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS,
} from './RepresentativeHybridV1Manifest';
import type {
  RepresentativeHybridV1Partition,
  RepresentativeHybridV1ResolutionScenario,
  RepresentativeHybridV1Scenario,
} from './RepresentativeHybridV1Types';

/**
 * RESOLVER-V3-038 generated coverage report (requirement 29/44). Every count below is derived from
 * the corpus at runtime -- no hand-maintained count table exists anywhere else in this benchmark
 * (requirement 28: eliminates the RESOLVER-V3-023 "41 vs 39" class of documentation/reality drift).
 * Tests assert these numbers directly; documentation quotes them, never restates them independently.
 */

const CATEGORIES: readonly BenchmarkCategory[] = [
  'SIMPLE',
  'HOUSEHOLD',
  'DACH',
  'BRANDED',
  'COMPOSED',
  'HOMEMADE',
  'RESTAURANT',
  'VAGUE',
  'PREPARATION',
  'NEGATION_MODIFIER',
  'UNRELIABLE',
];
const BEHAVIORS: readonly ExpectedBehavior[] = [
  'direct_resolution',
  'resolution_with_assumption',
  'clarification_required',
  'multiple_candidates_acceptable',
  'abstention_expected',
];
const DIFFICULTIES: readonly BenchmarkDifficulty[] = ['easy', 'medium', 'hard', 'adversarial'];
const PARTITIONS: readonly RepresentativeHybridV1Partition[] = ['development', 'holdout'];
const COMPLEX_MEAL_CATEGORIES: readonly BenchmarkCategory[] = [
  'COMPOSED',
  'HOMEMADE',
  'RESTAURANT',
];

function isResolutionScenario(
  scenario: RepresentativeHybridV1Scenario,
): scenario is RepresentativeHybridV1ResolutionScenario {
  return scenario.scenarioType === 'resolution_decomposition';
}

function isBaseResolutionScenario(scenario: RepresentativeHybridV1ResolutionScenario): boolean {
  return !scenario.repeatOverlay;
}

export interface RepresentativeHybridV1MatrixCell {
  development: number;
  holdout: number;
  total: number;
}

export type RepresentativeHybridV1Matrix<K extends string> = Record<
  K,
  RepresentativeHybridV1MatrixCell
>;

function emptyCell(): RepresentativeHybridV1MatrixCell {
  return { development: 0, holdout: 0, total: 0 };
}

function bump(
  cell: RepresentativeHybridV1MatrixCell,
  partition: RepresentativeHybridV1Partition,
): void {
  cell[partition] += 1;
  cell.total += 1;
}

export interface RepresentativeHybridV1CoverageReport {
  totalScenarios: number;
  developmentCount: number;
  holdoutCount: number;
  scenarioDomainCounts: Record<string, RepresentativeHybridV1MatrixCell>;
  resolutionBaseCount: number;
  resolutionOverlayCount: number;
  repeatOverlayPercentOfBase: number;
  categoryPartitionMatrix: RepresentativeHybridV1Matrix<BenchmarkCategory>;
  behaviorPartitionMatrix: RepresentativeHybridV1Matrix<ExpectedBehavior>;
  difficultyPartitionMatrix: RepresentativeHybridV1Matrix<BenchmarkDifficulty>;
  groundTruthSourceDistribution: Record<string, number>;
  restaurantSubtypeCounts: Record<string, number>;
  dachWeightedCount: number;
  dachWeightedPercent: number;
  complexMealCount: number;
  complexMealPercent: number;
  holdoutPercentOfResolutionBase: number;
  missingCells: string[];
}

export function computeRepresentativeHybridV1CoverageReport(
  corpus: readonly RepresentativeHybridV1Scenario[] = REPRESENTATIVE_HYBRID_V1_CORPUS,
): RepresentativeHybridV1CoverageReport {
  const scenarioDomainCounts: Record<string, RepresentativeHybridV1MatrixCell> = {};
  let developmentCount = 0;
  let holdoutCount = 0;

  for (const scenario of corpus) {
    scenarioDomainCounts[scenario.scenarioType] ??= emptyCell();
    bump(scenarioDomainCounts[scenario.scenarioType], scenario.partition);
    if (scenario.partition === 'development') developmentCount += 1;
    else holdoutCount += 1;
  }

  const resolutionScenarios = corpus.filter(isResolutionScenario);
  const baseResolutionScenarios = resolutionScenarios.filter(isBaseResolutionScenario);
  const overlayResolutionScenarios = resolutionScenarios.filter(
    (s) => !isBaseResolutionScenario(s),
  );

  const categoryPartitionMatrix = Object.fromEntries(
    CATEGORIES.map((c) => [c, emptyCell()]),
  ) as RepresentativeHybridV1Matrix<BenchmarkCategory>;
  const behaviorPartitionMatrix = Object.fromEntries(
    BEHAVIORS.map((b) => [b, emptyCell()]),
  ) as RepresentativeHybridV1Matrix<ExpectedBehavior>;
  const difficultyPartitionMatrix = Object.fromEntries(
    DIFFICULTIES.map((d) => [d, emptyCell()]),
  ) as RepresentativeHybridV1Matrix<BenchmarkDifficulty>;
  const groundTruthSourceDistribution: Record<string, number> = {};
  const restaurantSubtypeCounts: Record<string, number> = {};

  for (const scenario of baseResolutionScenarios) {
    const c = scenario.case;
    bump(categoryPartitionMatrix[c.category], scenario.partition);
    bump(behaviorPartitionMatrix[c.expectedBehavior], scenario.partition);
    bump(difficultyPartitionMatrix[c.difficulty], scenario.partition);
    groundTruthSourceDistribution[c.groundTruthSource] =
      (groundTruthSourceDistribution[c.groundTruthSource] ?? 0) + 1;
    if (c.category === 'RESTAURANT' && c.subcategory) {
      restaurantSubtypeCounts[c.subcategory] = (restaurantSubtypeCounts[c.subcategory] ?? 0) + 1;
    }
  }

  // Spec §4 "DACH-weighted share" = DACH category + DACH-flavored HOMEMADE (regionalContext set)
  // + restaurant_regional_independent (RESTAURANT/regional_independent, any locale) -- reused
  // literally, not re-derived ad hoc.
  const dachWeightedCount = baseResolutionScenarios.filter(
    (s) =>
      s.case.category === 'DACH' ||
      (s.case.category === 'HOMEMADE' && s.case.regionalContext !== undefined) ||
      (s.case.category === 'RESTAURANT' && s.case.subcategory === 'regional_independent'),
  ).length;
  const complexMealCount = baseResolutionScenarios.filter((s) =>
    COMPLEX_MEAL_CATEGORIES.includes(s.case.category),
  ).length;

  const missingCells: string[] = [];
  for (const category of CATEGORIES) {
    for (const partition of PARTITIONS) {
      if (categoryPartitionMatrix[category][partition] === 0) {
        missingCells.push(`category=${category} partition=${partition}`);
      }
    }
  }
  for (const behavior of BEHAVIORS) {
    for (const partition of PARTITIONS) {
      if (behaviorPartitionMatrix[behavior][partition] === 0) {
        missingCells.push(`behavior=${behavior} partition=${partition}`);
      }
    }
  }
  for (const difficulty of DIFFICULTIES) {
    for (const partition of PARTITIONS) {
      if (difficultyPartitionMatrix[difficulty][partition] === 0) {
        missingCells.push(`difficulty=${difficulty} partition=${partition}`);
      }
    }
  }

  const holdoutBaseCount = baseResolutionScenarios.filter((s) => s.partition === 'holdout').length;

  return {
    totalScenarios: corpus.length,
    developmentCount,
    holdoutCount,
    scenarioDomainCounts,
    resolutionBaseCount: baseResolutionScenarios.length,
    resolutionOverlayCount: overlayResolutionScenarios.length,
    repeatOverlayPercentOfBase:
      baseResolutionScenarios.length === 0
        ? 0
        : (overlayResolutionScenarios.length / baseResolutionScenarios.length) * 100,
    categoryPartitionMatrix,
    behaviorPartitionMatrix,
    difficultyPartitionMatrix,
    groundTruthSourceDistribution,
    restaurantSubtypeCounts,
    dachWeightedCount,
    dachWeightedPercent:
      baseResolutionScenarios.length === 0
        ? 0
        : (dachWeightedCount / baseResolutionScenarios.length) * 100,
    complexMealCount,
    complexMealPercent:
      baseResolutionScenarios.length === 0
        ? 0
        : (complexMealCount / baseResolutionScenarios.length) * 100,
    holdoutPercentOfResolutionBase:
      baseResolutionScenarios.length === 0
        ? 0
        : (holdoutBaseCount / baseResolutionScenarios.length) * 100,
    missingCells,
  };
}

export { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS };
