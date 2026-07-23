import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * RESOLVER-V3-039 protocol-v2 remediation (Defect 7, "drift checking"): a deterministic content
 * hash over every execution-relevant source file that is NOT already covered by the existing
 * corpus/source-manifest/plan hashes -- prompts, schemas, the live provider/pricing/transport code,
 * route-classification/execution-plan/metrics/threshold logic, and the harness/report-builder code
 * itself. This is deliberately a hash over file *content*, not a literal git-SHA-equality check
 * against the historical freeze commit, because generated evidence files (logs/reports) must be
 * addable after freeze without falsely triggering drift -- exactly the task's stated requirement:
 * "Do not require the current commit SHA to equal the old freeze commit literally if generated
 * evidence files must be added afterward. Instead pin and verify a deterministic execution-code/
 * tree boundary."
 *
 * Any change to a listed file changes this hash, which invalidates continuation before any Holdout
 * call runs (checked by `RepresentativeHybridV1LiveCheckpoint.ts`'s validator). The corpus/registry/
 * route-classification/execution-plan itself is still separately covered by the existing
 * `corpusHash`/`sourceManifestHash`/`planHash` fields -- this hash's job is the surrounding
 * *execution logic* those three don't cover.
 */

export const REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS: readonly string[] = [
  'src/features/nutrition/benchmark/variantBPrompt.ts',
  'src/features/nutrition/benchmark/variantCPrompt.ts',
  'src/features/nutrition/benchmark/validateVariantCInterpretationResponse.ts',
  'src/features/nutrition/benchmark/VariantBLiveProvider.ts',
  'src/features/nutrition/benchmark/VariantCLiveInterpretationProvider.ts',
  'src/features/nutrition/benchmark/LiveProviderBudgetGate.ts',
  'src/features/nutrition/benchmark/AnthropicBenchmarkTransport.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveExecutionPlan.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveVersions.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveMetrics.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveBudget.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveRunner.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveReportBuilder.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveTimeout.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveTelemetryProviders.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCallId.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCallLedger.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCumulativeBudget.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCheckpoint.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/runRepresentativeHybridV1Live.harness.ts',
] as const;

export interface RepresentativeHybridV1LiveExecutionTreeFile {
  readonly path: string;
  readonly content: string;
}

/** Pure function: hashes an explicit list of (path, content) pairs. Sorted by path first, so file
 * read order never affects the result. Exported directly so tests can exercise the hashing logic
 * without touching the real filesystem. */
export function computeRepresentativeHybridV1LiveExecutionTreeHash(
  files: readonly RepresentativeHybridV1LiveExecutionTreeFile[],
): string {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const canonical = JSON.stringify(sorted.map((f) => [f.path, f.content]));
  return createHash('sha256').update(canonical).digest('hex');
}

export class RepresentativeHybridV1LiveExecutionTreeHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveExecutionTreeHashError';
  }
}

/** Reads the real, current content of every execution-relevant file from disk and hashes it.
 * Throws if any listed file is missing -- an execution-relevant file disappearing is itself drift,
 * never silently skipped. */
export function computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(
  repoRoot: string,
): string {
  const files = REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS.map((relativePath) => {
    const absolute = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolute)) {
      throw new RepresentativeHybridV1LiveExecutionTreeHashError(
        `Execution-relevant file missing: ${relativePath}. Refusing to compute a tree hash over an incomplete file set.`,
      );
    }
    return { path: relativePath, content: fs.readFileSync(absolute, 'utf-8') };
  });
  return computeRepresentativeHybridV1LiveExecutionTreeHash(files);
}
