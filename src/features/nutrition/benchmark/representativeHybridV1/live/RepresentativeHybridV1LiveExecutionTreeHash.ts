import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * RESOLVER-V3-039 protocol-v3 remediation (`reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md`):
 * a deterministic, cross-platform content hash over every execution-relevant source file the
 * corpus/source-manifest/plan hash triad does not already cover -- prompts, schemas, the live
 * provider/pricing/transport code, the CLI entry point, and the harness/report-builder/validator/
 * ledger/metrics logic itself (`REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS`).
 *
 * Protocol v2's hash (`9c3da0fed1ae33d66bf6a9499f679ce67829c80e054d0fd180e2e4a65fcd5b9e`) was found
 * non-reproducible: it matched neither a canonical LF Git-content computation over the committed
 * freeze-commit tree nor this Windows checkout's CRLF working-tree computation. Root cause (full
 * analysis in the remediation report): the v2 implementation read working-tree files verbatim
 * (`fs.readFileSync(path, 'utf-8')`) with **no line-ending normalization**, so its result depends on
 * `core.autocrlf` and the checkout platform; no test ever compared the computed value against the
 * frozen protocol literal (`RepresentativeHybridV1LiveExecutionTreeHash.test.ts` only asserted
 * self-consistency and `length === 64`), so a stale or platform-specific literal could never have
 * been caught. This v3 implementation fixes both defects: content is canonicalized (CRLF -> LF,
 * fail-closed on lone CR) before hashing, independent of `core.autocrlf`/OS, and the regression
 * suite added alongside this file asserts the frozen v3 literal equals a fresh computation over the
 * real repository tree (the exact check PR #137 was missing).
 */

export const REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS: readonly string[] = [
  'src/features/nutrition/benchmark/variantBPrompt.ts',
  'src/features/nutrition/benchmark/variantCPrompt.ts',
  'src/features/nutrition/benchmark/validateVariantCInterpretationResponse.ts',
  'src/features/nutrition/benchmark/VariantBLiveProvider.ts',
  'src/features/nutrition/benchmark/VariantCLiveInterpretationProvider.ts',
  'src/features/nutrition/benchmark/LiveProviderBudgetGate.ts',
  'src/features/nutrition/benchmark/LiveProviderUsage.ts',
  'src/features/nutrition/benchmark/AnthropicBenchmarkTransport.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveExecutionPlan.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveVersions.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveMetrics.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveBudget.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveRunner.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveReportBuilder.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveReportValidator.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveTimeout.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveTelemetryProviders.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCallId.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCallLedger.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveLedgerProviders.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCumulativeBudget.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCheckpoint.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveProtocolVerification.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveExecutionTreeHash.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/runRepresentativeHybridV1Live.harness.ts',
  'scripts/benchmark-resolver-v3-representative-hybrid-live.mjs',
] as const;

/**
 * v2 tracked 20 paths and omitted `RepresentativeHybridV1LiveLedgerProviders.ts` (writes ledger
 * entries before/after every dispatched call -- directly execution-relevant),
 * `RepresentativeHybridV1LiveReportValidator.ts` (gates every persisted report),
 * `LiveProviderUsage.ts` (cost/usage aggregation feeding gate verdicts), and the CLI entry point
 * itself (`scripts/benchmark-resolver-v3-representative-hybrid-live.mjs`, which selects the
 * partition/mode and refuses `--partition=all`/`--allow-rerun`). All four are execution-relevant and
 * are added here. This file and `RepresentativeHybridV1LiveProtocolVerification.ts` are now also
 * tracked -- safe (neither embeds its own hash literal, so there is no fixed-point/self-reference),
 * and closes the v2 gap where a change to the hashing algorithm or the protocol-version gate itself
 * would not have moved the hash it is supposed to be gated by.
 */

/** Bumped whenever the canonicalization algorithm itself changes, and included in the hashed
 * payload -- so even identical file content hashes differently across algorithm versions, and the
 * hash can never be reproduced by accident from a different (e.g. pre-normalization) implementation. */
export const REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_HASH_ALGORITHM_VERSION =
  'representative-hybrid-v1-live-execution-tree-hash-algorithm-v3';

export interface RepresentativeHybridV1LiveExecutionTreeFile {
  readonly path: string;
  readonly content: string;
}

export class RepresentativeHybridV1LiveExecutionTreeHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveExecutionTreeHashError';
  }
}

/**
 * Canonicalizes text before hashing: CRLF -> LF, then fails closed if any lone CR remains (a CR not
 * part of a CRLF pair -- old Mac-style or malformed/binary-corrupted text). This is what makes the
 * hash independent of `core.autocrlf`/checkout platform: a Windows checkout with CRLF-converted
 * working-tree files and a Linux/macOS checkout with LF-only files normalize to byte-identical
 * canonical text before hashing.
 */
export function canonicalizeRepresentativeHybridV1LiveExecutionTreeText(
  content: string,
  filePathForError: string,
): string {
  const normalized = content.replace(/\r\n/g, '\n');
  if (normalized.includes('\r')) {
    throw new RepresentativeHybridV1LiveExecutionTreeHashError(
      `Execution-relevant file "${filePathForError}" contains a lone CR (not part of a CRLF pair) after CRLF normalization. Refusing to hash malformed/non-canonical text.`,
    );
  }
  return normalized;
}

/** Pure function: hashes an explicit list of (path, content) pairs after canonicalizing every
 * file's content. Sorted by path first, so file read/input order never affects the result. Exported
 * directly so tests can exercise the hashing logic (including CRLF/LF equivalence and lone-CR
 * fail-closed behavior) without touching the real filesystem. */
export function computeRepresentativeHybridV1LiveExecutionTreeHash(
  files: readonly RepresentativeHybridV1LiveExecutionTreeFile[],
): string {
  const canonicalized = files.map((f) => ({
    path: f.path,
    content: canonicalizeRepresentativeHybridV1LiveExecutionTreeText(f.content, f.path),
  }));
  const sorted = [...canonicalized].sort((a, b) => a.path.localeCompare(b.path));
  const canonical = JSON.stringify({
    algorithmVersion: REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_HASH_ALGORITHM_VERSION,
    files: sorted.map((f) => [f.path, f.content]),
  });
  return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/** Reads the real, current content of every execution-relevant file from disk (working-tree read --
 * no normalization at this step; `computeRepresentativeHybridV1LiveExecutionTreeHash` normalizes).
 * Throws if any listed file is missing -- an execution-relevant file disappearing is itself drift,
 * never silently skipped. Never shells out to Git: reproducible from a plain checkout with no `.git`
 * directory present (e.g. an extracted archive or a CI artifact), on Windows, Linux, or macOS. */
export function readRepresentativeHybridV1LiveExecutionTreeFiles(
  repoRoot: string,
): RepresentativeHybridV1LiveExecutionTreeFile[] {
  return REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS.map((relativePath) => {
    const absolute = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolute)) {
      throw new RepresentativeHybridV1LiveExecutionTreeHashError(
        `Execution-relevant file missing: ${relativePath}. Refusing to compute a tree hash over an incomplete file set.`,
      );
    }
    return { path: relativePath, content: fs.readFileSync(absolute, 'utf-8') };
  });
}

/** Reads and hashes the current working tree in one step -- the function the live harness calls
 * before every Development/Holdout run (never at CLI-flag-parse time, so it costs nothing on the
 * `--preflight` path either, since preflight also calls this). */
export function computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(
  repoRoot: string,
): string {
  return computeRepresentativeHybridV1LiveExecutionTreeHash(
    readRepresentativeHybridV1LiveExecutionTreeFiles(repoRoot),
  );
}
