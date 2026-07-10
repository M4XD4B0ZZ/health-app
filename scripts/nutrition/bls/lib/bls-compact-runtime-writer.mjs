import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

import { DATA_WORKBOOK_PATH, buildBlsSampleRecords } from './bls-sample-generator.mjs';

export const TOOL_ID = 'P1-006C3D3_BLS_COMPACT_RUNTIME_WRITER';
export const SCHEMA_VERSION = 'bls-runtime-compact.object.v1';
export const TARGET_ARTIFACT_PATH =
  'src/features/nutrition/infrastructure/catalog/sources/bls/generated/bls-runtime-compact.v1.json';
export const EXPECTED_VALID_RECORD_COUNT = 7090;
export const SOURCE_KIND = 'BLS';
export const SOURCE_VERSION = '4.0';
export const SOURCE_LOCALE = 'de-DE';

export const SIZE_THRESHOLDS_BYTES = Object.freeze({
  rawJson: 3.25 * 1024 * 1024,
  gzip: 0.75 * 1024 * 1024,
  brotli: 0.5 * 1024 * 1024,
});

export const TIER2_FIELDS = Object.freeze([
  'energyKj',
  'waterG',
  'fiberG',
  'sugarG',
  'starchG',
  'alcoholG',
  'saltG',
  'sodiumMg',
  'saturatedFatG',
  'monounsaturatedFatG',
  'polyunsaturatedFatG',
  'omega3G',
  'omega6G',
  'cholesterolMg',
]);

const FORBIDDEN_ARG_PATTERNS = Object.freeze([
  /^--(?:out|output|stage|commit|push|deploy|fix|format|force)(?:$|=)/,
  /^-(?:o|w)$/,
]);

const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  'tokens',
  'aliases',
  'normalizedName',
  'provenance',
  'names',
]);

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function stableJsonBytes(payload) {
  return `${JSON.stringify(payload)}\n`;
}

export function bytesToMiB(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(6));
}

