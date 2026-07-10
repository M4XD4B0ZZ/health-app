import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../generate-bls-sample-records.mjs';
import {
  COMPONENT_TIERS,
  DEFAULT_LIMIT,
  TIER_1_COMPONENTS,
  TIER_2_COMPONENTS,
  buildBlsSampleRecords,
  buildColumnMap,
  mapBlsRowToSampleRecord,
  normalizeBlsName,
  parseBlsNumber,
  tokenizeBlsNames,
} from '../lib/bls-sample-generator.mjs';

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
  'FAPUN3 Omega-3-Fettsäuren',
  'FAPUN6 Omega-6-Fettsäuren',
  'CHORL Cholesterin',
];

function row(overrides = {}) {
  return [
    overrides.blsCode ?? 'M713100',
    overrides.germanName ?? 'Äpfel süß / Speisequark, Magerstufe',
    overrides.englishName ?? 'Sweet apples curd',
    overrides.kcal ?? '66,1234',
    'calc',
    'ref-kcal',
    overrides.protein ?? 11.85,
    'calc',
    'ref-protein',
    overrides.fat ?? '0,18',
    'calc',
    'ref-fat',
    overrides.carbs ?? '3.68',
    'calc',
    'ref-carbs',
    overrides.energyKj ?? '276,7',
    overrides.waterG ?? '80,1',
    overrides.fiberG ?? '1,2',
    overrides.sugarG ?? '2,3',
    overrides.starchG ?? '1,1',
    overrides.alcoholG ?? '0',
    overrides.saltG ?? '0,04',
    overrides.sodiumMg ?? '16',
    overrides.saturatedFatG ?? '0,05',
    overrides.monounsaturatedFatG ?? '0,06',
    overrides.polyunsaturatedFatG ?? '0,07',
    overrides.omega3G ?? '0,01',
    overrides.omega6G ?? '0,02',
    overrides.cholesterolMg ?? '5',
  ];
}

