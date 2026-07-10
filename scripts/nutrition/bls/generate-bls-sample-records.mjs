#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { readSheet } from 'read-excel-file/node';

import {
  DATA_WORKBOOK_PATH,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TOOL_ID,
  buildBlsSampleRecords,
  countColumns,
} from './lib/bls-sample-generator.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = process.cwd();
const REQUIRED_HEAP_MB = 8192;
const RELAUNCH_ENV = 'BLS_SAMPLE_GENERATOR_HEAP_RELAUNCHED';

const FORBIDDEN_FLAG_PATTERNS = [
  /^--(?:write|out|output|stage|commit|push|deploy|fix|format|mutate)(?:$|=)/,
  /^-(?:o|w)$/,
];

function errorPayload(error, extras = {}) {
  return {
    tool: TOOL_ID,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    writesFiles: false,
    generatesBlsIndexArtifacts: false,
    modifiesRuntimeBlsSourceBehavior: false,
    packageFilesModified: false,
    ...extras,
  };
}

function parseLimitValue(value) {
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
  const options = { limit: DEFAULT_LIMIT, help: false };
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
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
      throw new Error(`Positional paths are refused; output is stdout-only: ${arg}`);
    }
  }

  return options;
}

export function usage() {
  return `P1-006C2 BLS sample record generator

USAGE:
  node scripts/nutrition/bls/generate-bls-sample-records.mjs [--limit ${DEFAULT_LIMIT}]

SAFETY:
  - Reads the official BLS data workbook
  - Emits deterministic JSON to stdout only
  - Writes no files and generates no BLS index artifacts
  - Refuses write/output/mutation flags and positional output paths
  - Limit must be an integer from 1 to ${MAX_LIMIT}`;
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
    const sample = buildBlsSampleRecords(workbook.rows, {
      limit: options.limit,
      sourceWorkbookSha256: workbook.sha256,
    });

    const payload = {
      tool: TOOL_ID,
      ok: true,
      mode: 'read-only-stdout-only',
      writesFiles: false,
      generatesBlsIndexArtifacts: false,
      modifiesRuntimeBlsSourceBehavior: false,
      packageFilesModified: false,
      deterministic: true,
      limit: options.limit,
      sourceFiles: {
        dataWorkbook: {
          role: 'data',
          path: DATA_WORKBOOK_PATH,
          sha256: workbook.sha256,
          sheetSelection: {
            selector: 1,
            limitation:
              'The first worksheet is read explicitly to avoid loading all workbook sheets.',
          },
          workbookRows: workbook.rows.length,
          dataRowsAvailable: workbook.rows.length - sample.mapping.headerRowNumber,
          columnCount: countColumns(workbook.rows),
        },
      },
      mapping: sample.mapping,
      records: sample.records,
    };

    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error(JSON.stringify(errorPayload(error), null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
