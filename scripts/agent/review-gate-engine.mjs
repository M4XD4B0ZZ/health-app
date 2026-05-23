#!/usr/bin/env node

/**
 * Ralph V2 Review Gate Engine
 *
 * Evaluates canonical handoff JSON and produces a normalized review decision.
 * Dry-run mode prints the decision object and writes nothing.
 *
 * Usage:
 *   node scripts/agent/review-gate-engine.mjs --help
 *   node scripts/agent/review-gate-engine.mjs --input .agent/out/handoff.json --dry-run --json
 *   node scripts/agent/review-gate-engine.mjs --input .agent/out/handoff.json --output .agent/out/review-decision.json --json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildNormalizedReviewDecision,
  ENGINE_ID,
  loadCanonicalHandoffJson,
  resolveProjectPath,
  SCHEMA_VERSION
} from './lib/review-gate-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const DEFAULT_OUTPUT = '.agent/out/review-decision.json';

function requireValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    json: false,
    help: false
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--input') options.input = requireValue(args, i += 1, arg);
    else if (arg === '--output') options.output = requireValue(args, i += 1, arg);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.help) {
    if (!options.input || options.input.trim() === '') throw new Error('Missing required argument: --input <handoff.json>');
    if (options.dryRun && options.output) throw new Error('--output cannot be used with --dry-run');
  }

  return options;
}

function printHelp() {
  console.log(`Ralph V2 Review Gate Engine

USAGE:
  node scripts/agent/review-gate-engine.mjs --help
  node scripts/agent/review-gate-engine.mjs --input <handoff.json> --dry-run --json
  node scripts/agent/review-gate-engine.mjs --input <handoff.json> --output .agent/out/review-decision.json --json

OPTIONS:
  --input <handoff.json>     Required canonical handoff JSON from generate-canonical-handoff.mjs
  --output <decision.json>   Optional decision write target; defaults to ${DEFAULT_OUTPUT} when not dry-run
  --dry-run                  Print decision object and write nothing
  --json                     Print machine-readable JSON output
  --help                     Show this help message

SUPPORTED RESULTS:
  accepted
  needs_changes
  rejected

DECISION RULES:
  accepted       No critical findings, validation passed, review evidence present or pending, task done
  needs_changes  Warnings, optional evidence gaps, incomplete metadata, or non-blocking review concerns
  rejected       Critical findings, validation failure, malformed handoff, missing required fields

SAFETY:
  - Reads only the supplied handoff JSON
  - Dry-run writes nothing
  - Does not modify runtime state, review evidence, validation evidence, product code, ROADMAP, tasks, or runs`);
}

function outputPathFor(options) {
  return options.output || DEFAULT_OUTPUT;
}

function writeDecision(relativePath, decision, dryRun) {
  if (dryRun) return { dry_run: true, written: false, path: relativePath };
  const fullPath = resolveProjectPath(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(decision, null, 2)}\n`, 'utf8');
  return { dry_run: false, written: true, path: relativePath };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }

    const handoff = loadCanonicalHandoffJson(options.input, { readLabel: 'Unable to read input handoff' });
    const decision = buildNormalizedReviewDecision(handoff, { invalidResultMessage: 'Invalid review result' });
    const target = outputPathFor(options);
    const writeResult = writeDecision(target, decision, options.dryRun);

    if (options.dryRun || options.json) {
      process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
    } else {
      console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, engine: ENGINE_ID, target, write_result: writeResult }, null, 2));
    }
  } catch (error) {
    console.error(`Ralph review gate engine error: ${error.message}`);
    process.exitCode = 2;
  }
}

main();