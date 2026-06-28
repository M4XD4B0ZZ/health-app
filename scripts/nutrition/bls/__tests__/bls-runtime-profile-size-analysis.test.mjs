import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFILE_NAMES,
  buildLookupIndex,
  parseBenchmarkArgs,
  runBlsRuntimeProfileBenchmark,
  stableJsonBytes,
} from '../lib/bls-runtime-profile-size-analysis.mjs';

const HEADERS = [
  'BLS Code',
  'Lebensmittelbezeichnung',
  'Food name',
  'ENERCC Kilokalorien',
  'ENERCC Datenherkunft',
  'ENERCC Referenz',
  'PROT625 Eiweiß',
  'PROT625 Datenherkunft',
  'PROT625 Referenz',
  'FAT Fett',
  'FAT Datenherkunft',
  'FAT Referenz',
  'CHO Kohlenhydrate',
  'CHO Datenherkunft',
  'CHO Referenz',
  'ENERCJ Kilojoule',
  'WATER Wasser',
  'FIBT Ballaststoffe',
  'SUGAR Zucker',
  'STARCH Stärke',
  'ALC Alkohol',
  'NACL Salz',
  'NA Natrium',
  'FASAT Gesättigte Fettsäuren',
  'FAMS Einfach ungesättigte Fettsäuren',
  'FAPU Mehrfach ungesättigte Fettsäuren',
  'FAPUN3 Omega 3',
  'FAPUN6 Omega 6',
  'CHORL Cholesterin',
];

function row(overrides = {}) {
  return [
    overrides.blsCode ?? 'M713100',
    overrides.germanName ?? 'Speisequark, Magerstufe',
    overrides.englishName ?? 'Low fat curd',
    overrides.kcal ?? '66',
    'calc',
    'ref-kcal',
    overrides.protein ?? '11,85',
    'calc',
    'ref-protein',
    overrides.fat ?? '0,18',
    'calc',
    'ref-fat',
    overrides.carbs ?? '3,68',
    'calc',
    'ref-carbs',
    overrides.energyKj ?? '276',
    overrides.waterG ?? '80,1',
    '0',
    '3,68',
    '0',
    '0',
    '0,1',
    '40',
    '0,12',
    '0,04',
    '0,02',
    '0',
    '0',
    '5',
  ];
}

function fixtureRows() {
  return [HEADERS, row(), row({ blsCode: 'B314000', germanName: 'Weizentoastbrot', englishName: 'Wheat toast' })];
}

describe('runtime profile benchmark args', () => {
  it('requires a read-only mode and accepts limit/full/profile', () => {
    assert.throws(() => parseBenchmarkArgs(['node', 'cli']), /mode is required/);
    assert.deepEqual(parseBenchmarkArgs(['node', 'cli', '--limit', '2']).mode, 'bounded-probe');
    assert.deepEqual(parseBenchmarkArgs(['node', 'cli', '--limit=2']).limit, 2);
    assert.deepEqual(parseBenchmarkArgs(['node', 'cli', '--full-readonly']).mode, 'full-readonly');
    assert.deepEqual(parseBenchmarkArgs(['node', 'cli', '--limit', '1', '--profile', 'ultra-lite']).profile, 'ultra-lite');
  });

  it('refuses mutation flags, output paths, unknown flags, and positional paths', () => {
    for (const args of [
      ['--limit', '1', '--write'],
      ['--limit', '1', '--output', 'x.json'],
      ['--limit', '1', '--out=x.json'],
      ['--limit', '1', '-o'],
      ['--limit', '1', '--stage'],
      ['--limit', '1', '--commit'],
      ['--limit', '1', '--push'],
      ['--limit', '1', '--deploy'],
      ['--limit', '1', '--fix'],
      ['--limit', '1', '--format'],
      ['--limit', '1', 'out.json'],
      ['--limit', '1', '--unknown'],
    ]) {
      assert.throws(() => parseBenchmarkArgs(['node', 'cli', ...args]), /refused|Unknown|Positional/);
    }
  });
});

