import * as fs from 'fs';
import * as path from 'path';
import { test } from '@jest/globals';
import { runRepresentativeHybridV1 } from './runRepresentativeHybridV1';
import { buildRepresentativeHybridV1MarkdownReport } from './RepresentativeHybridV1ReportBuilder';
import { assertValidRepresentativeHybridV1Corpus } from './RepresentativeHybridV1Validator';
import {
  REPRESENTATIVE_HYBRID_V1_CORPUS,
  REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST,
} from './RepresentativeHybridV1Manifest';
import {
  assertNoOverlayPartitionDrift,
  RepresentativeHybridV1Registry,
} from './RepresentativeHybridV1Registry';
import { computeRepresentativeHybridV1CoverageReport } from './RepresentativeHybridV1CoverageReport';
import type { RepresentativeHybridV1Partition } from './RepresentativeHybridV1Types';

/**
 * RESOLVER-V3-038 canonical execution entry point, mirroring the Variant A/B/C and Learning
 * Benchmark V2 `.harness.ts` convention: deliberately NOT named `*.test.ts` and NOT inside
 * `__tests__`, so it is invisible to `jest.config.js`'s default `testMatch` and therefore to
 * `npm run test`/`npm run verify`. Executed only via
 * `scripts/benchmark-resolver-v3-representative-hybrid.mjs`. Reads partition/case selection from
 * env vars (`REPRESENTATIVE_HYBRID_V1_PARTITION`, `REPRESENTATIVE_HYBRID_V1_CASES`,
 * `REPRESENTATIVE_HYBRID_V1_INCLUDE_CONFORMANCE`) since Jest's CLI does not forward custom flags
 * through a scoped test file.
 *
 * There is deliberately no live-mode env var read here at all (requirement 18: "no live mode in
 * this task") -- `runRepresentativeHybridV1Options.runnerDependencies` is left undefined, so the
 * three-arm runner falls back to its own zero-network `NoopVariantBProvider`/
 * `FixtureCostAiInterpreter(NoopAiInterpretationProvider)` defaults every time this harness runs.
 */
test('RESOLVER-V3-038 — Representative Hybrid Benchmark harness', async () => {
  const mode = process.env.REPRESENTATIVE_HYBRID_V1_MODE;

  if (mode === 'validate') {
    assertValidRepresentativeHybridV1Corpus(REPRESENTATIVE_HYBRID_V1_CORPUS);
    const registry = new RepresentativeHybridV1Registry(REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST);
    assertNoOverlayPartitionDrift(REPRESENTATIVE_HYBRID_V1_CORPUS, registry);
    // eslint-disable-next-line no-console
    console.log(
      `RESOLVER-V3-038: corpus/registry valid (${REPRESENTATIVE_HYBRID_V1_CORPUS.length} scenarios).`,
    );
    return;
  }

  if (mode === 'coverage') {
    const coverage = computeRepresentativeHybridV1CoverageReport();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(coverage, null, 2));
    return;
  }

  const rawPartition = process.env.REPRESENTATIVE_HYBRID_V1_PARTITION;
  const partitions: readonly RepresentativeHybridV1Partition[] =
    rawPartition === 'holdout'
      ? ['holdout']
      : rawPartition === 'all'
        ? ['development', 'holdout']
        : ['development'];
  const caseIds = process.env.REPRESENTATIVE_HYBRID_V1_CASES
    ? process.env.REPRESENTATIVE_HYBRID_V1_CASES.split(',').map((id: string) => id.trim())
    : undefined;
  const includeConformance = process.env.REPRESENTATIVE_HYBRID_V1_INCLUDE_CONFORMANCE === 'true';

  const report = await runRepresentativeHybridV1({ partitions, caseIds, includeConformance });
  const markdown = buildRepresentativeHybridV1MarkdownReport(report);

  const outputDir = path.resolve(__dirname, '../../../../../logs');
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'resolver-v3-representative-hybrid-benchmark.json');
  const markdownPath = path.join(outputDir, 'resolver-v3-representative-hybrid-benchmark.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, markdown);

  // eslint-disable-next-line no-console
  console.log(
    `\nRESOLVER-V3-038 Representative Hybrid Benchmark complete (FIXTURE-ONLY, no live evidence).\n` +
      `  Partitions run: ${report.meta.partitionsRun.join(', ')}\n` +
      `  Cases evaluated: ${report.cases.length}\n` +
      `  Reports written to:\n    ${jsonPath}\n    ${markdownPath}\n`,
  );
}, 180_000);
