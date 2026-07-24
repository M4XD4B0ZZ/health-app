import * as path from 'node:path';
import { createHash } from 'node:crypto';
import {
  computeRepresentativeHybridV1LiveExecutionTreeHash,
  computeCurrentRepresentativeHybridV1LiveExecutionTreeHash,
  readRepresentativeHybridV1LiveExecutionTreeFiles,
  canonicalizeRepresentativeHybridV1LiveExecutionTreeText,
  REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS,
  REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_HASH_ALGORITHM_VERSION,
  RepresentativeHybridV1LiveExecutionTreeHashError,
} from '../RepresentativeHybridV1LiveExecutionTreeHash';

const repoRoot = path.resolve(__dirname, '../../../../../../..');

describe('RESOLVER-V3-039 protocol-v3 execution-tree drift hash', () => {
  it('is deterministic and independent of input ordering', () => {
    const files = [
      { path: 'b.ts', content: 'content-b' },
      { path: 'a.ts', content: 'content-a' },
    ];
    const h1 = computeRepresentativeHybridV1LiveExecutionTreeHash(files);
    const h2 = computeRepresentativeHybridV1LiveExecutionTreeHash([...files].reverse());
    expect(h1).toBe(h2);
  });

  it('changes when any single file content changes by one byte (code/prompt/schema/pricing drift)', () => {
    const files = [{ path: 'a.ts', content: 'const x = 1;' }];
    const drifted = [{ path: 'a.ts', content: 'const x = 2;' }];
    expect(computeRepresentativeHybridV1LiveExecutionTreeHash(files)).not.toBe(
      computeRepresentativeHybridV1LiveExecutionTreeHash(drifted),
    );
  });

  it('changes when a file is added or removed from the set, not just when content changes', () => {
    const files = [{ path: 'a.ts', content: 'x' }];
    const withExtra = [...files, { path: 'b.ts', content: 'y' }];
    expect(computeRepresentativeHybridV1LiveExecutionTreeHash(files)).not.toBe(
      computeRepresentativeHybridV1LiveExecutionTreeHash(withExtra),
    );
  });

  it('changes when only the path changes, content held constant', () => {
    const asA = [{ path: 'a.ts', content: 'same-content' }];
    const asB = [{ path: 'b.ts', content: 'same-content' }];
    expect(computeRepresentativeHybridV1LiveExecutionTreeHash(asA)).not.toBe(
      computeRepresentativeHybridV1LiveExecutionTreeHash(asB),
    );
  });

  it('CRLF and LF representations of the same logical text produce the same hash (core.autocrlf-independent)', () => {
    const lf = [{ path: 'a.ts', content: 'line1\nline2\nline3\n' }];
    const crlf = [{ path: 'a.ts', content: 'line1\r\nline2\r\nline3\r\n' }];
    const mixed = [{ path: 'a.ts', content: 'line1\r\nline2\nline3\r\n' }];
    const h = computeRepresentativeHybridV1LiveExecutionTreeHash(lf);
    expect(computeRepresentativeHybridV1LiveExecutionTreeHash(crlf)).toBe(h);
    expect(computeRepresentativeHybridV1LiveExecutionTreeHash(mixed)).toBe(h);
  });

  it('a lone CR (not part of a CRLF pair) fails closed rather than hashing malformed text', () => {
    const files = [{ path: 'a.ts', content: 'line1\rline2\n' }];
    expect(() => computeRepresentativeHybridV1LiveExecutionTreeHash(files)).toThrow(
      RepresentativeHybridV1LiveExecutionTreeHashError,
    );
  });

  it('canonicalizeRepresentativeHybridV1LiveExecutionTreeText normalizes CRLF and rejects a lone trailing CR', () => {
    expect(canonicalizeRepresentativeHybridV1LiveExecutionTreeText('a\r\nb', 'x.ts')).toBe('a\nb');
    expect(() => canonicalizeRepresentativeHybridV1LiveExecutionTreeText('a\rb', 'x.ts')).toThrow(
      RepresentativeHybridV1LiveExecutionTreeHashError,
    );
  });

  it('the real repository computation is stable across repeated calls (no non-determinism from fs read order)', () => {
    const a = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
    const b = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('throws if an execution-relevant file is missing rather than silently hashing a partial set', () => {
    expect(() =>
      computeCurrentRepresentativeHybridV1LiveExecutionTreeHash('/nonexistent-repo-root-xyz'),
    ).toThrow(RepresentativeHybridV1LiveExecutionTreeHashError);
  });

  it('changing any real tracked execution-tree file (simulated) invalidates the hash', () => {
    const realFiles = readRepresentativeHybridV1LiveExecutionTreeFiles(repoRoot);
    const baseline = computeRepresentativeHybridV1LiveExecutionTreeHash(realFiles);
    const mutated = realFiles.map((f, i) =>
      i === 0 ? { path: f.path, content: `${f.content}\n// drift-probe` } : f,
    );
    expect(computeRepresentativeHybridV1LiveExecutionTreeHash(mutated)).not.toBe(baseline);
  });

  it('simulated Windows CRLF checkout and canonical LF content reproduce the same hash from the real repository tree', () => {
    // Read the real files exactly as computeCurrentRepresentativeHybridV1LiveExecutionTreeHash
    // does (raw working-tree bytes, whatever this checkout's line endings happen to be), derive an
    // explicit canonical-LF baseline and an explicit CRLF-checkout variant from it, and prove both
    // reproduce the exact same value the real fs-backed computation produces -- the same proof PR
    // #137's test suite never performed.
    const realFiles = readRepresentativeHybridV1LiveExecutionTreeFiles(repoRoot);
    const lfBaseline = realFiles.map((f) => ({
      path: f.path,
      content: f.content.replace(/\r\n/g, '\n'),
    }));
    const crlfVariant = lfBaseline.map((f) => ({
      path: f.path,
      content: f.content.replace(/\n/g, '\r\n'),
    }));

    const fromRealFs = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
    const fromLf = computeRepresentativeHybridV1LiveExecutionTreeHash(lfBaseline);
    const fromCrlf = computeRepresentativeHybridV1LiveExecutionTreeHash(crlfVariant);

    expect(fromLf).toBe(fromRealFs);
    expect(fromCrlf).toBe(fromRealFs);
  });

  it('the algorithm version is included in the hashed payload (a future algorithm change cannot silently reproduce this hash)', () => {
    const files = [{ path: 'a.ts', content: 'x' }];
    const hash = computeRepresentativeHybridV1LiveExecutionTreeHash(files);
    // Recompute manually with a different algorithm tag using the same JSON shape; must differ.
    const alteredPayload = JSON.stringify({
      algorithmVersion: 'some-other-algorithm-version',
      files: [['a.ts', 'x']],
    });
    const altered = createHash('sha256').update(alteredPayload, 'utf-8').digest('hex');
    expect(hash).not.toBe(altered);
    expect(REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_HASH_ALGORITHM_VERSION).toBe(
      'representative-hybrid-v1-live-execution-tree-hash-algorithm-v3',
    );
  });

  it('the tracked path list covers prompts, schemas, provider/pricing/CLI code, and the harness/report-builder/validator/ledger-provider logic', () => {
    const joined = REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS.join('\n');
    expect(joined).toContain('variantBPrompt.ts');
    expect(joined).toContain('variantCPrompt.ts');
    expect(joined).toContain('VariantBLiveProvider.ts');
    expect(joined).toContain('VariantCLiveInterpretationProvider.ts');
    expect(joined).toContain('RepresentativeHybridV1LiveExecutionPlan.ts');
    expect(joined).toContain('RepresentativeHybridV1LiveReportBuilder.ts');
    expect(joined).toContain('RepresentativeHybridV1LiveReportValidator.ts');
    expect(joined).toContain('RepresentativeHybridV1LiveLedgerProviders.ts');
    expect(joined).toContain('LiveProviderUsage.ts');
    expect(joined).toContain('RepresentativeHybridV1LiveProtocolVerification.ts');
    expect(joined).toContain('RepresentativeHybridV1LiveExecutionTreeHash.ts');
    expect(joined).toContain('runRepresentativeHybridV1Live.harness.ts');
    expect(joined).toContain('benchmark-resolver-v3-representative-hybrid-live.mjs');
    expect(REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS.length).toBe(26);
  });

  it('never includes generated logs/reports, so evidence artifacts added after freeze cannot trigger false drift', () => {
    for (const p of REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS) {
      expect(p.startsWith('logs/')).toBe(false);
      expect(p.startsWith('reports/')).toBe(false);
    }
  });
});
