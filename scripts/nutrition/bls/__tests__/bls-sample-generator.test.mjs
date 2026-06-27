import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../generate-bls-sample-records.mjs';
import {
  DEFAULT_LIMIT,
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
  ];
}

describe('bls-sample-generator pure helpers', () => {
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
    assert.equal(mapped.record.provenance.sourceRowNumber, 2);
    assert.equal(mapped.record.provenance.sourceWorkbookSha256, 'sha-fixture');
    assert.equal(mapped.record.provenance.componentColumns.kcal.componentCode, 'ENERCC');
    assert.equal(mapped.record.provenance.componentColumns.kcal.valueColumnNumber, 4);
    assert.equal(mapped.record.provenance.componentColumns.carbs.reference, 'ref-carbs');
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
