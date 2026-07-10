#!/usr/bin/env node

/**
 * Ralph V2 Category-Aware Validator
 *
 * Determines the VERIFY.md validation category from changed files and optional
 * CLI input, then emits a structured validation result object. Dry-run is the
 * default. Execute mode is intentionally conservative: commands are run one by
 * one via shell-free process execution, with command chaining metacharacters
 * rejected before execution.
 *
 * Usage:
 *   node scripts/agent/ralph-validate-category.mjs --help
 *   node scripts/agent/ralph-validate-category.mjs --category documentation-only --dry-run
 *   node scripts/agent/ralph-validate-category.mjs --category governance-script-only --script scripts/agent/ralph-state-transitions.mjs --dry-run
 *   node scripts/agent/ralph-validate-category.mjs --json --category documentation-only --dry-run
 */

import { execFileSync, spawnSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const SCHEMA_VERSION = '2.0.0';
const VALIDATOR_ID = 'ralph-v2-category-validator';

const CATEGORIES = new Set([
  'documentation-only',
  'governance-only',
  'test-only',
  'product-runtime-code',
  'edge-supabase',
  'dependency-change',
  'runtime-state-only',
  'governance-script-only',
]);

const CATEGORY_PRIORITY = [
  'documentation-only',
  'governance-only',
  'test-only',
  'runtime-state-only',
  'governance-script-only',
  'product-runtime-code',
  'edge-supabase',
  'dependency-change',
];

const READBACK_CHECKS = [
  'git --no-pager status --short',
  'git --no-pager diff --stat',
  'git --no-pager diff --name-only',
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

function validationId(timestamp, taskId) {
  const taskPart = String(taskId || 'unscoped').toLowerCase();
  return `val_${normalizeTimestampForId(timestamp)}_${taskPart}_${nonce()}`;
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    execute: false,
    json: false,
    help: false,
    scripts: [],
    changedFiles: [],
    taskSpecificTests: [],
    taskSpecificDryRuns: [],
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--execute') {
      options.execute = true;
      options.dryRun = false;
    } else if (arg === '--category') options.category = requireValue(args, (i += 1), arg);
    else if (arg === '--task-id') options.taskId = requireValue(args, (i += 1), arg);
    else if (arg === '--run-id') options.runId = requireValue(args, (i += 1), arg);
    else if (arg === '--script') options.scripts.push(requireValue(args, (i += 1), arg));
    else if (arg === '--changed-file') options.changedFiles.push(requireValue(args, (i += 1), arg));
    else if (arg === '--test-command')
      options.taskSpecificTests.push(requireValue(args, (i += 1), arg));
    else if (arg === '--dry-run-command')
      options.taskSpecificDryRuns.push(requireValue(args, (i += 1), arg));
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.category && !CATEGORIES.has(options.category)) {
    throw new Error(`Unsupported category: ${options.category}`);
  }
  return options;
}

function requireValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function printHelp() {
  console.log(`Ralph V2 Category-Aware Validator

USAGE:
  node scripts/agent/ralph-validate-category.mjs --help
  node scripts/agent/ralph-validate-category.mjs --category documentation-only --dry-run
  node scripts/agent/ralph-validate-category.mjs --category governance-script-only --script scripts/agent/ralph-state-transitions.mjs --dry-run
  node scripts/agent/ralph-validate-category.mjs --json --category documentation-only --dry-run

OPTIONS:
  --category <name>          Optional explicit VERIFY.md category
  --changed-file <path>      Optional changed-file basis; repeatable
  --script <path>            Changed governance script for node --check; repeatable
  --test-command <command>   Task-relevant test/regression command; repeatable
  --dry-run                  Plan validation only; default behavior
  --execute                  Conservatively execute planned checks one by one
  --json                     Emit JSON only
  --task-id <id>             Optional task identity for result object
  --run-id <id>              Optional run identity for result object
  --help                     Show this help message

SUPPORTED CATEGORIES:
  documentation-only, governance-only, test-only, product-runtime-code,
  edge-supabase, dependency-change, runtime-state-only, governance-script-only

SAFETY:
  - writes_performed is always false.
  - This script never appends validation/validation-results.jsonl.
  - Dry-run is the default unless --execute is explicitly passed.
  - Execute mode rejects command chaining tokens: &&, ;, ||, |.`);
}

