import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  canonicalizeRepresentativeHybridV1LiveExecutionTreeText,
  computeRepresentativeHybridV1LiveExecutionTreeHash,
  REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_HASH_ALGORITHM_VERSION,
  RepresentativeHybridV1LiveExecutionTreeHashError,
  type RepresentativeHybridV1LiveExecutionTreeFile,
} from '../representativeHybridV1/live/RepresentativeHybridV1LiveExecutionTreeHash';

/**
 * RESOLVER-V3-048 Phase-A post-merge remediation, Part 3 ("Tatsächliche Hashautorität" / Evaluator).
 *
 * The PR #190 merge's `plan.evaluator.hash` was `hashProtocolV4({version, authority: 'RESOLVER-V3-042'})`
 * -- a hash of a self-declared label, never of the actual corrected-G2-evaluator code. Any byte or
 * logic change to the real evaluator files would leave that hash completely unchanged.
 *
 * The corrected G2 evaluator (RESOLVER-V3-042) is not a single file named "*evaluator*" -- it is the
 * gate-dimension computation code in `RepresentativeHybridV1LiveMetrics.ts` (per-dimension G2-A..G2-G
 * metric functions, including the RESOLVER-V3-042 fixes: category-specific G2-A instead of a blended
 * rate, the real Variant-C technical-failure predicate, and the real per-scenario G2-G consistency
 * rate) and `RepresentativeHybridV1LiveReportBuilder.ts` (which wires those corrected metrics into
 * the persisted gate verdicts). Both are confirmed by `reports/RESOLVER_V3_042_GATE_EVALUATOR_FIDELITY_AUDIT.md`.
 *
 * Per the task's explicit "Wo bereits kanonische, verifizierte Hashes existieren, nutze diese statt
 * sie neu und abweichend zu definieren" instruction, this module does not invent a new hashing
 * algorithm: it reuses `computeRepresentativeHybridV1LiveExecutionTreeHash` /
 * `canonicalizeRepresentativeHybridV1LiveExecutionTreeText` verbatim (RESOLVER-V3-039's own
 * cross-platform-reproducible, CRLF-normalizing, path-sorted content hash), scoped to exactly the two
 * canonical evaluator files, over real git-checked-out file content read from disk -- never a label,
 * a version string, or a free-form description.
 */

export const PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS: readonly string[] = [
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveMetrics.ts',
  'src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveReportBuilder.ts',
] as const;

export { REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_HASH_ALGORITHM_VERSION as PROTOCOL_V4_EVALUATOR_HASH_ALGORITHM_VERSION };

export class ProtocolV4EvaluatorManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolV4EvaluatorManifestError';
  }
}

/** Reads the real, current content of every canonical evaluator file from disk. Throws if any listed
 * file is missing -- an evaluator file disappearing is drift, never silently skipped. */
export function readProtocolV4EvaluatorManifestFiles(
  repoRoot: string,
): RepresentativeHybridV1LiveExecutionTreeFile[] {
  return PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS.map((relativePath) => {
    const absolute = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolute)) {
      throw new ProtocolV4EvaluatorManifestError(
        `PROTOCOL_V4_EVALUATOR_MANIFEST_FILE_MISSING: ${relativePath}`,
      );
    }
    return { path: relativePath, content: fs.readFileSync(absolute, 'utf-8') };
  });
}

/** Computes the real evaluator manifest hash from actual file content on disk. Any byte or logic
 * change to either canonical evaluator file changes this hash. */
export function computeProtocolV4EvaluatorManifestHash(repoRoot: string): string {
  return computeRepresentativeHybridV1LiveExecutionTreeHash(
    readProtocolV4EvaluatorManifestFiles(repoRoot),
  );
}

/** Pure variant for tests: hashes an explicit (path, content) list without touching the filesystem,
 * proving the function is sensitive to content rather than to a label. Reuses the exact same
 * canonicalization/hash routine as the disk-reading path above. */
export function computeProtocolV4EvaluatorManifestHashFromFiles(
  files: readonly RepresentativeHybridV1LiveExecutionTreeFile[],
): string {
  return computeRepresentativeHybridV1LiveExecutionTreeHash(files);
}

export {
  canonicalizeRepresentativeHybridV1LiveExecutionTreeText,
  RepresentativeHybridV1LiveExecutionTreeHashError,
};
