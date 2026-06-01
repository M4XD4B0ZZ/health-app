#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDryRunPlan } from './lib/overnight-queue-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = {
  OK: 0,
  INVALID_INPUT: 1,
  UNSAFE_QUEUE: 2
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { queuePath: null, pretty: false, help: false };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (!options.queuePath) options.queuePath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return `RALPH Overnight Dry-Run Queue Planner

USAGE:
  node scripts/agent/overnight-dry-run-plan.mjs <queue.json> [--pretty]

SAFETY:
  - Reads only the supplied queue JSON file
  - Executes no queued commands
  - Invokes no workers
  - Mutates no runtime, evidence, product, dependency, git, or environment state`;
}

function resolveQueuePath(queuePath) {
  return path.isAbsolute(queuePath) ? queuePath : path.resolve(projectRoot, queuePath);
}

function readQueue(queuePath) {
  const fullPath = resolveQueuePath(queuePath);
  const text = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(text);
}

function formatPretty(plan) {
  const lines = [];
  lines.push('RALPH Overnight Dry-Run Plan');
  lines.push('');
  lines.push(`Queue: ${plan.queue_id || '(missing)'}`);
  lines.push(`Valid: ${plan.valid}`);
  lines.push(`Critical findings: ${plan.findings.critical.length}`);
  lines.push(`Warnings: ${plan.findings.warnings.length}`);
  lines.push(`Info: ${plan.findings.info.length}`);
  lines.push('');
  lines.push('Execution: no queued tasks executed; no workers invoked; no runtime state mutated.');
  lines.push('');
  if (plan.findings.critical.length > 0) {
    lines.push('Critical Findings:');
    for (const item of plan.findings.critical) lines.push(`- [${item.code}] ${item.message}`);
    lines.push('');
  }
  lines.push('Task Summaries:');
  for (const task of plan.task_summaries) {
    lines.push(`- ${task.task_id || '(missing)'} ${task.class || '(missing class)'}: ${task.disposition}`);
  }
  lines.push('');
  lines.push('Recommended Human Actions:');
  for (const action of plan.recommended_next_human_actions) lines.push(`- ${action}`);
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

  try {
    const queue = readQueue(options.queuePath);
    const plan = buildDryRunPlan(queue);
    if (options.pretty) console.log(formatPretty(plan));
    else console.log(JSON.stringify(plan, null, 2));
    process.exit(plan.valid ? EXIT_CODES.OK : EXIT_CODES.UNSAFE_QUEUE);
  } catch (error) {
    const failure = {
      schema_version: '1.0.0',
      planner: 'overnight-dry-run-plan.mjs',
      valid: false,
      findings: {
        critical: [{ severity: 'critical', code: 'queue_read_or_parse_failed', message: error.message, details: { queue_path: options.queuePath } }],
        warnings: [],
        info: []
      },
      execution_plan: {
        mode: 'dry_run',
        queued_tasks_executed: 0,
        worker_invocations: 0,
        runtime_state_mutations: 0,
        commands_executed_from_queue: 0
      }
    };
    console.error(JSON.stringify(failure, null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { formatPretty };