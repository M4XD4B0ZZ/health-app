import * as fs from 'fs';
import * as path from 'path';
import { test } from '@jest/globals';
import { runLearningBenchmarkV2 } from './runLearningBenchmarkV2';
import {
  buildLearningBenchmarkV2HumanReport,
  buildLearningBenchmarkV2MachineReport,
} from './buildLearningBenchmarkV2Reports';

/**
 * RESOLVER-V3-023 canonical execution entry point, mirroring the Variant A/B/C `.harness.ts`
 * convention exactly: deliberately NOT named `*.test.ts` and NOT inside `__tests__`, so it is
 * invisible to the default `jest.config.js` `testMatch` and therefore to `npm run test`/
 * `npm run verify`. Executed only via `scripts/benchmark-resolver-v3-learning-v2.mjs`, which points
 * Jest's `--testMatch` at this exact file. Reads partition/case selection from env vars
 * (`LEARNING_BENCHMARK_V2_PARTITION`, `LEARNING_BENCHMARK_V2_CASES`) since Jest's CLI does not
 * forward custom flags through a scoped test file -- the same reason the existing Variant B/C
 * harnesses do this.
 *
 * Never asserts business/system correctness -- `runLearningBenchmarkV2()` only throws on invalid
 * corpus/registry/harness-level failures (see its own docstring). A "bad" system verdict is written
 * into the report and does not fail this test.
 */
test('RESOLVER-V3-023 — Learning Benchmark V2 harness', async () => {
  const rawPartition = process.env.LEARNING_BENCHMARK_V2_PARTITION;
  const partition =
    rawPartition === 'holdout' || rawPartition === 'all' || rawPartition === 'development'
      ? rawPartition
      : 'development';
  const scenarioIds = process.env.LEARNING_BENCHMARK_V2_CASES
    ? process.env.LEARNING_BENCHMARK_V2_CASES.split(',').map((id: string) => id.trim())
    : undefined;

  const result = await runLearningBenchmarkV2({ partition, scenarioIds });
  const machineReport = buildLearningBenchmarkV2MachineReport(result);
  const humanReport = buildLearningBenchmarkV2HumanReport(result);

  const outputDir = path.resolve(__dirname, '../../../../../logs');
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'resolver-v3-learning-v2-benchmark.json');
  const markdownPath = path.join(outputDir, 'resolver-v3-learning-v2-benchmark.md');
  fs.writeFileSync(jsonPath, JSON.stringify(machineReport, null, 2));
  fs.writeFileSync(markdownPath, humanReport);

  // eslint-disable-next-line no-console
  console.log(
    `\nRESOLVER-V3-023 Learning Benchmark V2 complete.\n` +
      `  Partitions run: ${result.partitionsRun.join(', ')}\n` +
      `  System verdict: ${machineReport.systemVerdict}\n` +
      `  Failed invariants: ${machineReport.failedInvariantCount}\n` +
      `  Not-evaluable invariants: ${machineReport.notEvaluableInvariantCount}\n` +
      `  Reports written to:\n    ${jsonPath}\n    ${markdownPath}\n`,
  );
}, 120_000);
