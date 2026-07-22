import {
  REPRESENTATIVE_HYBRID_V1_CORPUS,
  REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST,
} from './RepresentativeHybridV1Manifest';
import {
  assertNoOverlayPartitionDrift,
  RepresentativeHybridV1Registry,
} from './RepresentativeHybridV1Registry';
import { assertValidRepresentativeHybridV1Corpus } from './RepresentativeHybridV1Validator';
import {
  runRepresentativeHybridV1ThreeArms,
  type RepresentativeHybridV1RunnerDependencies,
} from './RepresentativeHybridV1ThreeArmRunner';
import {
  aggregateRepresentativeHybridV1Metrics,
  type RepresentativeHybridV1CaseRecord,
} from './RepresentativeHybridV1MetricsAggregator';
import {
  buildRepresentativeHybridV1MachineReport,
  buildRepresentativeHybridV1MarkdownReport,
  type RepresentativeHybridV1MachineReport,
} from './RepresentativeHybridV1ReportBuilder';
import type {
  RepresentativeHybridV1Partition,
  RepresentativeHybridV1Scenario,
} from './RepresentativeHybridV1Types';
import {
  REPRESENTATIVE_HYBRID_V1_CONFORMANCE_CASES,
  buildRepresentativeHybridV1ConformanceDependencies,
  buildRepresentativeHybridV1ConformanceErrorDependencies,
} from './RepresentativeHybridV1ConformanceFixtures';

/**
 * RESOLVER-V3-038 canonical runner (requirement 15/26/35-36). Validates the corpus/registry, then
 * executes selected partitions through the real three-arm harness. Default behavior is zero-network,
 * fixture-only, development-partition-only -- holdout requires an explicit flag (requirement 35/36).
 */

export interface RunRepresentativeHybridV1Options {
  partitions?: readonly RepresentativeHybridV1Partition[];
  caseIds?: readonly string[];
  runnerDependencies?: RepresentativeHybridV1RunnerDependencies;
  includeConformance?: boolean;
}

export class RepresentativeHybridV1RunError extends Error {}

function isResolutionScenario(
  scenario: RepresentativeHybridV1Scenario,
): scenario is Extract<
  RepresentativeHybridV1Scenario,
  { scenarioType: 'resolution_decomposition' }
> {
  return scenario.scenarioType === 'resolution_decomposition';
}

export async function runRepresentativeHybridV1(
  options: RunRepresentativeHybridV1Options = {},
): Promise<RepresentativeHybridV1MachineReport> {
  assertValidRepresentativeHybridV1Corpus(REPRESENTATIVE_HYBRID_V1_CORPUS);

  const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
  assertNoOverlayPartitionDrift(REPRESENTATIVE_HYBRID_V1_CORPUS, registry);

  for (const scenario of REPRESENTATIVE_HYBRID_V1_CORPUS) {
    if (!registry.has(scenario.scenarioId)) {
      throw new RepresentativeHybridV1RunError(
        `Scenario "${scenario.scenarioId}" is present in the corpus but missing from the registry.`,
      );
    }
    if (registry.partitionFor(scenario.scenarioId) !== scenario.partition) {
      throw new RepresentativeHybridV1RunError(
        `Scenario "${scenario.scenarioId}" partition mismatch between corpus and registry.`,
      );
    }
  }

  const partitions = options.partitions ?? ['development'];
  const caseIdFilter = options.caseIds ? new Set(options.caseIds) : null;
  const warnings: string[] = [];

  const resolutionScenarios = REPRESENTATIVE_HYBRID_V1_CORPUS.filter(isResolutionScenario).filter(
    (scenario) =>
      partitions.includes(scenario.partition) &&
      (!caseIdFilter || caseIdFilter.has(scenario.scenarioId)),
  );

  const records: RepresentativeHybridV1CaseRecord[] = [];

  for (const scenario of resolutionScenarios) {
    const armResult = await runRepresentativeHybridV1ThreeArms(
      scenario.case,
      options.runnerDependencies,
    );
    records.push({
      scenarioId: scenario.scenarioId,
      partition: scenario.partition,
      category: scenario.case.category,
      difficulty: scenario.case.difficulty,
      locale: scenario.case.locale,
      isFixtureOnly: false,
      variantA: armResult.variantA,
      variantB: armResult.variantB,
      variantC: armResult.variantC,
    });
  }

  if (options.includeConformance) {
    for (const conformanceCase of REPRESENTATIVE_HYBRID_V1_CONFORMANCE_CASES) {
      const deps =
        conformanceCase.caseId === 'RH-CONF-ERROR'
          ? buildRepresentativeHybridV1ConformanceErrorDependencies()
          : buildRepresentativeHybridV1ConformanceDependencies();
      const armResult = await runRepresentativeHybridV1ThreeArms(conformanceCase, deps);
      records.push({
        scenarioId: conformanceCase.caseId,
        partition: 'development',
        category: conformanceCase.category,
        difficulty: conformanceCase.difficulty,
        locale: conformanceCase.locale,
        isFixtureOnly: true,
        variantA: armResult.variantA,
        variantB: armResult.variantB,
        variantC: armResult.variantC,
      });
    }
  }

  const metrics = aggregateRepresentativeHybridV1Metrics(records);
  return buildRepresentativeHybridV1MachineReport(records, metrics, partitions, warnings);
}

export function buildRepresentativeHybridV1MarkdownForReport(
  report: RepresentativeHybridV1MachineReport,
): string {
  return buildRepresentativeHybridV1MarkdownReport(report);
}
