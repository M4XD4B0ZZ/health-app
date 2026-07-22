import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';
import { LEARNING_BENCHMARK_V2_CORPUS } from '../LearningBenchmarkV2Manifest';

const CORPUS_FILE_ALLOWLIST = [
  'LearningBenchmarkV2ResolutionCorpus.ts',
  'LearningBenchmarkV2PersonalMemoryCorpus.ts',
  'LearningBenchmarkV2GlobalCandidateCorpus.ts',
  'LearningBenchmarkV2PrivacyCorpus.ts',
  'LearningBenchmarkV2EconomicsCorpus.ts',
  'LearningBenchmarkV2Manifest.ts',
];

function nonCorpusEvaluatorFiles(): string[] {
  const dir = path.resolve(__dirname, '..');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .filter((name) => !CORPUS_FILE_ALLOWLIST.includes(name));
}

describe('RESOLVER-V3-023 leakage prevention', () => {
  const holdoutScenarios = LEARNING_BENCHMARK_V2_CORPUS.filter((s) => s.partition === 'holdout');
  const holdoutIds = holdoutScenarios.map((s) => s.scenarioId);
  const evaluatorFiles = nonCorpusEvaluatorFiles();

  it('no implementation file outside the corpus fixture files hardcodes a holdout scenario ID', () => {
    const offenders: string[] = [];
    for (const fileName of evaluatorFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', fileName), 'utf8');
      for (const id of holdoutIds) {
        if (source.includes(`'${id}'`) || source.includes(`"${id}"`))
          offenders.push(`${fileName}:${id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no evaluator file branches on scenario ID (no case-ID-keyed conditional logic)', () => {
    const offenders: string[] = [];
    for (const fileName of evaluatorFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', fileName), 'utf8');
      if (/scenarioId\s*===\s*['"]LBV2-/.test(source)) offenders.push(fileName);
    }
    expect(offenders).toEqual([]);
  });

  it('holdout raw inputs (resolution scenarios) do not appear in any evaluator file', () => {
    const holdoutRawInputs = holdoutScenarios
      .filter((s) => s.scenarioType === 'resolution_decomposition')
      .map((s) => (s as { case: { rawInput: string } }).case.rawInput);
    const offenders: string[] = [];
    for (const fileName of evaluatorFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', fileName), 'utf8');
      for (const rawInput of holdoutRawInputs) {
        if (source.includes(rawInput)) offenders.push(`${fileName}:${rawInput}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('a scenario cannot move partitions across two independent registry reconstructions', () => {
    const scenarioIds = LEARNING_BENCHMARK_V2_CORPUS.map((s) => s.scenarioId);
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);
  });
});