function getGitChangedFiles() {
  try {
    const output = execFileSync('git', ['--no-pager', 'status', '--short'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map(parseGitStatusPath)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseGitStatusPath(line) {
  const payload = line.slice(3).trim();
  if (!payload) return null;
  const renameArrow = ' -> ';
  if (payload.includes(renameArrow)) return normalizePath(payload.split(renameArrow).pop());
  return normalizePath(payload);
}

function normalizePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function isMarkdownOrDocs(filePath) {
  return /(^docs\/|^reports\/|^handoffs\/|^plans\/|\.md$)/.test(filePath);
}

function isGovernanceText(filePath) {
  return (
    /^(AGENTS\.md|SSOK\.md|VERIFY\.md|ROADMAP\.md)$/.test(filePath) ||
    /^\.governance\/.*\.md$/.test(filePath)
  );
}

function isTestFile(filePath) {
  return /(^__tests__\/|\/__tests__\/|\.test\.[cm]?[jt]sx?$|\.spec\.[cm]?[jt]sx?$|^test-|\/test-|^.*test\.js$)/i.test(
    filePath,
  );
}

function isRuntimeStateFile(filePath) {
  return /^(tasks\/|runs\/|validation\/validation-results\.jsonl$)/.test(filePath);
}

function isGovernanceScript(filePath) {
  return /^scripts\/agent\/.*\.mjs$/.test(filePath);
}

function isEdgeSupabase(filePath) {
  return /^supabase\//.test(filePath);
}

function isDependencyFile(filePath) {
  return /^(package\.json|package-lock\.json|npm-shrinkwrap\.json)$/.test(filePath);
}

function isProductRuntime(filePath) {
  if (/^src\//.test(filePath)) return !isTestFile(filePath);
  return /^(App\.tsx|Apptest\.tsx|index\.ts|app\.json|babel\.config\.js|jest\.config\.js|tsconfig\.json)$/.test(
    filePath,
  );
}

function categoryForFile(filePath) {
  const normalized = normalizePath(filePath);
  if (isDependencyFile(normalized)) return 'dependency-change';
  if (isEdgeSupabase(normalized)) return 'edge-supabase';
  if (isProductRuntime(normalized)) return 'product-runtime-code';
  if (isGovernanceScript(normalized)) return 'governance-script-only';
  if (isRuntimeStateFile(normalized)) return 'runtime-state-only';
  if (isTestFile(normalized)) return 'test-only';
  if (isGovernanceText(normalized)) return 'governance-only';
  if (isMarkdownOrDocs(normalized)) return 'documentation-only';
  return 'product-runtime-code';
}

function resolveCategory(options, changedFiles) {
  if (options.category) return { category: options.category, source: 'cli' };
  if (changedFiles.length === 0)
    return { category: 'documentation-only', source: 'default_no_changed_files' };

  const detected = new Set(changedFiles.map(categoryForFile));
  let selected = 'documentation-only';
  for (const category of detected) {
    if (CATEGORY_PRIORITY.indexOf(category) > CATEGORY_PRIORITY.indexOf(selected))
      selected = category;
  }
  return { category: selected, source: 'changed_files' };
}

function commandSpec(command, { required = true, blocking = true, source = 'VERIFY.md' } = {}) {
  return { command, required, blocking, source };
}

function buildValidationPlan(category, options, changedFiles) {
  const runtimeChanged = changedFiles.some((file) => isProductRuntime(file));
  const scripts =
    options.scripts.length > 0
      ? options.scripts
      : changedFiles.filter((file) => categoryForFile(file) === 'governance-script-only');

  const taskTests = options.taskSpecificTests.map((command) =>
    commandSpec(command, { source: 'task-specific' }),
  );
  const taskDryRuns = options.taskSpecificDryRuns.map((command) =>
    commandSpec(command, { source: 'task-specific-dry-run' }),
  );

  if (category === 'documentation-only') {
    return {
      required: READBACK_CHECKS.map((command) => commandSpec(command)),
      optional: [
        commandSpec('npm run verify', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
      ],
    };
  }

  if (category === 'governance-only') {
    return {
      required: READBACK_CHECKS.map((command) => commandSpec(command)),
      optional: [
        commandSpec('npm run verify', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
      ],
    };
  }

  if (category === 'test-only') {
    return {
      required: [...taskTests, ...READBACK_CHECKS.map((command) => commandSpec(command))],
      optional: [
        commandSpec('npm run test', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
        commandSpec('npm run verify', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
      ],
    };
  }

  if (category === 'product-runtime-code') {
    return {
      required: [commandSpec('npm run verify')],
      optional: [
        commandSpec('npm run lint', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
        commandSpec('npm run typecheck', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
        commandSpec('npm run test', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
        commandSpec('npm run doctor', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
      ],
    };
  }

  if (category === 'edge-supabase') {
    const required = [
      commandSpec('npm run verify:supabase:link'),
      commandSpec('npm run verify:schema'),
      commandSpec('npm run verify:edge'),
    ];
    if (runtimeChanged) required.push(commandSpec('npm run verify'));
    return {
      required,
      optional: [
        commandSpec('npm run typecheck:functions', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
        commandSpec('npm run doctor', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
      ],
    };
  }

  if (category === 'dependency-change') {
    return {
      required: [commandSpec('npm run verify'), ...taskTests],
      optional: [
        commandSpec('npm run doctor', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional',
        }),
        commandSpec('npm audit', {
          required: false,
          blocking: false,
          source: 'VERIFY.md optional read-only',
        }),
      ],
    };
  }

  if (category === 'runtime-state-only') {
    return {
      required: [
        commandSpec('node scripts/agent/validate-ralph-state.mjs'),
        ...READBACK_CHECKS.map((command) => commandSpec(command)),
      ],
      optional: [],
    };
  }

  if (category === 'governance-script-only') {
    const nodeChecks = scripts.map((script) => commandSpec(`node --check ${script}`));
    return {
      required: [
        ...nodeChecks,
        ...taskDryRuns,
        ...READBACK_CHECKS.map((command) => commandSpec(command)),
      ],
      optional: [],
    };
  }

  throw new Error(`Unhandled category: ${category}`);
}

function containsForbiddenCommandToken(command) {
  return FORBIDDEN_COMMAND_TOKENS.some((token) => command.includes(token));
}

function splitCommand(command) {
  if (containsForbiddenCommandToken(command)) {
    throw new Error(`Command contains forbidden chaining token: ${command}`);
  }

  const tokens = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if ((char === '"' || char === "'") && quote === null) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (/\s/.test(char) && quote === null) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (quote !== null) throw new Error(`Unclosed quote in command: ${command}`);
  if (current) tokens.push(current);
  if (tokens.length === 0) throw new Error('Empty command is not executable');
  return { file: tokens[0], args: tokens.slice(1) };
}

function executeChecks(commandSpecs) {
  const executed = [];
  for (const spec of commandSpecs) {
    const startedAt = nowIso();
    try {
      const parsed = splitCommand(spec.command);
      const result = spawnSync(parsed.file, parsed.args, {
        cwd: projectRoot,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      });
      executed.push({
        command: spec.command,
        required: spec.required,
        blocking: spec.blocking,
        status: result.status === 0 ? 'passed' : 'failed',
        exit_code: result.status,
        signal: result.signal,
        started_at: startedAt,
        completed_at: nowIso(),
        stdout_excerpt: excerpt(result.stdout),
        stderr_excerpt: excerpt(result.stderr),
      });
    } catch (error) {
      executed.push({
        command: spec.command,
        required: spec.required,
        blocking: spec.blocking,
        status: 'failed',
        exit_code: 2,
        started_at: startedAt,
        completed_at: nowIso(),
        error: error.message,
      });
    }
  }
  return executed;
}

function excerpt(value, limit = 4000) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit)}\n...[truncated]` : text;
}

function buildResult(options) {
  const timestamp = nowIso();
  const changedFiles =
    options.changedFiles.length > 0
      ? options.changedFiles.map(normalizePath)
      : getGitChangedFiles();
  const categoryResolution = resolveCategory(options, changedFiles);
  const plan = buildValidationPlan(categoryResolution.category, options, changedFiles);
  const commandsPlanned = plan.required.map((spec) => ({ ...spec }));
  const commandsExecuted = options.execute ? executeChecks(commandsPlanned) : [];
  const failedBlocking = commandsExecuted.filter(
    (check) => check.blocking && check.status !== 'passed',
  );

  const overallResult = options.execute
    ? failedBlocking.length === 0
      ? 'passed'
      : 'failed'
    : 'planned';

  return {
    schema_version: SCHEMA_VERSION,
    validation_id: validationId(timestamp, options.taskId),
    timestamp,
    validator: { type: 'validator', id: VALIDATOR_ID },
    ...(options.taskId ? { task_id: options.taskId } : {}),
    ...(options.runId ? { run_id: options.runId } : {}),
    category: categoryResolution.category,
    category_source: categoryResolution.source,
    changed_files_basis: changedFiles,
    required_checks: plan.required.map((check) => check.command),
    optional_checks: plan.optional.map((check) => check.command),
    blocking_checks: plan.required.filter((check) => check.blocking).map((check) => check.command),
    commands_planned: commandsPlanned,
    commands_executed: commandsExecuted,
    dry_run: !options.execute,
    overall_result: overallResult,
    writes_performed: false,
    append_validation_results_jsonl: false,
    verify_md_rule_reference: 'VERIFY.md canonical verification decision table',
    validation_rules_reference:
      'validation/validation-rules.json read as structured non-weakening rule catalog',
    safety_notes: [
      'No runtime state mutations are performed.',
      'No automatic repairs are performed.',
      'No validation-results.jsonl append is performed.',
      'Execute mode runs planned commands one by one without shell command chaining.',
    ],
  };
}

function formatHuman(result) {
  const lines = [];
  lines.push('# Ralph V2 Category-Aware Validator');
  lines.push('');
  lines.push(`Validation ID: ${result.validation_id}`);
  if (result.task_id) lines.push(`Task ID: ${result.task_id}`);
  if (result.run_id) lines.push(`Run ID: ${result.run_id}`);
  lines.push(`Category: ${result.category} (${result.category_source})`);
  lines.push(`Mode: ${result.dry_run ? 'dry-run' : 'execute'}`);
  lines.push(`Overall result: ${result.overall_result}`);
  lines.push(`Writes performed: ${result.writes_performed}`);
  lines.push('');
  lines.push('## Required Checks');
  lines.push(
    ...(result.required_checks.length
      ? result.required_checks.map((check) => `- ${check}`)
      : ['- None']),
  );
  lines.push('');
  lines.push('## Optional Checks');
  lines.push(
    ...(result.optional_checks.length
      ? result.optional_checks.map((check) => `- ${check}`)
      : ['- None']),
  );
  lines.push('');
  lines.push('## Blocking Checks');
  lines.push(
    ...(result.blocking_checks.length
      ? result.blocking_checks.map((check) => `- ${check}`)
      : ['- None']),
  );
  lines.push('');
  lines.push('## Commands Planned');
  lines.push(
    ...(result.commands_planned.length
      ? result.commands_planned.map((check) => `- ${check.command}`)
      : ['- None']),
  );
  lines.push('');
  lines.push('## Commands Executed');
  if (result.commands_executed.length === 0) {
    lines.push('- None (dry-run)');
  } else {
    lines.push(
      ...result.commands_executed.map(
        (check) => `- [${check.status}] ${check.command} (exit ${check.exit_code})`,
      ),
    );
  }
  lines.push('');
  lines.push('## Changed Files Basis');
  lines.push(
    ...(result.changed_files_basis.length
      ? result.changed_files_basis.map((file) => `- ${file}`)
      : ['- None detected/provided']),
  );
  return lines.join('\n');
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }
    const result = buildResult(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatHuman(result));
    process.exitCode = result.overall_result === 'failed' ? 1 : 0;
  } catch (error) {
    const payload = {
      schema_version: SCHEMA_VERSION,
      timestamp: nowIso(),
      validator: { type: 'validator', id: VALIDATOR_ID },
      overall_result: 'validator_execution_error',
      writes_performed: false,
      error: error.message,
    };
    if (process.argv.includes('--json')) console.error(JSON.stringify(payload, null, 2));
    else console.error(`Ralph category validator error: ${error.message}`);
    process.exitCode = 2;
  }
}

main();
