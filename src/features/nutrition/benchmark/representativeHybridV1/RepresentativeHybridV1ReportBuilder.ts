import {
  REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
  REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION,
  REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
  REPRESENTATIVE_HYBRID_V1_REPORT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION,
  type RepresentativeHybridV1Partition,
} from './RepresentativeHybridV1Types';
import { REPRESENTATIVE_HYBRID_V1_CORPUS_HASH } from './RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH } from './RepresentativeHybridV1SourceSnapshotManifest';
import { computeRepresentativeHybridV1CoverageReport } from './RepresentativeHybridV1CoverageReport';
import type {
  RepresentativeHybridV1AggregatedMetrics,
  RepresentativeHybridV1CaseRecord,
} from './RepresentativeHybridV1MetricsAggregator';

/**
 * RESOLVER-V3-038 report schema (requirement 32-33, report-schema version
 * `resolver-representative-hybrid-benchmark-report-v1`). Requirement 19/32: any result computed in
 * fixture mode (the default, zero-network mode) MUST be labeled `fixtureOnly: true` and MUST NOT
 * declare a live quality winner -- `runMode` is always `'fixture'` in this task; V3-039 is the only
 * task authorized to ever set `runMode: 'live'`.
 */

export interface RepresentativeHybridV1RunMetadata {
  corpusVersion: typeof REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION;
  registryVersion: typeof REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION;
  harnessVersion: typeof REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION;
  reportSchemaVersion: typeof REPRESENTATIVE_HYBRID_V1_REPORT_SCHEMA_VERSION;
  sourceManifestVersion: typeof REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION;
  corpusHash: string;
  sourceManifestHash: string;
  runMode: 'fixture';
  partitionsRun: readonly RepresentativeHybridV1Partition[];
  fixtureOnly: true;
  generatedAt: string;
  noLiveQualityEvidence: true;
  noProductionEffect: true;
}

export interface RepresentativeHybridV1MachineReport {
  meta: RepresentativeHybridV1RunMetadata;
  coverage: ReturnType<typeof computeRepresentativeHybridV1CoverageReport>;
  metrics: RepresentativeHybridV1AggregatedMetrics;
  cases: readonly {
    scenarioId: string;
    partition: RepresentativeHybridV1Partition;
    isFixtureOnly: boolean;
    variantAOutcome: string;
    variantBOutcome: string | null;
    variantCOutcome: string;
    comparison: {
      aVsBIdentificationAgree: boolean | null;
      aVsCIdentificationAgree: boolean | null;
      bVsCIdentificationAgree: boolean | null;
    };
  }[];
  warnings: readonly string[];
}

function agree(a: string, b: string | undefined | null): boolean | null {
  if (b === undefined || b === null) return null;
  return a === b;
}

