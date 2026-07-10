import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  COMPONENT_TIERS,
  DATA_WORKBOOK_FILE,
  DATA_WORKBOOK_PATH,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SOURCE_ID,
  buildBlsSampleRecords,
} from './bls-sample-generator.mjs';

export const TOOL_ID = 'P1-006C3B_BLS_ARTIFACT_WRITER';
export const SCHEMA_VERSION = 'bls-runtime-catalog.v1';
export const SAMPLE_ARTIFACT_PATH = 'scripts/nutrition/bls/out/sample/bls-sample-records.v1.json';

const FORBIDDEN_FLAG_PATTERNS = Object.freeze([
  /^--(?:out|output|stage|commit|push|deploy|fix|format|mutate)(?:$|=)/,
  /^-(?:o|w)$/,
]);

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function stableJsonBytes(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseLimitValue(value) {
  if (!/^\d+$/.test(String(value ?? ''))) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  return limit;
}

export function parseArgs(argv) {
  const options = {
    sample: false,
    full: false,
    write: false,
    force: false,
    limit: DEFAULT_LIMIT,
    help: false,
  };
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--sample') {
      options.sample = true;
    } else if (arg === '--full') {
      options.full = true;
    } else if (arg === '--write') {
      options.write = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--limit') {
      const value = args[index + 1];
      if (!value || value.startsWith('-'))
        throw new Error('--limit requires a positive integer value');
      options.limit = parseLimitValue(value);
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseLimitValue(arg.slice('--limit='.length));
    } else if (FORBIDDEN_FLAG_PATTERNS.some((pattern) => pattern.test(arg))) {
      throw new Error(`Forbidden argument refused: ${arg}`);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument refused: ${arg}`);
    } else {
      throw new Error(`Positional paths are refused; output path is fixed: ${arg}`);
    }
  }

  if (options.help) return options;
  if (options.sample === options.full)
    throw new Error('Exactly one of --sample or --full is required');
  if (options.full) throw new Error('Full artifact writing is out of scope for P1-006C3B');
  if (options.write && !options.sample)
    throw new Error('--write is only allowed with --sample in P1-006C3B');
  return options;
}

export function assertFixedSampleTarget(targetRelativePath = SAMPLE_ARTIFACT_PATH) {
  const normalized = targetRelativePath.replace(/\\/g, '/');
  if (path.isAbsolute(targetRelativePath) || /^[a-zA-Z]:/.test(targetRelativePath)) {
    throw new Error('Absolute or drive-qualified artifact paths are refused');
  }
  if (normalized.split('/').includes('..')) throw new Error('Path traversal is refused');
  if (normalized !== SAMPLE_ARTIFACT_PATH) {
    throw new Error(`Artifact path is fixed for P1-006C3B: ${SAMPLE_ARTIFACT_PATH}`);
  }
  return normalized;
}

function withContentHash(payload, contentSha256) {
  return {
    ...payload,
    manifest: {
      ...payload.manifest,
      artifact: {
        ...payload.manifest.artifact,
        contentSha256,
      },
    },
  };
}

export function computeArtifactContentHash(payload) {
  return sha256Bytes(stableJsonBytes(withContentHash(payload, null)));
}

export function verifyArtifactContentHash(payload) {
  return payload?.manifest?.artifact?.contentSha256 === computeArtifactContentHash(payload);
}

function toRuntimeRecord(record) {
  return {
    ...record,
    sourceId: record.blsCode,
    displayName: record.names.de,
  };
}

export function buildBlsArtifactPayload(rows, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const targetPath = assertFixedSampleTarget(options.targetPath ?? SAMPLE_ARTIFACT_PATH);
  const sample = buildBlsSampleRecords(rows, {
    limit,
    sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
  });

  const payloadWithoutHash = {
    schemaVersion: SCHEMA_VERSION,
    manifest: {
      artifact: {
        kind: 'sample',
        purpose: 'review-and-determinism-probe',
        path: targetPath,
        recordCount: sample.records.length,
        contentSha256: null,
      },
      generator: {
        toolId: TOOL_ID,
        version: 1,
        deterministic: true,
        writesFiles: true,
        modifiesRuntimeBlsSourceBehavior: false,
        packageFilesModified: false,
      },
      selection: {
        mode: 'sample',
        limit,
        ordering: 'source-workbook-row-order-first-valid-records',
        filtering: 'requires BLS code, German name, and Tier 1 macro values',
      },
      source: {
        sourceId: SOURCE_ID,
        dataWorkbook: {
          path: DATA_WORKBOOK_PATH,
          file: DATA_WORKBOOK_FILE,
          sha256: options.sourceWorkbookSha256 ?? null,
          sheetSelection: {
            selector: 1,
            limitation:
              'The first worksheet is read explicitly to avoid loading all workbook sheets.',
          },
        },
      },
      tiers: COMPONENT_TIERS,
      mapping: sample.mapping,
    },
    records: sample.records.map(toRuntimeRecord),
  };

  const payload = withContentHash(
    payloadWithoutHash,
    computeArtifactContentHash(payloadWithoutHash),
  );
  return {
    payload,
    bytes: stableJsonBytes(payload),
    sha256: sha256Bytes(stableJsonBytes(payload)),
  };
}

export function validateBlsArtifactPayload(payload) {
  const errors = [];
  if (payload?.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion mismatch');
  if (payload?.manifest?.artifact?.kind !== 'sample') errors.push('artifact kind must be sample');
  if (payload?.manifest?.artifact?.path !== SAMPLE_ARTIFACT_PATH)
    errors.push('artifact path mismatch');
  if (!verifyArtifactContentHash(payload)) errors.push('content hash verification failed');
  if (!Array.isArray(payload?.records)) errors.push('records must be an array');
  for (const [index, record] of (payload?.records ?? []).entries()) {
    if (!record.id || !record.blsCode || !record.sourceId || !record.displayName) {
      errors.push(`record ${index} missing identity fields`);
    }
    if (!record.macrosPer100g || typeof record.macrosPer100g.kcal !== 'number') {
      errors.push(`record ${index} missing macrosPer100g`);
    }
  }
  return { ok: errors.length === 0, errors };
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

export function writeBlsSampleArtifact({ repoRoot, artifact, write, force = false }) {
  const targetRelativePath = assertFixedSampleTarget(artifact.payload.manifest.artifact.path);
  const targetPath = ensureInsideRoot(repoRoot, targetRelativePath);
  const bytes = artifact.bytes;
  const generatedSha256 = sha256Bytes(bytes);

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
    if (existingBytes === bytes) {
      return {
        ok: true,
        mode: 'write',
        writesFiles: false,
        writeStatus: 'unchanged_same_content',
        targetPath: targetRelativePath,
        generatedSha256,
        existingSha256: sha256Bytes(existingBytes),
        readbackSha256: sha256Bytes(existingBytes),
      };
    }
    if (!force) throw new Error('Refusing to overwrite changed sample artifact without --force');
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, bytes, 'utf8');
  const readback = fs.readFileSync(targetPath, 'utf8');
  if (readback !== bytes) throw new Error('Artifact readback did not match generated bytes');

  return {
    ok: true,
    mode: 'write',
    writesFiles: true,
    writeStatus: existingBytes == null ? 'created' : 'overwritten_with_force',
    targetPath: targetRelativePath,
    generatedSha256,
    existingSha256: existingBytes == null ? null : sha256Bytes(existingBytes),
    readbackSha256: sha256Bytes(readback),
  };
}