export function parseArgs(argv) {
  const options = { dryRun: false, write: false, help: false };
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--write') {
      options.write = true;
    } else if (FORBIDDEN_ARG_PATTERNS.some((pattern) => pattern.test(arg))) {
      throw new Error(`Forbidden argument refused: ${arg}`);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument refused: ${arg}`);
    } else {
      throw new Error(`Positional output paths are refused; artifact path is fixed: ${arg}`);
    }
  }

  if (options.help) return options;
  if (options.dryRun && options.write)
    throw new Error('Choose exactly one mode: --dry-run or --write');
  if (!options.dryRun && !options.write)
    throw new Error('Explicit mode required: --dry-run or --write');
  return options;
}

export function assertFixedTarget(targetRelativePath = TARGET_ARTIFACT_PATH) {
  const normalized = targetRelativePath.replace(/\\/g, '/');
  if (path.isAbsolute(targetRelativePath) || /^[a-zA-Z]:/.test(targetRelativePath)) {
    throw new Error('Absolute or drive-qualified artifact paths are refused');
  }
  if (normalized.split('/').includes('..')) throw new Error('Path traversal is refused');
  if (normalized !== TARGET_ARTIFACT_PATH) {
    throw new Error(`Artifact path is fixed for P1-006C3D3: ${TARGET_ARTIFACT_PATH}`);
  }
  return normalized;
}

function withContentHash(payload, contentSha256) {
  return {
    ...payload,
    artifact: {
      ...payload.artifact,
      contentSha256,
    },
  };
}

export function computeContentHash(payload) {
  return sha256Bytes(stableJsonBytes(withContentHash(payload, null)));
}

export function verifyContentHash(payload) {
  return payload?.artifact?.contentSha256 === computeContentHash(payload);
}

function macroValue(record, field) {
  return record.macrosPer100g[field] ?? 0;
}

function nutrientValue(record, field) {
  return record.nutrientsPer100g?.[field] ?? 0;
}

function toCompactRuntimeRecord(record) {
  return {
    id: `bls:${record.blsCode}`,
    sourceId: record.blsCode,
    displayName: record.names.de,
    macrosPer100g: {
      kcal: macroValue(record, 'kcal'),
      protein: macroValue(record, 'protein'),
      fat: macroValue(record, 'fat'),
      carbs: macroValue(record, 'carbs'),
    },
    nutrientsPer100g: Object.fromEntries(
      TIER2_FIELDS.map((field) => [field, nutrientValue(record, field)]),
    ),
  };
}

export function buildBlsCompactRuntimeArtifact(rows, options = {}) {
  const targetPath = assertFixedTarget(options.targetPath ?? TARGET_ARTIFACT_PATH);
  const sample = buildBlsSampleRecords(rows, {
    limit: Number.MAX_SAFE_INTEGER,
    sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
  });
  const records = sample.records.map(toCompactRuntimeRecord);

  const payloadWithoutHash = {
    schemaVersion: SCHEMA_VERSION,
    artifact: {
      kind: 'runtime-compact',
      recordCount: records.length,
      contentSha256: null,
    },
    source: {
      kind: SOURCE_KIND,
      version: SOURCE_VERSION,
      locale: SOURCE_LOCALE,
      dataWorkbookPath: DATA_WORKBOOK_PATH,
      sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
      validRecordCount: sample.mapping.validRecordsSelected,
    },
    records,
  };

  const payload = withContentHash(payloadWithoutHash, computeContentHash(payloadWithoutHash));
  const bytes = stableJsonBytes(payload);
  return {
    payload,
    bytes,
    sha256: sha256Bytes(bytes),
    targetPath,
    metrics: artifactMetrics(bytes, records.length),
  };
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

function hasExactKeys(value, keys) {
  return JSON.stringify(Object.keys(value ?? {})) === JSON.stringify(keys);
}

export function validateBlsCompactRuntimePayload(payload) {
  const errors = [];
  if (payload?.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion mismatch');
  if (!hasExactKeys(payload, ['schemaVersion', 'artifact', 'source', 'records']))
    errors.push('top-level schema keys mismatch');
  if (!hasExactKeys(payload?.artifact, ['kind', 'recordCount', 'contentSha256']))
    errors.push('artifact keys mismatch');
  if (payload?.artifact?.kind !== 'runtime-compact')
    errors.push('artifact kind must be runtime-compact');
  if (
    !hasExactKeys(payload?.source, [
      'kind',
      'version',
      'locale',
      'dataWorkbookPath',
      'sourceWorkbookSha256',
      'validRecordCount',
    ])
  ) {
    errors.push('source keys mismatch');
  }
  if (payload?.source?.kind !== SOURCE_KIND) errors.push('source kind mismatch');
  if (payload?.source?.version !== SOURCE_VERSION) errors.push('source version mismatch');
  if (payload?.source?.locale !== SOURCE_LOCALE) errors.push('source locale mismatch');
  if (payload?.source?.dataWorkbookPath !== DATA_WORKBOOK_PATH)
    errors.push('source workbook path mismatch');
  if (!Array.isArray(payload?.records)) errors.push('records must be an array');
  if (payload?.artifact?.recordCount !== payload?.records?.length)
    errors.push('artifact recordCount mismatch');
  if (payload?.source?.validRecordCount !== payload?.records?.length)
    errors.push('source validRecordCount mismatch');
  if (!verifyContentHash(payload)) errors.push('content hash verification failed');

  const forbiddenKeys = collectKeys(payload).filter((key) => FORBIDDEN_PAYLOAD_KEYS.includes(key));
  if (forbiddenKeys.length > 0)
    errors.push(`forbidden keys present: ${[...new Set(forbiddenKeys)].join(', ')}`);

  for (const [index, record] of (payload?.records ?? []).entries()) {
    if (
      !hasExactKeys(record, ['id', 'sourceId', 'displayName', 'macrosPer100g', 'nutrientsPer100g'])
    ) {
      errors.push(`record ${index} keys mismatch`);
    }
    if (record.id !== `bls:${record.sourceId}`) errors.push(`record ${index} id/sourceId mismatch`);
    if (!hasExactKeys(record.macrosPer100g, ['kcal', 'protein', 'fat', 'carbs']))
      errors.push(`record ${index} macros keys mismatch`);
    if (!hasExactKeys(record.nutrientsPer100g, TIER2_FIELDS))
      errors.push(`record ${index} nutrients keys mismatch`);
  }

  return { ok: errors.length === 0, errors };
}

export function artifactMetrics(bytes, recordCount) {
  const rawJsonBytes = Buffer.byteLength(bytes, 'utf8');
  const gzipBytes = gzipSync(bytes).byteLength;
  const brotliBytes = brotliCompressSync(bytes).byteLength;
  return {
    recordCount,
    rawJsonBytes,
    rawJsonMiB: bytesToMiB(rawJsonBytes),
    gzipBytes,
    gzipMiB: bytesToMiB(gzipBytes),
    brotliBytes,
    brotliMiB: bytesToMiB(brotliBytes),
    thresholds: {
      recordCount: {
        actual: recordCount,
        expected: EXPECTED_VALID_RECORD_COUNT,
        pass: recordCount === EXPECTED_VALID_RECORD_COUNT,
      },
      rawJson: {
        actualBytes: rawJsonBytes,
        maxBytes: SIZE_THRESHOLDS_BYTES.rawJson,
        pass: rawJsonBytes <= SIZE_THRESHOLDS_BYTES.rawJson,
      },
      gzip: {
        actualBytes: gzipBytes,
        maxBytes: SIZE_THRESHOLDS_BYTES.gzip,
        pass: gzipBytes <= SIZE_THRESHOLDS_BYTES.gzip,
      },
      brotli: {
        actualBytes: brotliBytes,
        maxBytes: SIZE_THRESHOLDS_BYTES.brotli,
        pass: brotliBytes <= SIZE_THRESHOLDS_BYTES.brotli,
      },
    },
  };
}

function ensureInsideRoot(rootDir, relativePath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Resolved artifact target escapes repository root');
  }
  return target;
}

export function writeBlsCompactRuntimeArtifact({ repoRoot, artifact, write }) {
  const targetRelativePath = assertFixedTarget(artifact.targetPath);
  const targetPath = ensureInsideRoot(repoRoot, targetRelativePath);
  const generatedSha256 = sha256Bytes(artifact.bytes);

  if (!write) {
    return {
      ok: true,
      mode: 'dry-run',
      writesFiles: false,
      targetPath: targetRelativePath,
      generatedSha256,
    };
  }

  let existingBytes = null;
  if (fs.existsSync(targetPath)) {
    existingBytes = fs.readFileSync(targetPath, 'utf8');
    if (existingBytes === artifact.bytes) {
      return {
        ok: true,
        mode: 'write',
        writesFiles: false,
        writeStatus: 'unchanged_same_content',
        targetPath: targetRelativePath,
        generatedSha256,
        existingSha256: sha256Bytes(existingBytes),
        readbackSha256: sha256Bytes(existingBytes),
        readbackMatchesGenerated: true,
      };
    }
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, artifact.bytes, 'utf8');
  const readback = fs.readFileSync(targetPath, 'utf8');
  if (readback !== artifact.bytes)
    throw new Error('Artifact readback did not match generated bytes');

  return {
    ok: true,
    mode: 'write',
    writesFiles: true,
    writeStatus: existingBytes == null ? 'created' : 'overwritten_deterministic_artifact',
    targetPath: targetRelativePath,
    generatedSha256,
    existingSha256: existingBytes == null ? null : sha256Bytes(existingBytes),
    readbackSha256: sha256Bytes(readback),
    readbackMatchesGenerated: true,
  };
}
