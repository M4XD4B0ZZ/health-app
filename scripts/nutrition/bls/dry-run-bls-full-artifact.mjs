#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { readSheet } from 'read-excel-file/node';

import { DATA_WORKBOOK_PATH } from './lib/bls-sample-generator.mjs';
import { buildFullArtifactDryRunSummary, errorPayload, parseArgs } from './lib/bls-full-artifact-dry-run.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = process.cwd();
const REQUIRED_HEAP_MB = 8192;
const RELAUNCH_ENV = 'BLS_FULL_ARTIFACT_DRY_RUN_HEAP_RELAUNCHED';

export function usage() {
  return `P1-006C3C BLS full runtime artifact dry-run

USAGE:
  node scripts/nutrition/bls/dry-run-bls-full-artifact.mjs [--estimate-artifact]
  node scripts/nutrition/bls/dry-run-bls-full-artifact.mjs --scan-only
  node scripts/nutrition/bls/dry-run-bls-full-artifact.mjs --scan-only --max-rows 100

SAFETY:
  - Reads the official BLS data workbook
  - Scans all data rows unless --max-rows is used for a bounded probe
  - Emits summary JSON to stdout only
  - Writes no files and creates no runtime artifact on disk
  - Refuses write/output/mutation flags and positional output paths
  - Does not print records or artifact bytes`;
}

function relaunchWithLargerHeapIfNeeded() {
  const hasHeapFlag = process.execArgv.some((arg) => arg.startsWith('--max-old-space-size='));
  if (hasHeapFlag || process.env[RELAUNCH_ENV] === '1') return false;

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
  return { rows, sha256: sha256File(absolutePath) };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }

    const heapRelaunched = relaunchWithLargerHeapIfNeeded();
    const workbook = await readDataWorkbook();
    const summary = buildFullArtifactDryRunSummary(workbook.rows, {
      mode: options.mode,
      maxRows: options.maxRows,
      sourceWorkbookSha256: workbook.sha256,
      requiredHeapMb: REQUIRED_HEAP_MB,
      heapRelaunched: heapRelaunched || process.env[RELAUNCH_ENV] === '1',
    });

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(JSON.stringify(errorPayload(error), null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}