describe('runtime profile benchmark output', () => {
  it('benchmarks every requested profile without emitting records at top level', () => {
    const result = runBlsRuntimeProfileBenchmark(fixtureRows(), {
      mode: 'bounded-probe',
      limit: 2,
      dataWorkbookPath: 'fixture.xlsx',
      sourceWorkbookSha256: 'sha-fixture',
    });

    assert.equal(result.ok, true);
    assert.equal(result.writesFiles, false);
    assert.equal(result.generatesArtifacts, false);
    assert.equal(result.source.selectedRecordCount, 2);
    assert.deepEqual(
      result.profiles.map((profile) => profile.profile),
      PROFILE_NAMES,
    );
    assert.equal(Object.hasOwn(result, 'records'), false);

    for (const profile of result.profiles) {
      assert.equal(typeof profile.storage.jsonBytes, 'number');
      assert.equal(typeof profile.storage.gzipBytes, 'number');
      assert.equal(typeof profile.storage.brotliBytes, 'number');
      assert.equal(typeof profile.runtime.jsonParseMs, 'number');
      assert.equal(typeof profile.runtime.lookupIndexBuildMs, 'number');
      assert.equal(typeof profile.memory.heapBeforeParseBytes, 'number');
      assert.equal(typeof profile.architecture.runtimeComplexity, 'string');
      assert.equal(typeof profile.recommendation.keepCandidate, 'boolean');
    }
  });

  it('defines expected Tier2 and token policies for core profiles', () => {
    const result = runBlsRuntimeProfileBenchmark(fixtureRows(), { mode: 'bounded-probe', limit: 2 });
    const byName = Object.fromEntries(result.profiles.map((profile) => [profile.profile, profile]));

    assert.equal(byName['object-runtime'].definition.tier2Included, true);
    assert.equal(byName['object-runtime'].definition.tokensIncluded, false);
    assert.equal(byName['object-runtime-tier1'].definition.tier2Included, false);
    assert.equal(byName['tuple-runtime'].definition.tier2Included, true);
    assert.equal(byName['tuple-runtime-tier1'].definition.tier2Included, false);
    assert.equal(byName['split-runtime'].definition.aliasesIncluded, true);
    assert.equal(byName['split-runtime'].definition.tokensIncluded, false);
    assert.equal(byName['ultra-lite'].definition.excludedFields.includes('optionalMetadata'), true);
  });

  it('supports focused single-profile benchmark and deterministic JSON helper', () => {
    const result = runBlsRuntimeProfileBenchmark(fixtureRows(), {
      mode: 'bounded-probe',
      limit: 1,
      profile: 'ultra-lite',
    });

    assert.deepEqual(result.profiles.map((profile) => profile.profile), ['ultra-lite']);
    assert.equal(stableJsonBytes({ a: 1 }), '{"a":1}\n');
  });

  it('builds lookup indexes for object, tuple, and split payloads', () => {
    const objectIndex = buildLookupIndex({
      records: [{ id: 'bls-a', sourceId: 'A', displayName: 'Apfel frisch', macrosPer100g: { kcal: 1, protein: 1, fat: 1, carbs: 1 } }],
    });
    const tupleIndex = buildLookupIndex({
      columns: ['id', 'sourceId', 'displayName', 'kcal', 'protein', 'fat', 'carbs'],
      records: [['bls-b', 'B', 'Birne frisch', 1, 1, 1, 1]],
    });
    const splitIndex = buildLookupIndex({
      foodsColumns: ['id', 'sourceId', 'kcal', 'protein', 'fat', 'carbs'],
      foods: [['bls-c', 'C', 1, 1, 1, 1]],
      searchIndex: [[0, 'Clementine frisch', ['clementine frisch'], 'clementine frisch']],
    });

    assert.equal(objectIndex.byIdSize, 1);
    assert.equal(tupleIndex.bySourceIdSize, 1);
    assert.equal(splitIndex.searchTermCount >= 1, true);
  });
});
