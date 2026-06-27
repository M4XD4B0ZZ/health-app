import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FULL_ARTIFACT_TARGET_PATH,
  buildFullArtifactDryRunSummary,
  buildFullArtifactPayloadFromRecords,
  parseArgs,
  scanAllBlsRows,
  validateFullArtifactPayload,
} from '../lib/bls-full-artifact-dry-run.mjs';

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
];

function row(overrides = {}) {
  return [
    overrides.blsCode ?? 'M713100',
    overrides.germanName ?? 'Speisequark, Magerstufe',
    overrides.englishName ?? 'Low fat curd',
    overrides.kcal ?? '66,1234',
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
    overrides.energyKj ?? '276,7',
    overrides.waterG ?? '80,1',
    overrides.fiberG ?? '1,2',
    overrides.sugarG ?? '2,3',
  ];
}

describe('bls full artifact dry-run parser', () => {
  it('defaults to estimate mode and accepts scan-only/help modes', () => {
    assert.equal(parseArgs(['node', 'cli']).mode, 'estimate-artifact');
    assert.equal(parseArgs(['node', 'cli', '--estimate-artifact']).mode, 'estimate-artifact');
    assert.equal(parseArgs(['node', 'cli', '--scan-only']).mode, 'scan-only');
    assert.equal(parseArgs(['node', 'cli', '--help']).help, true);
  });

  it('accepts bounded probe max rows arguments', () => {
    assert.equal(parseArgs(['node', 'cli', '--max-rows', '100']).maxRows, 100);
    assert.equal(parseArgs(['node', 'cli', '--max-rows=100']).maxRows, 100);
  });

  it('rejects invalid bounded probe max rows arguments', () => {
    for (const args of [
      ['--max-rows'],
      ['--max-rows', '0'],
      ['--max-rows=0'],
      ['--max-rows', '501'],
      ['--max-rows=501'],
      ['--max-rows', 'abc'],
      ['--max-rows=abc'],
      ['--max-rows', '1.5'],
      ['--max-rows=1.5'],
    ]) {
      assert.throws(() => parseArgs(['node', 'cli', ...args]), /Invalid --max-rows value refused/);
    }
  });

  it('refuses output, write, mutation, record-printing, and positional path arguments', () => {
    for (const args of [
      ['--output', 'test.json'],
      ['--output=test.json'],
      ['--out=test.json'],
      ['-o'],
      ['--write'],
      ['--stage'],
      ['--commit'],
      ['--push'],
      ['--deploy'],
      ['--fix'],
      ['--format'],
      ['--print-records'],
      ['test.json'],
    ]) {
      assert.throws(() => parseArgs(['node', 'cli', ...args]), /refused|Positional/);
    }
  });
});

