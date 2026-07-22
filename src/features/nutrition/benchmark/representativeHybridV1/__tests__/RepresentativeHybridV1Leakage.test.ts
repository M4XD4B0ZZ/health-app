import fs from 'fs';
import path from 'path';
import { REPRESENTATIVE_HYBRID_V1_CORPUS } from '../RepresentativeHybridV1Manifest';

const CORPUS_FILE_ALLOWLIST = [
  'RepresentativeHybridV1SimpleCorpus.ts',
  'RepresentativeHybridV1HouseholdCorpus.ts',
  'RepresentativeHybridV1DachCorpus.ts',
  'RepresentativeHybridV1BrandedCorpus.ts',
  'RepresentativeHybridV1ComposedCorpus.ts',
  'RepresentativeHybridV1HomemadeCorpus.ts',
  'RepresentativeHybridV1RestaurantCorpus.ts',
  'RepresentativeHybridV1VagueCorpus.ts',
  'RepresentativeHybridV1PreparationCorpus.ts',
  'RepresentativeHybridV1NegationModifierCorpus.ts',
  'RepresentativeHybridV1UnreliableCorpus.ts',
  'RepresentativeHybridV1RepeatOverlayCorpus.ts',
  'RepresentativeHybridV1GovernanceCorpus.ts',
  'RepresentativeHybridV1Manifest.ts',
  'RepresentativeHybridV1CaseHelpers.ts',
  'RepresentativeHybridV1SourceSnapshotManifest.ts',
];

function nonCorpusImplementationFiles(): string[] {
  const dir = path.resolve(__dirname, '..');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .filter((name) => !CORPUS_FILE_ALLOWLIST.includes(name));
}

describe('RESOLVER-V3-038 holdout leakage prevention', () => {
  const holdoutScenarios = REPRESENTATIVE_HYBRID_V1_CORPUS.filter((s) => s.partition === 'holdout');
  const holdoutIds = holdoutScenarios.map((s) => s.scenarioId);
  const implementationFiles = nonCorpusImplementationFiles();

  it('no implementation file outside the corpus fixture files hardcodes a holdout scenario ID', () => {
    const offenders: string[] = [];
    for (const fileName of implementationFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', fileName), 'utf8');
      for (const id of holdoutIds) {
        if (source.includes(`'${id}'`) || source.includes(`"${id}"`))
          offenders.push(`${fileName}:${id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no evaluator/runner file branches on scenario ID (no case-ID-keyed conditional logic)', () => {
    const offenders: string[] = [];
    for (const fileName of implementationFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', fileName), 'utf8');
      if (/scenarioId\s*===\s*['"]RH-RES-/.test(source)) offenders.push(fileName);
    }
    expect(offenders).toEqual([]);
  });

  it('holdout raw inputs (resolution scenarios) do not appear in any non-corpus implementation file', () => {
    const holdoutRawInputs = holdoutScenarios
      .filter((s) => s.scenarioType === 'resolution_decomposition')
      .map((s) => (s as { case: { rawInput: string } }).case.rawInput);
    const offenders: string[] = [];
    for (const fileName of implementationFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', fileName), 'utf8');
      for (const rawInput of holdoutRawInputs) {
        if (source.includes(rawInput)) offenders.push(`${fileName}:${rawInput}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no implementation file hardcodes a holdout expected source ID', () => {
    const holdoutSourceIds = holdoutScenarios
      .filter((s) => s.scenarioType === 'resolution_decomposition')
      .flatMap(
        (s) =>
          (s as { case: { expectedComponents: { expectedSourceId?: string }[] } }).case
            .expectedComponents,
      )
      .map((c) => c.expectedSourceId)
      .filter((id): id is string => Boolean(id));
    const offenders: string[] = [];
    for (const fileName of implementationFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', fileName), 'utf8');
      for (const sourceId of holdoutSourceIds) {
        if (source.includes(`'${sourceId}'`) || source.includes(`"${sourceId}"`)) {
          offenders.push(`${fileName}:${sourceId}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('a scenario ID never appears twice in the corpus (no accidental duplicate/typo collision)', () => {
    const scenarioIds = REPRESENTATIVE_HYBRID_V1_CORPUS.map((s) => s.scenarioId);
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);
  });
});
