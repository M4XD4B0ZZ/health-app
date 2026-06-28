import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  SCHEMA_VERSION,
  TARGET_ARTIFACT_PATH,
  TIER2_FIELDS,
  assertFixedTarget,
  buildBlsCompactRuntimeArtifact,
  parseArgs,
  stableJsonBytes,
  validateBlsCompactRuntimePayload,
  verifyContentHash,
  writeBlsCompactRuntimeArtifact,
} from '../lib/bls-compact-runtime-writer.mjs';

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

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

describe('compact runtime writer CLI parsing', () => {
  it('requires explicit dry-run or write and refuses arbitrary output paths', () => {
    assert.throws(() => parseArgs(['node', 'cli']), /Explicit mode/);
    assert.throws(() => parseArgs(['node', 'cli', '--dry-run', '--write']), /exactly one mode/i);
    assert.equal(parseArgs(['node', 'cli', '--dry-run']).dryRun, true);
    assert.equal(parseArgs(['node', 'cli', '--write']).write, true);

    for (const args of [['--output', 'test.json'], ['--output=test.json'], ['-o'], ['test.json'], ['--force'], ['--format']]) {
      assert.throws(() => parseArgs(['node', 'cli', ...args]), /refused|fixed/);
    }
  });

  it('enforces the fixed runtime artifact target', () => {
    assert.equal(assertFixedTarget(TARGET_ARTIFACT_PATH), TARGET_ARTIFACT_PATH);
    assert.throws(() => assertFixedTarget('../bls-runtime.json'), /traversal/);
    assert.throws(() => assertFixedTarget('C:/tmp/bls-runtime.json'), /Absolute|drive/);
    assert.throws(() => assertFixedTarget('/tmp/bls-runtime.json'), /Absolute|drive/);
    assert.throws(() => assertFixedTarget('test.json'), /fixed/);
  });
});

describe('compact runtime artifact schema and determinism', () => {
  it('builds the exact selected compact object-runtime schema', () => {
    const artifact = buildBlsCompactRuntimeArtifact(fixtureRows(), { sourceWorkbookSha256: 'sha-fixture' });
    const payload = artifact.payload;
    const first = payload.records[0];

    assert.equal(payload.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(Object.keys(payload), ['schemaVersion', 'artifact', 'source', 'records']);
    assert.deepEqual(Object.keys(payload.artifact), ['kind', 'recordCount', 'contentSha256']);
    assert.deepEqual(Object.keys(payload.source), ['kind', 'version', 'locale', 'dataWorkbookPath', 'sourceWorkbookSha256', 'validRecordCount']);
    assert.deepEqual(Object.keys(first), ['id', 'sourceId', 'displayName', 'macrosPer100g', 'nutrientsPer100g']);
    assert.equal(first.id, 'bls:M713100');
    assert.equal(first.sourceId, 'M713100');
    assert.equal(first.displayName, 'Speisequark, Magerstufe');
    assert.deepEqual(Object.keys(first.macrosPer100g), ['kcal', 'protein', 'fat', 'carbs']);
    assert.deepEqual(Object.keys(first.nutrientsPer100g), TIER2_FIELDS);
    assert.equal(payload.artifact.recordCount, 2);
    assert.equal(payload.source.validRecordCount, 2);
    assert.equal(verifyContentHash(payload), true);
    assert.deepEqual(validateBlsCompactRuntimePayload(payload), { ok: true, errors: [] });
  });

  it('does not serialize tokens, aliases, normalizedName, provenance, names, search indexes, or timestamps', () => {
    const artifact = buildBlsCompactRuntimeArtifact(fixtureRows(), { sourceWorkbookSha256: 'sha-fixture' });
    const keys = collectKeys(artifact.payload);
    for (const forbidden of ['tokens', 'aliases', 'normalizedName', 'provenance', 'names', 'searchIndex', 'generatedAt']) {
      assert.equal(keys.includes(forbidden), false, `${forbidden} must be absent`);
    }
  });

  it('generates byte-identical minified JSON with one trailing newline', () => {
    const first = buildBlsCompactRuntimeArtifact(fixtureRows(), { sourceWorkbookSha256: 'sha-fixture' });
    const second = buildBlsCompactRuntimeArtifact(fixtureRows(), { sourceWorkbookSha256: 'sha-fixture' });

    assert.equal(first.bytes, second.bytes);
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.bytes.endsWith('\n'), true);
    assert.equal(first.bytes.endsWith('\n\n'), false);
    assert.equal(stableJsonBytes(first.payload), first.bytes);
  });
});

describe('compact runtime artifact write safety', () => {
  it('dry-run writes no file, write creates fixed target, and same content is unchanged', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bls-compact-runtime-writer-'));
    const artifact = buildBlsCompactRuntimeArtifact(fixtureRows(), { sourceWorkbookSha256: 'sha-fixture' });
    const target = path.join(repoRoot, TARGET_ARTIFACT_PATH);

    const dryRun = writeBlsCompactRuntimeArtifact({ repoRoot, artifact, write: false });
    assert.equal(dryRun.mode, 'dry-run');
    assert.equal(dryRun.writesFiles, false);
    assert.equal(fs.existsSync(target), false);

    const created = writeBlsCompactRuntimeArtifact({ repoRoot, artifact, write: true });
    assert.equal(created.writeStatus, 'created');
    assert.equal(created.readbackMatchesGenerated, true);
    assert.equal(fs.readFileSync(target, 'utf8'), artifact.bytes);

    const unchanged = writeBlsCompactRuntimeArtifact({ repoRoot, artifact, write: true });
    assert.equal(unchanged.writeStatus, 'unchanged_same_content');
    assert.equal(unchanged.generatedSha256, unchanged.existingSha256);
    assert.equal(unchanged.generatedSha256, unchanged.readbackSha256);
  });
});
