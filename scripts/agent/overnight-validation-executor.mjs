#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeOvernightValidationQueue } from './lib/overnight-validation-executor.mjs';
import { writeOvernightReportBundle } from './lib/overnight-report-writer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = Object.freeze({
  OK: 0,
  INVALID_INPUT: 1,
  NOT_READY: 2,
  COMMAND_FAILED: 3,
  REPORT_WRITE_FAILED: 4
});

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { queuePath: null, pretty: false, help: false, writeReport: false, reportFormat: 'json,md' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--write-report') options.writeReport = true;
    else if (arg === '--report-format') {
      if (index + 1 >= args.length) throw new Error('--report-format requires a value');
      options.reportFormat = args[index + 1];
      index += 1;
    }
    else if (arg.startsWith('--report-format=')) options.reportFormat = arg.slice('--report-format='.length);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else if (!options.queuePath) options.queuePath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  validateReportFormatOption(options.reportFormat);
  return options;
}

function validateReportFormatOption(value) {
  const allowed = new Set(['json', 'md']);
  const formats = String(value || '').split(',').map((format) => format.trim().toLowerCase()).filter(Boolean);
  if (formats.length === 0) throw new Error('At least one report format is required');
  for (const format of formats) {
    if (!allowed.has(format)) throw new Error(`Unsupported report format: ${format}`);
  }
}

function usage() {
  return `RALPH Overnight Validation-Only Command Executor

USAGE:
  node scripts/agent/overnight-validation-executor.mjs <queue.json> [--pretty] [--write-report] [--report-format json|md|json,md]

SAFETY:
  - Reads only the supplied queue JSON file
  - Validates queue using RALPH-034A logic and RALPH-034C mapping
  - Executes only mapped validation/check command IDs through the RALPH-034B harness
  - Executes no queued task objectives, no queue allowed_commands, and no raw queue commands
  - Invokes no workers and mutates no runtime/evidence state
  - Writes no files by default
  - With --write-report, writes bounded non-authoritative reports only under .agent/overnight/reports/
  - Does not accept arbitrary output paths`;
}

function resolveQueuePath(queuePath) {
  return path.isAbsolute(queuePath) ? queuePath : path.resolve(projectRoot, queuePath);
}

function readQueue(queuePath) {
  const text = fs.readFileSync(resolveQueuePath(queuePath), 'utf8');
  return JSON.parse(text);
}

function formatPretty(output) {
  const lines = [];
  lines.push('RALPH Overnight Validation-Only Execution Result');
  lines.push('');
  lines.push(`Queue: ${output.queue_id || '(missing)'}`);
  lines.push(`Valid: ${output.valid}`);
  lines.push(`Mode: ${output.mode}`);
  lines.push(`Validation commands executed: ${output.execution_plan.validation_commands_executed}`);
  lines.push(`Passed: ${output.command_execution.passed}`);
  lines.push(`Failed: ${output.command_execution.failed}`);
  lines.push(`Timed out: ${output.command_execution.timed_out}`);
  lines.push(`Blocked: ${output.command_execution.blocked}`);
  lines.push('');
  lines.push('Safety: no queued task execution; no queue allowed_commands execution; no worker invocation; no runtime mutation; no product work; no commit; no push; no log write by default.');
  if (output.report_bundle?.files_written?.length > 0) {
    lines.push('');
    lines.push('Report files written:');
    for (const file of output.report_bundle.files_written) lines.push(`- ${file}`);
  }
  if (output.preflight.critical_findings.length > 0) {
    lines.push('');
    lines.push('Critical Findings:');
    for (const finding of output.preflight.critical_findings) lines.push(`- [${finding.code}] ${finding.message}`);
  }
  return lines.join('\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(EXIT_CODES.INVALID_INPUT);
  }

  if (options.help || !options.queuePath) {
    console.error(usage());
    process.exit(options.help ? EXIT_CODES.OK : EXIT_CODES.INVALID_INPUT);
  }

  let queue;
  try {
    queue = readQueue(options.queuePath);
  } catch (error) {
    const failure = {
      schema_version: '1.0.0',
      runner: 'overnight-validation-executor.mjs',
      mode: 'validation_only',
      valid: false,
      preflight: {
        working_tree_clean_before: false,
        working_tree_clean_after: false,
        critical_findings: [{ severity: 'critical', code: 'queue_read_or_parse_failed', message: error.message, details: { queue_path: options.queuePath } }]
      },
      execution_plan: {
        queued_tasks_executed: 0,
        worker_invocations: 0,
        runtime_state_mutations: 0,
        validation_commands_executed: 0,
        task_commands_executed: 0,
        product_work: 0,
        commits: false,
        push: false
      }
    };
    console.error(JSON.stringify(failure, null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }

  const output = await executeOvernightValidationQueue(queue);
  if (options.writeReport) {
    try {
      const bundle = writeOvernightReportBundle(output, { projectRoot, formats: options.reportFormat });
      output.report_bundle = {
        report_authority: bundle.report.report_authority,
        files_written: bundle.files_written.map((file) => file.relative_path),
        write_performed: true,
        arbitrary_output_paths_allowed: false,
        overwrite_allowed: false
      };
    } catch (error) {
      const failure = {
        schema_version: '1.0.0',
        runner: 'overnight-validation-executor.mjs',
        mode: 'validation_only',
        valid: false,
        report_write_failed: true,
        report_write_error: error.message,
        safety_summary: {
          no_task_execution: true,
          no_worker_invocation: true,
          no_runtime_state_mutation: true,
          no_product_work: true,
          no_commit: true,
          no_push: true,
          no_arbitrary_output_paths: true,
          no_overwrite_by_default: true
        }
      };
      console.error(JSON.stringify(failure, null, 2));
      process.exit(EXIT_CODES.REPORT_WRITE_FAILED);
    }
  }
  if (options.pretty) console.log(formatPretty(output));
  else console.log(JSON.stringify(output, null, 2));

  if (output.valid) process.exit(EXIT_CODES.OK);
  const commandProblem = output.command_execution.failed > 0
    || output.command_execution.timed_out > 0
    || output.command_execution.blocked > 0
    || output.preflight.critical_findings.some((finding) => finding.code === 'working_tree_dirty_after_execution');
  process.exit(commandProblem ? EXIT_CODES.COMMAND_FAILED : EXIT_CODES.NOT_READY);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { formatPretty, parseArgs };