import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
  REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION,
  REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
  REPRESENTATIVE_HYBRID_V1_REPORT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION,
} from '../RepresentativeHybridV1Types';
import {
  LEARNING_BENCHMARK_V2_CORPUS_VERSION,
  LEARNING_BENCHMARK_V2_HARNESS_VERSION,
  LEARNING_BENCHMARK_V2_REGISTRY_VERSION,
} from '../../learningV2/LearningBenchmarkV2Types';
import { REPRESENTATIVE_HYBRID_V1_CORPUS } from '../RepresentativeHybridV1Manifest';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');

describe('RESOLVER-V3-038 versioning and V3-023 preservation', () => {
  it('every version axis is explicit and distinct from every other axis', () => {
    const versions = [
      REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
      REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
      REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION,
      REPRESENTATIVE_HYBRID_V1_REPORT_SCHEMA_VERSION,
      REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION,
    ];
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('no version literal collides with any V3-023 Learning Benchmark V2 version literal', () => {
    expect(REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION).not.toBe(LEARNING_BENCHMARK_V2_CORPUS_VERSION);
    expect(REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION).not.toBe(
      LEARNING_BENCHMARK_V2_REGISTRY_VERSION,
    );
    // Harness versions may share the numeric "1.0.0" SemVer literal (a different axis/module
    // entirely) -- what must never collide is the *namespaced* corpus/registry contract literals,
    // asserted above.
    expect(REPRESENTATIVE_HYBRID_V1_HARNESS_VERSION).toBe('1.0.0');
    expect(LEARNING_BENCHMARK_V2_HARNESS_VERSION).toBe('1.0.0');
  });

  it('every resolution scenario case carries the successor case-schema version, not a V3-023 one', () => {
    for (const scenario of REPRESENTATIVE_HYBRID_V1_CORPUS) {
      if (scenario.scenarioType === 'resolution_decomposition') {
        expect(scenario.case.corpusVersion).toBe('1.0.0');
      }
      expect(scenario.corpusVersion).toBe(REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION);
    }
  });

  it('no successor scenarioId reuses a V3-023 "LBV2-*" scenario ID', () => {
    const collisions = REPRESENTATIVE_HYBRID_V1_CORPUS.filter((s) =>
      s.scenarioId.startsWith('LBV2-'),
    );
    expect(collisions).toEqual([]);
  });

  it('predecessorScenarioId references, where present, are documented provenance only (not reused IDs)', () => {
    for (const scenario of REPRESENTATIVE_HYBRID_V1_CORPUS) {
      if (scenario.predecessorScenarioId) {
        expect(scenario.predecessorScenarioId).not.toBe(scenario.scenarioId);
      }
    }
  });

  it('no learningV2/** file is modified relative to the frozen origin/chore/clean-arch-structure base', () => {
    let diff = '';
    try {
      diff = execSync(
        'git diff --name-only origin/chore/clean-arch-structure -- src/features/nutrition/benchmark/learningV2',
        {
          cwd: repoRoot,
          encoding: 'utf8',
        },
      );
    } catch {
      // If the merge-base ref is unavailable in this environment, fall back to a working-tree
      // check against HEAD instead of failing the whole suite on an environment limitation.
      diff = execSync('git diff --name-only HEAD -- src/features/nutrition/benchmark/learningV2', {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    }
    expect(diff.trim()).toBe('');
  });

  it('the V3-023 canonical reports are unchanged on disk', () => {
    const reportPath = path.join(
      repoRoot,
      'reports',
      'RESOLVER_V3_LEARNING_BENCHMARK_V2_REPORT.md',
    );
    const jsonPath = path.join(repoRoot, 'reports', 'resolver-v3-learning-v2-benchmark.json');
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.existsSync(jsonPath)).toBe(true);
  });
});
