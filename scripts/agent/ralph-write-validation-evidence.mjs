#!/usr/bin/env node

/**
 * Ralph V2 Validation Evidence Writer
 *
 * Converts structured validator result objects into normalized Ralph V2
 * validation events. Dry-run is the default and prints the planned event.
 * Real appends require both --append and --confirm-append.
 *
 * Usage:
 *   node scripts/agent/ralph-write-validation-evidence.mjs --help
 *   node scripts/agent/ralph-write-validation-evidence.mjs --input .agent/out/sample-validation-result.json
 *   node scripts/agent/ralph-write-validation-evidence.mjs --stdin
 *   node scripts/agent/ralph-write-validation-evidence.mjs --input .agent/out/sample-validation-result.json --append --confirm-append
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { appendJsonlEvent, PATHS, SCHEMA_VERSION } from './ralph-state-transitions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const WRITER_ID = 'ralph-v2-validation-evidence-writer';
const VALID_RESULTS = new Map([
  ['passed', 'validation.completed'],
  ['failed', 'validation.failed'],
  ['blocked', 'validation.blocked'],
]);
const REQUIRED_FIELDS = [
  'validation_id',
  'category',
  'required_checks',
  'blocking_checks',
  'overall_result',
  'writes_performed',
];
const FORBIDDEN_COMMAND_TOKENS = ['&&', ';', '||', '|'];

function nowIso() {
  return new Date().toISOString();
}

function normalizeTimestampForId(timestamp) {
  return timestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function nonce(length = 6) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

function parseArgs(argv) {
  const options = {
    append: false,
    confirmAppend: false,
    allowSourceWrites: false,
    stdin: false,
    help: false,
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--input') options.input = requireValue(args, (i += 1), arg);
    else if (arg === '--stdin') options.stdin = true;
    else if (arg === '--append') options.append = true;
    else if (arg === '--confirm-append') options.confirmAppend = true;
    else if (arg === '--allow-source-writes') options.allowSourceWrites = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.help) {
    if ((options.input && options.stdin) || (!options.input && !options.stdin)) {
      throw new Error('Provide exactly one input source: --input <path> or --stdin');
    }
    if (options.confirmAppend && !options.append) {
      throw new Error('--confirm-append is only valid together with --append');
    }
  }
  return options;
}

function requireValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function printHelp() {
  console.log(`Ralph V2 Validation Evidence Writer

USAGE:
  node scripts/agent/ralph-write-validation-evidence.mjs --help
  node scripts/agent/ralph-write-validation-evidence.mjs --input .agent/out/sample-validation-result.json
  node scripts/agent/ralph-write-validation-evidence.mjs --stdin
  node scripts/agent/ralph-write-validation-evidence.mjs --input .agent/out/sample-validation-result.json --append --confirm-append

OPTIONS:
  --input <path>          Read a structured validation result JSON object from a file
  --stdin                 Read a structured validation result JSON object from stdin
  --append                Enable append mode; still requires --confirm-append
  --confirm-append        Confirm exactly one JSONL append to validation/validation-results.jsonl
  --allow-source-writes   Accept source validation objects where writes_performed is true
  --help                  Show this help message

DEFAULT BEHAVIOR:
  Dry-run only. The planned normalized validation event is printed and no files are written.

APPEND SAFETY:
  Real writes require both --append and --confirm-append. The writer appends exactly one JSONL
  line to validation/validation-results.jsonl through the Ralph state-transition append helper.
  Existing validation results are never rewritten or deleted.

SUPPORTED OVERALL RESULTS:
  passed  -> validation.completed
  failed  -> validation.failed
  blocked -> validation.blocked

SAFETY:
  - Rejects missing required fields.
  - Rejects source objects with writes_performed=true unless --allow-source-writes is passed.
  - Rejects command chaining tokens in command strings stored inside checks.
  - Does not execute any commands.`);
}

function readInput(options) {
  if (options.stdin) return fs.readFileSync(0, 'utf8');
  const fullPath = path.isAbsolute(options.input)
    ? options.input
    : path.resolve(projectRoot, options.input);
  return fs.readFileSync(fullPath, 'utf8');
}

function parseJsonObject(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Input must be a single JSON object');
  }
  return parsed;
}

function validateRequiredFields(result, options) {
  const missing = REQUIRED_FIELDS.filter(
    (field) => result[field] === undefined || result[field] === null,
  );
  if (missing.length > 0) throw new Error(`Missing required field(s): ${missing.join(', ')}`);
  if (!result.category) throw new Error('Missing category');
  if (!result.overall_result) throw new Error('Missing overall_result');
  if (!Array.isArray(result.required_checks)) throw new Error('required_checks must be an array');
  if (!Array.isArray(result.blocking_checks)) throw new Error('blocking_checks must be an array');
  if (result.writes_performed === true && !options.allowSourceWrites) {
    throw new Error(
      'Source validation result has writes_performed=true; pass --allow-source-writes to accept it',
    );
  }
  if (typeof result.validation_id !== 'string' || result.validation_id.trim() === '') {
    throw new Error('validation_id must be a non-empty string');
  }
}

function normalizeOverallResult(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function eventTypeForOverallResult(overallResult) {
  const normalized = normalizeOverallResult(overallResult);
  const eventType = VALID_RESULTS.get(normalized);
  if (!eventType) {
    throw new Error(
      `Unsupported overall_result: ${overallResult}. Expected one of: passed, failed, blocked`,
    );
  }
  return eventType;
}

function containsForbiddenCommandToken(command) {
  return FORBIDDEN_COMMAND_TOKENS.some((token) => command.includes(token));
}

function commandFromCheck(check) {
  if (typeof check === 'string') return check;
  if (check && typeof check === 'object' && typeof check.command === 'string') return check.command;
  return null;
}

function collectCommandStrings(value, commands = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectCommandStrings(item, commands);
    return commands;
  }
  const command = commandFromCheck(value);
  if (command) commands.push(command);
  return commands;
}

function validateCommandSafety(result) {
  const commandStrings = [
    ...collectCommandStrings(result.required_checks),
    ...collectCommandStrings(result.blocking_checks),
    ...collectCommandStrings(result.checks),
    ...collectCommandStrings(result.commands_planned),
    ...collectCommandStrings(result.commands_executed),
  ];

  const unsafe = commandStrings.filter((command) => containsForbiddenCommandToken(command));
  if (unsafe.length > 0) {
    throw new Error(`Unsafe command string contains command-chaining token: ${unsafe[0]}`);
  }
}

function normalizeChecks(result) {
  const rawChecks = Array.isArray(result.checks)
    ? result.checks
    : Array.isArray(result.commands_executed) && result.commands_executed.length > 0
      ? result.commands_executed
      : Array.isArray(result.commands_planned)
        ? result.commands_planned
        : result.required_checks;

  return rawChecks.map((check, index) => {
    if (typeof check === 'string') {
      return {
        check_id: `check_${index + 1}`,
        command: check,
        required: result.required_checks.includes(check),
        blocking: result.blocking_checks.includes(check),
        status:
          normalizeOverallResult(result.overall_result) === 'passed' ? 'passed' : 'not_executed',
      };
    }
    if (!check || typeof check !== 'object') {
      return {
        check_id: `check_${index + 1}`,
        required: false,
        blocking: false,
        status: 'unknown',
      };
    }
    return {
      check_id: check.check_id || check.id || `check_${index + 1}`,
      ...(check.command ? { command: check.command } : {}),
      required:
        check.required === undefined
          ? result.required_checks.includes(check.command)
          : Boolean(check.required),
      blocking:
        check.blocking === undefined
          ? result.blocking_checks.includes(check.command)
          : Boolean(check.blocking),
      status:
        check.status ||
        (normalizeOverallResult(result.overall_result) === 'passed' ? 'passed' : 'unknown'),
      ...(check.exit_code !== undefined ? { exit_code: check.exit_code } : {}),
      ...(check.signal !== undefined ? { signal: check.signal } : {}),
      ...(check.started_at ? { started_at: check.started_at } : {}),
      ...(check.completed_at ? { completed_at: check.completed_at } : {}),
      ...(check.stdout_excerpt ? { stdout_excerpt: check.stdout_excerpt } : {}),
      ...(check.stderr_excerpt ? { stderr_excerpt: check.stderr_excerpt } : {}),
      ...(check.error ? { error: check.error } : {}),
    };
  });
}

function normalizeActor(result) {
  const sourceActor = result.actor || result.validator;
  if (sourceActor && typeof sourceActor === 'object') {
    return {
      type: sourceActor.type || 'validator',
      id: sourceActor.id || WRITER_ID,
    };
  }
  return { type: 'validator', id: WRITER_ID };
}

function sourceDescriptor(options, result) {
  return {
    writer: WRITER_ID,
    input: options.stdin ? 'stdin' : options.input,
    source_validator: result.validator || null,
    source_category_source: result.category_source || null,
    source_writes_performed: Boolean(result.writes_performed),
    source_dry_run: result.dry_run === undefined ? null : Boolean(result.dry_run),
  };
}

function buildValidationEvent(result, options) {
  validateRequiredFields(result, options);
  validateCommandSafety(result);

  const timestamp = nowIso();
  const stamp = normalizeTimestampForId(timestamp);
  const eventType = eventTypeForOverallResult(result.overall_result);
  const normalizedOverallResult = normalizeOverallResult(result.overall_result);
  const event = {
    schema_version: SCHEMA_VERSION,
    validation_id: result.validation_id,
    event_id: `evt_${stamp}_${eventType.replace(/\./g, '_')}_${nonce()}`,
    event_type: eventType,
    timestamp,
    ...(result.task_id ? { task_id: result.task_id } : {}),
    ...(result.run_id ? { run_id: result.run_id } : {}),
    ...(result.correlation_id ? { correlation_id: result.correlation_id } : {}),
    actor: normalizeActor(result),
    verify_category: result.category,
    required_checks: result.required_checks,
    blocking_checks: result.blocking_checks,
    checks: normalizeChecks(result),
    overall_result: normalizedOverallResult,
    npm_verify_required: Boolean(result.npm_verify_required),
    npm_verify_executed: Boolean(result.npm_verify_executed),
    source: sourceDescriptor(options, result),
  };

  if (!event.correlation_id && (event.task_id || event.run_id)) {
    event.correlation_id = `corr_${stamp}_${String(event.task_id || event.run_id).toLowerCase()}_${nonce()}`;
  }
  if (result.verify_md_rule_reference)
    event.verify_md_rule_reference = result.verify_md_rule_reference;
  if (result.validation_rules_reference)
    event.validation_rules_reference = result.validation_rules_reference;
  if (result.changed_files_basis) event.changed_files_basis = result.changed_files_basis;
  if (result.failure_reason) event.failure_reason = result.failure_reason;
  return event;
}

function buildOutput(event, appendResult, options) {
  return {
    schema_version: SCHEMA_VERSION,
    writer: { type: 'validator', id: WRITER_ID },
    timestamp: nowIso(),
    dry_run: !(options.append && options.confirmAppend),
    writes_performed: Boolean(appendResult?.written),
    append_requested: options.append,
    append_confirmed: options.confirmAppend,
    target: PATHS.validationResults,
    planned_event: event,
    append_result: appendResult,
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }

    const result = parseJsonObject(readInput(options));
    const event = buildValidationEvent(result, options);
    const shouldAppend = options.append && options.confirmAppend;
    const appendResult = appendJsonlEvent(PATHS.validationResults, event, {
      dryRun: !shouldAppend,
    });
    console.log(JSON.stringify(buildOutput(event, appendResult, options), null, 2));
  } catch (error) {
    console.error(`Ralph validation evidence writer error: ${error.message}`);
    process.exitCode = 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
