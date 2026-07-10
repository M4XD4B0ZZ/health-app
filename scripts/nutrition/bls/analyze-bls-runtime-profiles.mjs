#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readSheet } from 'read-excel-file/node';

import { DATA_WORKBOOK_PATH } from './lib/bls-sample-generator.mjs';
import {
  TOOL_ID,
  parseBenchmarkArgs,
  runBlsRuntimeProfileBenchmark,
} from './lib/bls-runtime-profile-size-analysis.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = process.cwd();
const REQUIRED_HEAP_MB = 8192;
const RELAUNCH_ENV = 'BLS_RUNTIME_PROFILE_BENCHMARK_HEAP_RELAUNCHED';

function usage() {
  return `P1-006C3D1 BLS Runtime Profile Benchmark

USAGE:
  node scripts/nutrition/bls/analyze-bls-runtime-profiles.mjs --limit <n>
  node scripts/nutrition/bls/analyze-bls-runtime-profiles.mjs --full-readonly
  node scripts/nutrition/bls/analyze-bls-runtime-profiles.mjs --limit <n> --profile <profile>

SAFETY:
  - Read-only and stdout-only.
  - Writes no files and generates no artifacts.
  - Refuses output paths and mutation-like flags.`;
}

function errorPayload(error) {
  return {
    tool: TOOL_ID,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    writesFiles: false,
    generatesArtifacts: false,
    modifiesRuntimeBlsSourceBehavior: false,
    packageFilesModified: false,
  };
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function workbookPath() {
  const absolutePath = path.join(REPO_ROOT, DATA_WORKBOOK_PATH);
  if (!fs.existsSync(absolutePath))
    throw new Error(`Missing required workbook: ${DATA_WORKBOOK_PATH}`);
  return absolutePath;
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

async function main() {
  try {
    const options = parseBenchmarkArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }

    relaunchWithLargerHeapIfNeeded();

    const absoluteWorkbookPath = workbookPath();
    const rows = await readSheet(absoluteWorkbookPath, { sheet: 1 });
    const result = runBlsRuntimeProfileBenchmark(rows, {
      mode: options.mode,
      limit: options.limit,
      profile: options.profile,
      dataWorkbookPath: DATA_WORKBOOK_PATH,
      sourceWorkbookSha256: sha256File(absoluteWorkbookPath),
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify(errorPayload(error), null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