describe('bls full artifact scan and estimate', () => {
  it('scans all rows, reports exclusions, coverage, and duplicate identities', () => {
    const rows = [
      HEADERS,
      row({ blsCode: 'DUP1', germanName: 'Alpha' }),
      row({ blsCode: 'DUP1', germanName: 'Beta', fiberG: '-' }),
      row({ blsCode: '', germanName: 'No Code' }),
      row({ blsCode: 'BAD1', germanName: 'Bad Macro', kcal: 'abc' }),
      row({ blsCode: 'NONAME', germanName: '' }),
      row({ blsCode: 'MISSING', germanName: 'Missing Macro', protein: '-' }),
    ];

    const scan = scanAllBlsRows(rows, { sourceWorkbookSha256: 'sha-fixture' });

    assert.equal(scan.scan.dataRowsAvailable, 6);
    assert.equal(scan.scan.dataRowsScanned, 6);
    assert.equal(scan.scan.validTier1Records, 2);
    assert.deepEqual(scan.scan.excludedRecords.byReason, {
      missingBlsCode: 1,
      missingGermanName: 1,
      missingRequiredMacros: 1,
      invalidRequiredMacros: 1,
    });
    assert.equal(scan.duplicates.blsCodes.count, 1);
    assert.equal(scan.duplicates.ids.count, 1);
    assert.equal(scan.mapping.tier2Coverage.fiberG.valuesPresent, 1);
    assert.equal(scan.mapping.tier2Coverage.fiberG.missingOrInvalid, 1);
    assert.equal(scan.mapping.tier2Coverage.fiberG.coverageRatio, 0.5);
  });

  it('builds a full in-memory artifact payload and validates it without writing', () => {
    const scan = scanAllBlsRows([HEADERS, row({ blsCode: 'A001' }), row({ blsCode: 'B002' })], {
      sourceWorkbookSha256: 'sha-fixture',
    });
    const artifact = buildFullArtifactPayloadFromRecords(scan.records, {
      sourceWorkbookSha256: 'sha-fixture',
      mapping: scan.mapping,
    });

    assert.equal(artifact.payload.manifest.artifact.kind, 'full');
    assert.equal(artifact.payload.manifest.artifact.path, FULL_ARTIFACT_TARGET_PATH);
    assert.equal(artifact.payload.manifest.generator.writesFiles, false);
    assert.equal(artifact.payload.records.length, 2);
    assert.equal(artifact.payload.records[0].sourceId, artifact.payload.records[0].blsCode);
    assert.equal(artifact.payload.records[0].displayName, artifact.payload.records[0].names.de);
    assert.equal(artifact.bytes.endsWith('\n'), true);
    assert.deepEqual(validateFullArtifactPayload(artifact.payload), { ok: true, errors: [] });
  });

  it('returns a summary-only estimate with deterministic regeneration and no records field', () => {
    const summary = buildFullArtifactDryRunSummary(
      [HEADERS, row({ blsCode: 'A001', germanName: 'Alpha' }), row({ blsCode: 'B002', germanName: 'Beta' })],
      {
      mode: 'estimate-artifact',
      sourceWorkbookSha256: 'sha-fixture',
      requiredHeapMb: 8192,
      heapRelaunched: true,
      },
    );

    assert.equal(summary.ok, true);
    assert.equal(summary.writesFiles, false);
    assert.equal(summary.generatesRuntimeArtifactFile, false);
    assert.equal(summary.generatedArtifactBytesInMemory, true);
    assert.equal(summary.records, undefined);
    assert.equal(summary.artifactEstimate.recordCount, 2);
    assert.equal(summary.artifactEstimate.writtenToDisk, false);
    assert.equal(summary.deterministicRegeneration.checked, true);
    assert.equal(summary.deterministicRegeneration.byteIdentical, true);
    assert.equal(summary.riskChecklist.c3dRecommendation, 'review_before_proceeding');
    assert.deepEqual(summary.riskChecklist.blockingFindings, []);
  });

  it('supports scan-only summary without generating artifact bytes', () => {
    const summary = buildFullArtifactDryRunSummary([HEADERS, row({ blsCode: 'A001' })], {
      mode: 'scan-only',
      sourceWorkbookSha256: 'sha-fixture',
    });

    assert.equal(summary.generatedArtifactBytesInMemory, false);
    assert.equal(summary.artifactEstimate, null);
    assert.equal(summary.deterministicRegeneration.checked, false);
    assert.equal(summary.bundleRisk.status, 'not_evaluated_scan_only');
  });

  it('supports bounded scan summary semantics', () => {
    const summary = buildFullArtifactDryRunSummary(
      [
        HEADERS,
        row({ blsCode: 'A001', germanName: 'Alpha' }),
        row({ blsCode: 'B002', germanName: 'Beta' }),
        row({ blsCode: 'C003', germanName: 'Gamma' }),
      ],
      {
        mode: 'scan-only',
        maxRows: 2,
        sourceWorkbookSha256: 'sha-fixture',
      },
    );

    assert.equal(summary.generatedArtifactBytesInMemory, false);
    assert.equal(summary.artifactEstimate, null);
    assert.equal(summary.scan.dataRowsAvailable, 3);
    assert.equal(summary.scan.dataRowsScanned, 2);
    assert.equal(summary.scan.fullScanCompleted, false);
    assert.equal(summary.scan.maxRows, 2);
    assert.equal(summary.scan.evidenceScope, 'bounded-real-workbook-probe');
    assert.equal(summary.scan.validTier1Records, 2);
  });

  it('warns that bounded scan is not full workbook evidence without full-scan blocking', () => {
    const summary = buildFullArtifactDryRunSummary(
      [
        HEADERS,
        row({ blsCode: 'A001', germanName: 'Alpha' }),
        row({ blsCode: 'B002', germanName: 'Beta' }),
        row({ blsCode: 'C003', germanName: 'Gamma' }),
      ],
      {
        mode: 'scan-only',
        maxRows: 2,
        sourceWorkbookSha256: 'sha-fixture',
      },
    );

    assert.equal(summary.riskChecklist.warnings.includes('bounded_probe_not_full_workbook_evidence'), true);
    assert.equal(summary.riskChecklist.blockingFindings.includes('full_scan_did_not_scan_all_available_data_rows'), false);
  });
});