#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildOvernightValidationPlan } from './lib/overnight-validation-plan.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = {
  OK: 0,
  INVALID_INPUT: 1,
  NOT_READY: 2,
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
  return `RALPH Overnight Validation-Only Queue/Harness Integration Planner

USAGE:
  node scripts/agent/overnight-validation-plan.mjs <queue.json> [--pretty]

SAFETY:
  - Reads only the supplied queue JSON file
  - Validates queue using RALPH-034A logic
  - Maps required_checks to RALPH-034B command allowlist IDs
  - Executes no commands (validation or otherwise)
  - Executes no queued tasks
  - Invokes no workers
  - Mutates no runtime, evidence, product, dependency, git, or environment state
  - Writes no files by default

RALPH-034C is plan-only. Validation command execution is deferred to future task.`;
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
  lines.push('RALPH Overnight Validation Plan');
  lines.push('');
  lines.push(`Queue: ${plan.queue_id || '(missing)'}`);
  lines.push(`Mode: ${plan.mode}`);
  lines.push(`Valid: ${plan.valid}`);
  lines.push(
    `Ready for validation execution: ${plan.execution_readiness.ready_for_validation_execution}`,
  );
  lines.push('');
  lines.push('Check Mapping:');
  lines.push(`- Total checks: ${plan.check_mapping.total_checks}`);
  lines.push(`- Mapped: ${plan.check_mapping.mapped_checks}`);
  lines.push(`- Unmapped: ${plan.check_mapping.unmapped_checks}`);
  lines.push(`- Blocked: ${plan.check_mapping.blocked_checks}`);
  lines.push('');
  if (plan.execution_readiness.blocking_reasons.length > 0) {
    lines.push('Blocking Reasons:');
    for (const reason of plan.execution_readiness.blocking_reasons) {
      lines.push(`- ${reason}`);
    }
    lines.push('');
  }
  lines.push(
    'Execution: no queued tasks executed; no validation commands executed; no workers invoked; no runtime state mutated.',
  );
  lines.push('');
  lines.push('Task Summaries:');
  for (const task of plan.task_summaries) {
    lines.push(
      `- ${task.task_id || '(missing)'} ${task.class || '(missing class)'}: ${task.required_checks_count} checks (${task.mapped_count} mapped, ${task.unmapped_count} unmapped, ${task.blocked_count} blocked)`,
    );
  }
  lines.push('');
  lines.push('Recommended Human Actions:');
  for (const action of plan.recommended_human_actions) {
    lines.push(`- ${action}`);
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

  try {
    const queue = readQueue(options.queuePath);
    const plan = buildOvernightValidationPlan(queue);
    if (options.pretty) console.log(formatPretty(plan));
    else console.log(JSON.stringify(plan, null, 2));
    process.exit(
      plan.execution_readiness.ready_for_validation_execution
        ? EXIT_CODES.OK
        : EXIT_CODES.NOT_READY,
    );
  } catch (error) {
    const failure = {
      schema_version: '1.0.0',
      planner: 'overnight-validation-plan.mjs',
      mode: 'validation_plan',
      valid: false,
      queue_validation: {
        critical: [
          {
            severity: 'critical',
            code: 'queue_read_or_parse_failed',
            message: error.message,
            details: { queue_path: options.queuePath },
          },
        ],
        warnings: [],
        info: [],
      },
      execution_plan: {
        mode: 'validation_plan',
        queued_tasks_executed: 0,
        worker_invocations: 0,
        runtime_state_mutations: 0,
        validation_commands_executed: 0,
      },
    };
    console.error(JSON.stringify(failure, null, 2));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { formatPretty };