describe('bls-sample-generator pure helpers', () => {
  it('defines deterministic Tier 1 required and Tier 2 optional component policy', () => {
    assert.deepEqual(
      TIER_1_COMPONENTS.map(({ componentCode }) => componentCode),
      ['ENERCC', 'PROT625', 'FAT', 'CHO'],
    );
    assert.deepEqual(
      TIER_2_COMPONENTS.map(({ componentCode }) => componentCode),
      [
        'ENERCJ',
        'WATER',
        'FIBT',
        'SUGAR',
        'STARCH',
        'ALC',
        'NACL',
        'NA',
        'FASAT',
        'FAMS',
        'FAPU',
        'FAPUN3',
        'FAPUN6',
        'CHORL',
      ],
    );
    assert.equal(COMPONENT_TIERS.tier1Required, TIER_1_COMPONENTS);
    assert.equal(COMPONENT_TIERS.tier2Optional, TIER_2_COMPONENTS);
  });

  it('normalizes German names deterministically', () => {
    assert.equal(normalizeBlsName(' Äpfel süß / Öl (10 %)  '), 'aepfel suess oel 10');
    assert.equal(normalizeBlsName(null), '');
    assert.deepEqual(tokenizeBlsNames('Äpfel süß', 'Sweet apples'), [
      'aepfel',
      'suess',
      'sweet',
      'apples',
    ]);
  });

  it('parses numbers, German decimal strings, and invalid values explicitly', () => {
    assert.deepEqual(parseBlsNumber(1), { ok: true, value: 1, raw: 1 });
    assert.deepEqual(parseBlsNumber(0), { ok: true, value: 0, raw: 0 });
    assert.deepEqual(parseBlsNumber('1,25'), { ok: true, value: 1.25, raw: '1,25' });
    assert.deepEqual(parseBlsNumber(' 1.25 '), { ok: true, value: 1.25, raw: ' 1.25 ' });
    assert.deepEqual(parseBlsNumber('-'), { ok: false, reason: 'dash', raw: '-' });
    assert.deepEqual(parseBlsNumber(''), { ok: false, reason: 'missing', raw: '' });
    assert.deepEqual(parseBlsNumber(null), { ok: false, reason: 'missing', raw: null });
    assert.deepEqual(parseBlsNumber('abc'), { ok: false, reason: 'invalid', raw: 'abc' });
    assert.deepEqual(parseBlsNumber(Infinity), {
      ok: false,
      reason: 'non_finite',
      raw: Infinity,
    });
  });

  it('maps a tiny in-memory BLS row to the requested sample record schema', () => {
    const columnMap = buildColumnMap(HEADERS);
    const mapped = mapBlsRowToSampleRecord(row(), columnMap, {
      sourceRowIndex: 1,
      sourceWorkbookSha256: 'sha-fixture',
    });

    assert.equal(mapped.ok, true);
    assert.equal(mapped.record.id, 'bls-m713100');
    assert.equal(mapped.record.blsCode, 'M713100');
    assert.equal(mapped.record.names.de, 'Äpfel süß / Speisequark, Magerstufe');
    assert.equal(mapped.record.names.en, 'Sweet apples curd');
    assert.equal(mapped.record.normalizedName, 'aepfel suess speisequark magerstufe');
    assert.deepEqual(mapped.record.aliases, [
      'aepfel suess speisequark magerstufe',
      'sweet apples curd',
    ]);
    assert.ok(mapped.record.tokens.includes('speisequark'));
    assert.deepEqual(mapped.record.macrosPer100g, {
      kcal: 66.123,
      protein: 11.85,
      carbs: 3.68,
      fat: 0.18,
    });
    assert.deepEqual(mapped.record.nutrientsPer100g, {
      energyKj: 276.7,
      waterG: 80.1,
      fiberG: 1.2,
      sugarG: 2.3,
      starchG: 1.1,
      alcoholG: 0,
      saltG: 0.04,
      sodiumMg: 16,
      saturatedFatG: 0.05,
      monounsaturatedFatG: 0.06,
      polyunsaturatedFatG: 0.07,
      omega3G: 0.01,
      omega6G: 0.02,
      cholesterolMg: 5,
    });
    assert.equal(mapped.record.provenance.sourceRowNumber, 2);
    assert.equal(mapped.record.provenance.sourceWorkbookSha256, 'sha-fixture');
    assert.equal(mapped.record.provenance.componentColumns.kcal.componentCode, 'ENERCC');
    assert.equal(mapped.record.provenance.componentColumns.kcal.valueColumnNumber, 4);
    assert.equal(mapped.record.provenance.componentColumns.carbs.reference, 'ref-carbs');
    assert.equal(mapped.record.provenance.tier2ComponentColumns.fiberG.componentCode, 'FIBT');
  });

  it('keeps Tier 2 optional when columns are absent', () => {
    const tier1OnlyHeaders = HEADERS.slice(0, 15);
    const tier1OnlyRow = row().slice(0, 15);
    const columnMap = buildColumnMap(tier1OnlyHeaders);
    const mapped = mapBlsRowToSampleRecord(tier1OnlyRow, columnMap, {
      sourceRowIndex: 1,
      sourceWorkbookSha256: 'sha-fixture',
    });

    assert.equal(mapped.ok, true);
    assert.equal(mapped.record.nutrientsPer100g, undefined);
    assert.equal(mapped.record.provenance.tier2ComponentColumns, undefined);
  });

  it('excludes missing and invalid required macro rows with deterministic counts', () => {
    const rows = [
      HEADERS,
      row({ blsCode: '' }),
      row({ germanName: '' }),
      row({ kcal: '-' }),
      row({ protein: 'abc' }),
      row({ blsCode: 'VALID1', germanName: 'Valid Eins' }),
      row({ blsCode: 'VALID2', germanName: 'Valid Zwei' }),
    ];

    const sample = buildBlsSampleRecords(rows, { limit: 2, sourceWorkbookSha256: 'sha-fixture' });
    assert.deepEqual(
      sample.records.map((record) => record.blsCode),
      ['VALID1', 'VALID2'],
    );
    assert.equal(sample.mapping.dataRowsVisited, 6);
    assert.equal(sample.mapping.excludedBeforeLimit, 4);
    assert.deepEqual(sample.mapping.exclusionCounts, {
      missingBlsCode: 1,
      missingGermanName: 1,
      missingRequiredMacros: 1,
      invalidRequiredMacros: 1,
    });
  });

  it('selects first N valid records in source order', () => {
    const rows = [
      HEADERS,
      row({ blsCode: 'A001', germanName: 'Alpha' }),
      row({ blsCode: 'B002', germanName: 'Beta' }),
      row({ blsCode: 'C003', germanName: 'Gamma' }),
    ];

    const sample = buildBlsSampleRecords(rows, { limit: 2, sourceWorkbookSha256: 'sha-fixture' });
    assert.deepEqual(
      sample.records.map((record) => record.blsCode),
      ['A001', 'B002'],
    );
    assert.equal(sample.mapping.dataRowsVisited, 2);
    assert.equal(sample.mapping.validRecordsSelected, 2);
  });

  it('reports Tier 1/Tier 2 column detection and Tier 2 coverage counts', () => {
    const rows = [
      HEADERS,
      row({ blsCode: 'VALID1', germanName: 'Valid Eins' }),
      row({ blsCode: 'VALID2', germanName: 'Valid Zwei', fiberG: '-', sugarG: 'abc' }),
    ];

    const sample = buildBlsSampleRecords(rows, { limit: 2, sourceWorkbookSha256: 'sha-fixture' });

    assert.deepEqual(
      sample.mapping.detectedTier1Columns.map(({ componentCode, found }) => [componentCode, found]),
      [
        ['ENERCC', true],
        ['PROT625', true],
        ['FAT', true],
        ['CHO', true],
      ],
    );
    assert.equal(sample.mapping.detectedTier2Columns.length, TIER_2_COMPONENTS.length);
    assert.deepEqual(sample.mapping.missingTier2Columns, []);
    assert.deepEqual(sample.mapping.tier2Coverage.fiberG, {
      componentCode: 'FIBT',
      valuesPresent: 1,
      missingOrInvalid: 1,
    });
    assert.deepEqual(sample.mapping.tier2Coverage.sugarG, {
      componentCode: 'SUGAR',
      valuesPresent: 1,
      missingOrInvalid: 1,
    });
    assert.deepEqual(sample.mapping.tier2Coverage.energyKj, {
      componentCode: 'ENERCJ',
      valuesPresent: 2,
      missingOrInvalid: 0,
    });
  });

  it('reports missing Tier 2 columns without failing sample generation', () => {
    const tier1OnlyHeaders = HEADERS.slice(0, 15);
    const rows = [tier1OnlyHeaders, row({ blsCode: 'VALID1' }).slice(0, 15)];

    const sample = buildBlsSampleRecords(rows, { limit: 1, sourceWorkbookSha256: 'sha-fixture' });

    assert.equal(sample.records.length, 1);
    assert.equal(sample.mapping.missingTier2Columns.length, TIER_2_COMPONENTS.length);
    assert.equal(sample.mapping.tier2Coverage.fiberG.valuesPresent, 0);
    assert.equal(sample.mapping.tier2Coverage.fiberG.missingOrInvalid, 1);
  });
});

describe('generate-bls-sample-records CLI parser', () => {
  it('uses a deterministic default limit and accepts validated limits', () => {
    assert.equal(parseArgs(['node', 'cli']).limit, DEFAULT_LIMIT);
    assert.equal(parseArgs(['node', 'cli', '--limit', '5']).limit, 5);
    assert.equal(parseArgs(['node', 'cli', '--limit=6']).limit, 6);
  });

  it('refuses unsafe limit values, output/write flags, and positional paths', () => {
    for (const args of [
      ['--limit', '0'],
      ['--limit=-1'],
      ['--limit=1.5'],
      ['--limit=101'],
      ['--output', 'sample.json'],
      ['--out=sample.json'],
      ['-o'],
      ['--write'],
      ['--stage'],
      ['sample.json'],
    ]) {
      assert.throws(() => parseArgs(['node', 'cli', ...args]), /refused|limit|requires/);
    }
  });
});