export function buildRepresentativeHybridV1MachineReport(
  records: readonly RepresentativeHybridV1CaseRecord[],
  metrics: RepresentativeHybridV1AggregatedMetrics,
  partitionsRun: readonly RepresentativeHybridV1Partition[],
  warnings: readonly string[] = [],
): RepresentativeHybridV1MachineReport {
  const coverage = computeRepresentativeHybridV1CoverageReport();

  const cases = records.map((record) => {
    const primaryB = record.variantB.find((b) => b.runIndex === 0) ?? record.variantB[0];
    const bIdentification = primaryB?.identification ?? null;
    return {
      scenarioId: record.scenarioId,
      partition: record.partition,
      isFixtureOnly: record.isFixtureOnly,
      variantAOutcome: record.variantA.status,
      variantBOutcome: primaryB?.outcome ?? null,
      variantCOutcome: record.variantC.outcome,
      comparison: {
        aVsBIdentificationAgree: agree(record.variantA.identification, bIdentification),
        aVsCIdentificationAgree: agree(
          record.variantA.identification,
          record.variantC.identification,
        ),
        bVsCIdentificationAgree: agree(
          bIdentification ?? '',
          bIdentification === null ? null : record.variantC.identification,
        ),
      },
    };
  });

  return {
    meta: {
      corpusVersion: REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
      registryVersion: REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
      harnessVersion: REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION,
      reportSchemaVersion: REPRESENTATIVE_HYBRID_V1_REPORT_SCHEMA_VERSION,
      sourceManifestVersion: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION,
      corpusHash: REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
      sourceManifestHash: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
      runMode: 'fixture',
      partitionsRun,
      fixtureOnly: true,
      generatedAt: new Date().toISOString(),
      noLiveQualityEvidence: true,
      noProductionEffect: true,
    },
    coverage,
    metrics,
    cases,
    warnings,
  };
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function buildRepresentativeHybridV1MarkdownReport(
  report: RepresentativeHybridV1MachineReport,
): string {
  const { meta, coverage, metrics } = report;
  const lines: string[] = [];
  lines.push('# RESOLVER-V3-038 Representative Hybrid Benchmark Report');
  lines.push('');
  lines.push(
    '**FIXTURE-ONLY RESULT -- NOT LIVE QUALITY EVIDENCE.** This report was generated in ' +
      '`fixture` run mode (zero network, zero live provider calls). It proves corpus validity, ' +
      'harness plumbing, and report reproducibility. It does **not** prove live Anthropic/OpenAI/ ' +
      'other-provider quality, live Hybrid accuracy, live false-confidence rate, live consistency, ' +
      'production latency, or production cost. No live quality winner is declared. RESOLVER-V3-039 ' +
      'remains required for live evidence; RESOLVER-V3-040 remains required before judging cost/ ' +
      'latency; RESOLVER-V3-010 remains blocked.',
  );
  lines.push('');
  lines.push('## Versions');
  lines.push(`- Corpus version: \`${meta.corpusVersion}\``);
  lines.push(`- Registry version: \`${meta.registryVersion}\``);
  lines.push(`- Harness version: \`${meta.harnessVersion}\``);
  lines.push(`- Report schema version: \`${meta.reportSchemaVersion}\``);
  lines.push(`- Source manifest version: \`${meta.sourceManifestVersion}\``);
  lines.push(`- Corpus hash: \`${meta.corpusHash}\``);
  lines.push(`- Source manifest hash: \`${meta.sourceManifestHash}\``);
  lines.push(`- Partitions run: ${meta.partitionsRun.join(', ')}`);
  lines.push('');
  lines.push('## Generated Counts (manifest-derived)');
  lines.push(`- Total scenarios: ${coverage.totalScenarios}`);
  lines.push(`- Development: ${coverage.developmentCount}`);
  lines.push(`- Holdout: ${coverage.holdoutCount}`);
  lines.push(`- Resolution base cases: ${coverage.resolutionBaseCount}`);
  lines.push(
    `- Repeat/paraphrase overlay cases: ${coverage.resolutionOverlayCount} (${pct(coverage.repeatOverlayPercentOfBase)} of base)`,
  );
  lines.push(`- Holdout share of resolution base: ${pct(coverage.holdoutPercentOfResolutionBase)}`);
  lines.push(`- DACH-weighted share: ${pct(coverage.dachWeightedPercent)}`);
  lines.push(`- Complex-meal share: ${pct(coverage.complexMealPercent)}`);
  lines.push('');
  lines.push('## Category x Partition Matrix');
  lines.push('| Category | Development | Holdout | Total |');
  lines.push('|---|---|---|---|');
  for (const [category, cell] of Object.entries(coverage.categoryPartitionMatrix)) {
    lines.push(`| ${category} | ${cell.development} | ${cell.holdout} | ${cell.total} |`);
  }
  lines.push('');
  lines.push('## Behavior x Partition Matrix');
  lines.push('| Behavior | Development | Holdout | Total |');
  lines.push('|---|---|---|---|');
  for (const [behavior, cell] of Object.entries(coverage.behaviorPartitionMatrix)) {
    lines.push(`| ${behavior} | ${cell.development} | ${cell.holdout} | ${cell.total} |`);
  }
  lines.push('');
  lines.push('## Difficulty x Partition Matrix');
  lines.push('| Difficulty | Development | Holdout | Total |');
  lines.push('|---|---|---|---|');
  for (const [difficulty, cell] of Object.entries(coverage.difficultyPartitionMatrix)) {
    lines.push(`| ${difficulty} | ${cell.development} | ${cell.holdout} | ${cell.total} |`);
  }
  lines.push('');
  lines.push('## Ground-Truth Source Distribution');
  for (const [source, count] of Object.entries(coverage.groundTruthSourceDistribution)) {
    lines.push(`- ${source}: ${count}`);
  }
  lines.push('');
  lines.push('## Restaurant Subtype Coverage');
  for (const [subtype, count] of Object.entries(coverage.restaurantSubtypeCounts)) {
    lines.push(`- ${subtype}: ${count}`);
  }
  lines.push('');
  lines.push('## Arm Metrics (fixture-only)');
  for (const [label, agg] of [
    ['Development', metrics.development],
    ['Holdout', metrics.holdout],
    ['Combined', metrics.combined],
  ] as const) {
    lines.push(`### ${label}`);
    for (const [armLabel, arm] of [
      ['A', agg.variantA],
      ['B', agg.variantB],
      ['C', agg.variantC],
    ] as const) {
      lines.push(
        `- Variant ${armLabel}: cases=${arm.caseCount}, evaluable=${arm.evaluableCount}, ` +
          `falseConfident=${arm.falseConfidentCount} (rate=${arm.falseConfidentRate === null ? 'n/a' : arm.falseConfidentRate.toFixed(3)}), ` +
          `criticalFailures=${arm.criticalFailureCount}, technicalErrors=${arm.technicalErrorCount}`,
      );
    }
    lines.push(
      `- Variant C fast-path used: ${agg.variantCFastPathUsedCount}, AI called: ${agg.variantCAiCalledCount}, avoided AI calls: ${agg.variantCAvoidedAiCalls}`,
    );
  }
  lines.push('');
  lines.push('## No-Production-Effect Statement');
  lines.push(
    'No live provider call, no source-network call, no production resolver change, no feature ' +
      'flag, no migration, no RPC, no Supabase adapter change occurred while generating this report.',
  );
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    for (const w of report.warnings) lines.push(`- ${w}`);
  }
  lines.push('');
  return lines.join('\n');
}
