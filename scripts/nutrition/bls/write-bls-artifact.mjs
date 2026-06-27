#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { readSheet } from 'read-excel-file/node';

import { DATA_WORKBOOK_PATH, DEFAULT_LIMIT, MAX_LIMIT, countColumns } from './lib/bls-sample-generator.mjs';
import {
  SAMPLE_ARTIFACT_PATH,
  TOOL_ID,
  buildBlsArtifactPayload,
  parseArgs,
  validateBlsArtifactPayload,
  writeBlsSampleArtifact,
} from './lib/bls-artifact-writer.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = process.cwd();
const REQUIRED_HEAP_MB = 8192;
const RELAUNCH_ENV = 'BLS_ARTIFACT_WRITER_HEAP_RELAUNCHED';

function usage() {
  return `P1-006C3B BLS sample artifact writer

USAGE:
  node scripts/nutrition/bls/write-bls-artifact.mjs --sample [--limit ${DEFAULT_LIMIT}]
  node scripts/nutrition/bls/write-bls-artifact.mjs --write --sample [--limit ${DEFAULT_LIMIT}] [--force]

SAFETY:
  - Writes only the fixed sample artifact path:
    ${SAMPLE_ARTIFACT_PATH}
  - --sample is required for C3B sample mode
  - --write is required before any file write
  - --full is refused as out of scope for P1-006C3B
  - Limit must be an integer from 1 to ${MAX_LIMIT}`;
}

function errorPayload(error, extras = {}) {
  return {
    tool: TOOL_ID,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    writesFiles: false,
    modifiesRuntimeBlsSourceBehavior: false,
    packageFilesModified: false,
    ...extras,
  };
}

function relaunchWithLargerHeapIfNeeded() {
  const hasHeapFlag = process.execArgv.some((arg) => arg.startsWith('--max-old-space-size='));
  if (hasHeapFlag || process.env[RELAUNCH_ENV] === '1') return;

  const result = spawnSync(process.execPath, [`--max-old-space-size=${REQUIRED_HEAP_MB}`, ...process.argv.slice(1)], {
    cwd: REPO_ROOT,
    env: { ...process.env, [RELAUNCH_ENV]: '1' },
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(
      JSON.stringify(
        errorPayload(`Failed to relaunch Node with --max-old-space-size=${REQUIRED_HEAP_MB}: ${result.error.message}`),
        null,
        2,
      ),
    );
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function assertWorkbookExists() {
  const absolutePath = path.join(REPO_ROOT, DATA_WORKBOOK_PATH);
  if (!fs.existsSync(absolutePath)) throw new Error(`Missing required workbook: ${DATA_WORKBOOK_PATH}`);
  return absolutePath;
}

async function readDataWorkbook() {
  const absolutePath = assertWorkbookExists();
  const rows = await readSheet(absolutePath, { sheet: 1 });
  return { absolutePath, rows, sha256: sha256File(absolutePath) };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }

    relaunchWithLargerHeapIfNeeded();

    const workbook = await readDataWorkbook();
    const artifact = buildBlsArtifactPayload(workbook.rows, {
      limit: options.limit,
      sourceWorkbookSha256: workbook.sha256,
    });
    const validation = validateBlsArtifactPayload(artifact.payload);
    if (!validation.ok) throw new Error(`Generated artifact failed schema validation: ${validation.errors.join(', ')}`);

    const writeResult = writeBlsSampleArtifact({
      repoRoot: REPO_ROOT,
      artifact,
      write: options.write,
      force: options.force,
    });

    console.log(
      JSON.stringify(
        {
          tool: TOOL_ID,
          ok: true,
          mode: options.write ? 'write-sample' : 'dry-run-sample',
          writesFiles: writeResult.writesFiles,
          modifiesRuntimeBlsSourceBehavior: false,
          packageFilesModified: false,
          deterministic: true,
          targetPath: SAMPLE_ARTIFACT_PATH,
          limit: options.limit,
          sourceFiles: {
            dataWorkbook: {
              role: 'data',
              path: DATA_WORKBOOK_PATH,
              sha256: workbook.sha256,
              sheetSelection: {
                selector: 1,
                limitation: 'The first worksheet is read explicitly to avoid loading all workbook sheets.',
              },
              workbookRows: workbook.rows.length,
              columnCount: countColumns(workbook.rows),
            },
          },
          artifact: {
            schemaVersion: artifact.payload.schemaVersion,
            recordCount: artifact.payload.records.length,
            contentSha256: artifact.payload.manifest.artifact.contentSha256,
            finalJsonSha256: artifact.sha256,
            byteLength: Buffer.byteLength(artifact.bytes, 'utf8'),
          },
          validation,
          writeResult,
          deterministicRegeneration: {
            checked: writeResult.writeStatus === 'unchanged_same_content',
            byteIdentical: writeResult.writeStatus === 'unchanged_same_content' ? true : null,
            existingSha256: writeResult.existingSha256 ?? null,
            generatedSha256: writeResult.generatedSha256,
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(JSON.stringify(errorPayload(error), null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
