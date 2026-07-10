import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  SAMPLE_ARTIFACT_PATH,
  SCHEMA_VERSION,
  assertFixedSampleTarget,
  buildBlsArtifactPayload,
  parseArgs,
  stableJsonBytes,
  validateBlsArtifactPayload,
  verifyArtifactContentHash,
  writeBlsSampleArtifact,
} from '../lib/bls-artifact-writer.mjs';

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
  ];
}

function fixtureRows() {
  return [
    HEADERS,
    row(),
    row({ blsCode: 'B314000', germanName: 'Weizentoastbrot', englishName: 'Wheat toast' }),
  ];
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

describe('bls artifact writer CLI parsing', () => {
  it('requires exactly one mode and refuses full artifacts for C3B', () => {
    assert.throws(() => parseArgs(['node', 'cli']), /Exactly one/);
    assert.throws(() => parseArgs(['node', 'cli', '--sample', '--full']), /Exactly one/);
    assert.throws(() => parseArgs(['node', 'cli', '--full']), /out of scope/);
  });

  it('accepts dry-run sample, explicit write sample, force, and bounded limit', () => {
    assert.deepEqual(parseArgs(['node', 'cli', '--sample']).sample, true);
    assert.equal(parseArgs(['node', 'cli', '--write', '--sample']).write, true);
    assert.equal(parseArgs(['node', 'cli', '--write', '--sample', '--force']).force, true);
    assert.equal(parseArgs(['node', 'cli', '--sample', '--limit', '2']).limit, 2);
    assert.equal(parseArgs(['node', 'cli', '--sample', '--limit=3']).limit, 3);
  });

  it('refuses unsafe flags, output paths, positional paths, and invalid limits', () => {
    for (const args of [
      ['--sample', '--limit', '0'],
      ['--sample', '--limit=-1'],
      ['--sample', '--limit=1.5'],
      ['--sample', '--output', 'sample.json'],
      ['--sample', '--out=sample.json'],
      ['--sample', '-o'],
      ['--sample', '--stage'],
      ['--sample', '--commit'],
      ['--sample', '--push'],
      ['--sample', 'sample.json'],
    ]) {
      assert.throws(() => parseArgs(['node', 'cli', ...args]), /refused|limit|requires/);
    }
  });
});

describe('bls artifact payload schema and determinism', () => {
  it('builds the requested schema without timestamp metadata', () => {
    const artifact = buildBlsArtifactPayload(fixtureRows(), {
      limit: 2,
      sourceWorkbookSha256: 'sha-fixture',
    });
    const payload = artifact.payload;

    assert.equal(payload.schemaVersion, SCHEMA_VERSION);
    assert.equal(payload.manifest.artifact.kind, 'sample');
    assert.equal(payload.manifest.artifact.path, SAMPLE_ARTIFACT_PATH);
    assert.equal(payload.manifest.generator.toolId, 'P1-006C3B_BLS_ARTIFACT_WRITER');
    assert.equal(payload.manifest.selection.mode, 'sample');
    assert.equal(payload.manifest.source.dataWorkbook.sha256, 'sha-fixture');
    assert.equal(payload.records.length, 2);
    assert.equal(payload.records[0].sourceId, payload.records[0].blsCode);
    assert.equal(payload.records[0].displayName, payload.records[0].names.de);
    assert.equal(verifyArtifactContentHash(payload), true);
    assert.deepEqual(validateBlsArtifactPayload(payload), { ok: true, errors: [] });
    assert.deepEqual(
      collectKeys(payload).filter((key) => /createdAt|updatedAt|timestamp|generatedAt/i.test(key)),
      [],
    );
  });

  it('generates byte-identical stable JSON with one trailing newline', () => {
    const first = buildBlsArtifactPayload(fixtureRows(), {
      limit: 2,
      sourceWorkbookSha256: 'sha-fixture',
    });
    const second = buildBlsArtifactPayload(fixtureRows(), {
      limit: 2,
      sourceWorkbookSha256: 'sha-fixture',
    });

    assert.equal(first.bytes, second.bytes);
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.bytes.endsWith('\n'), true);
    assert.equal(first.bytes.endsWith('\n\n'), false);
    assert.equal(stableJsonBytes(first.payload), first.bytes);
  });

  it('enforces the fixed artifact path and refuses escapes', () => {
    assert.equal(assertFixedSampleTarget(SAMPLE_ARTIFACT_PATH), SAMPLE_ARTIFACT_PATH);
    assert.throws(() => assertFixedSampleTarget('../sample.json'), /traversal/);
    assert.throws(() => assertFixedSampleTarget('C:/tmp/sample.json'), /Absolute|drive/);
    assert.throws(() => assertFixedSampleTarget('/tmp/sample.json'), /Absolute|drive/);
    assert.throws(() => assertFixedSampleTarget('scripts/nutrition/bls/out/other.json'), /fixed/);
  });
});

describe('bls sample artifact write safety', () => {
  it('dry-run writes no file, write creates fixed target, and same content is unchanged', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bls-artifact-writer-'));
    const artifact = buildBlsArtifactPayload(fixtureRows(), {
      limit: 2,
      sourceWorkbookSha256: 'sha-fixture',
    });
    const target = path.join(repoRoot, SAMPLE_ARTIFACT_PATH);

    const dryRun = writeBlsSampleArtifact({ repoRoot, artifact, write: false });
    assert.equal(dryRun.mode, 'dry-run');
    assert.equal(fs.existsSync(target), false);

    const created = writeBlsSampleArtifact({ repoRoot, artifact, write: true });
    assert.equal(created.writeStatus, 'created');
    assert.equal(fs.readFileSync(target, 'utf8'), artifact.bytes);

    const unchanged = writeBlsSampleArtifact({ repoRoot, artifact, write: true });
    assert.equal(unchanged.writeStatus, 'unchanged_same_content');
    assert.equal(unchanged.generatedSha256, unchanged.existingSha256);
  });

  it('refuses changed existing content unless force is explicit', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bls-artifact-writer-'));
    const artifact = buildBlsArtifactPayload(fixtureRows(), {
      limit: 1,
      sourceWorkbookSha256: 'sha-fixture',
    });
    const target = path.join(repoRoot, SAMPLE_ARTIFACT_PATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '{"changed":true}\n', 'utf8');

    assert.throws(
      () => writeBlsSampleArtifact({ repoRoot, artifact, write: true }),
      /Refusing to overwrite/,
    );

    const forced = writeBlsSampleArtifact({ repoRoot, artifact, write: true, force: true });
    assert.equal(forced.writeStatus, 'overwritten_with_force');
    assert.equal(fs.readFileSync(target, 'utf8'), artifact.bytes);
    assert.equal(forced.generatedSha256, forced.readbackSha256);
  });
});
