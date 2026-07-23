import {
  computeRepresentativeHybridV1LiveExecutionTreeHash,
  computeCurrentRepresentativeHybridV1LiveExecutionTreeHash,
  REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS,
  RepresentativeHybridV1LiveExecutionTreeHashError,
} from '../RepresentativeHybridV1LiveExecutionTreeHash';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../../../../..');

describe('RESOLVER-V3-039 protocol-v2 execution-tree drift hash', () => {
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

  it('the tracked path list covers prompts, schemas, provider/pricing code, and the harness/report-builder logic', () => {
    const joined = REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS.join('\n');
    expect(joined).toContain('variantBPrompt.ts');
    expect(joined).toContain('variantCPrompt.ts');
    expect(joined).toContain('VariantBLiveProvider.ts');
    expect(joined).toContain('VariantCLiveInterpretationProvider.ts');
    expect(joined).toContain('RepresentativeHybridV1LiveExecutionPlan.ts');
    expect(joined).toContain('RepresentativeHybridV1LiveReportBuilder.ts');
    expect(joined).toContain('runRepresentativeHybridV1Live.harness.ts');
  });

  it('never includes generated logs/reports, so evidence artifacts added after freeze cannot trigger false drift', () => {
    for (const p of REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS) {
      expect(p.startsWith('logs/')).toBe(false);
      expect(p.startsWith('reports/')).toBe(false);
    }
  });
});
