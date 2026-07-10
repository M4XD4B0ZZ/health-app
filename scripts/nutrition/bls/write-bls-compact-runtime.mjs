#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readSheet } from 'read-excel-file/node';

import { DATA_WORKBOOK_PATH, countColumns } from './lib/bls-sample-generator.mjs';
import {
  TARGET_ARTIFACT_PATH,
  TOOL_ID,
  buildBlsCompactRuntimeArtifact,
  parseArgs,
  validateBlsCompactRuntimePayload,
  writeBlsCompactRuntimeArtifact,
} from './lib/bls-compact-runtime-writer.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = process.cwd();
const REQUIRED_HEAP_MB = 8192;
const RELAUNCH_ENV = 'BLS_COMPACT_RUNTIME_WRITER_HEAP_RELAUNCHED';

function usage() {
  return `P1-006C3D3 BLS compact runtime writer

USAGE:
  node scripts/nutrition/bls/write-bls-compact-runtime.mjs --dry-run
  node scripts/nutrition/bls/write-bls-compact-runtime.mjs --write

SAFETY:
  - Writes only the fixed runtime artifact path:
    ${TARGET_ARTIFACT_PATH}
  - --write is required before any file write
  - --dry-run writes nothing
  - Arbitrary output paths are refused`;
}

function errorPayload(error) {
  return {
    tool: TOOL_ID,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    writesFiles: false,
    modifiesRuntimeBlsSourceBehavior: false,
    packageFilesModified: false,
  };
}

function relaunchWithLargerHeapIfNeeded() {
  const hasHeapFlag = process.execArgv.some((arg) => arg.startsWith('--max-old-space-size='));
  if (hasHeapFlag || process.env[RELAUNCH_ENV] === '1') return;

  const result = spawnSync(
    process.execPath,
    [`--max-old-space-size=${REQUIRED_HEAP_MB}`, ...process.argv.slice(1)],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, [RELAUNCH_ENV]: '1' },
      stdio: 'inherit',
    },
  );

  if (result.error) {
    console.error(
      JSON.stringify(
        errorPayload(
          `Failed to relaunch Node with --max-old-space-size=${REQUIRED_HEAP_MB}: ${result.error.message}`,
        ),
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
  if (!fs.existsSync(absolutePath))
    throw new Error(`Missing required workbook: ${DATA_WORKBOOK_PATH}`);
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
    const artifact = buildBlsCompactRuntimeArtifact(workbook.rows, {
      sourceWorkbookSha256: workbook.sha256,
    });
    const validation = validateBlsCompactRuntimePayload(artifact.payload);
    if (!validation.ok)
      throw new Error(
        `Generated compact runtime artifact failed validation: ${validation.errors.join(', ')}`,
      );

    const writeResult = writeBlsCompactRuntimeArtifact({
      repoRoot: REPO_ROOT,
      artifact,
      write: options.write,
    });

    console.log(
      JSON.stringify(
        {
          tool: TOOL_ID,
          ok: true,
          mode: options.write ? 'write' : 'dry-run',
          writesFiles: writeResult.writesFiles,
          modifiesRuntimeBlsSourceBehavior: false,
          packageFilesModified: false,
          deterministic: true,
          targetPath: TARGET_ARTIFACT_PATH,
          source: {
            kind: artifact.payload.source.kind,
            version: artifact.payload.source.version,
            locale: artifact.payload.source.locale,
            dataWorkbookPath: DATA_WORKBOOK_PATH,
            sourceWorkbookSha256: workbook.sha256,
            workbookRows: workbook.rows.length,
            columnCount: countColumns(workbook.rows),
            validRecordCount: artifact.payload.source.validRecordCount,
          },
          artifact: {
            schemaVersion: artifact.payload.schemaVersion,
            recordCount: artifact.payload.artifact.recordCount,
            contentSha256: artifact.payload.artifact.contentSha256,
            finalJsonSha256: artifact.sha256,
            metrics: artifact.metrics,
          },
          validation,
          writeResult,
          deterministicRegeneration: {
            checked: writeResult.writeStatus === 'unchanged_same_content',
            byteIdentical: writeResult.writeStatus === 'unchanged_same_content' ? true : null,
            existingSha256: writeResult.existingSha256 ?? null,
            generatedSha256: writeResult.generatedSha256,
            readbackSha256: writeResult.readbackSha256 ?? null,
            readbackMatchesGenerated: writeResult.readbackMatchesGenerated ?? null,
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
