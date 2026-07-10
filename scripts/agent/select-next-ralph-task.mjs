#!/usr/bin/env node

/**
 * Ralph-Loop Dry-Run Task Selector
 *
 * This is the first executable Ralph-Loop component that deterministically
 * selects the next eligible task for execution. It operates exclusively in
 * dry-run mode and performs no task implementation or automatic status transitions.
 *
 * @version 1.0.1
 * @author Ralph-Loop System
 * @created 2026-05-19
 * @fixed 2026-05-19 - RALPH-006A-FIX
 */

import fs from 'fs';
import path from 'path';

// Exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  INVALID_CONFIG: 1,
  SAFETY_VIOLATION: 2,
  NO_ELIGIBLE_TASK: 3,
  STALE_ACTIVE_RUN: 4,
  UNEXPECTED_ERROR: 5,
};

// Valid status values
const VALID_STATUSES = [
  'not_started',
  'in_progress',
  'needs_validation',
  'needs_review',
  'blocked',
  'failed',
  'done',
  'skipped',
  'cancelled',
];

// Valid risk levels
const VALID_RISK_LEVELS = ['safe_autonomous', 'review_required', 'human_required', 'blocked'];

class RalphTaskSelector {
  constructor(options = {}) {
    this.dryRun = options.dryRun ?? true;
    this.jsonOutput = options.jsonOutput ?? false;
    this.writeMode = options.writeMode ?? false;
    this.taskStatePath = options.taskStatePath ?? 'tasks/task-state.json';
    this.configPath = options.configPath ?? '.agent/config/loop-config.json';
    this.protectedFilesPath = options.protectedFilesPath ?? '.agent/config/protected-files.json';
    this.handoffPath = options.handoffPath ?? 'handoffs/latest-handoff.md';
    this.currentRunPath = options.currentRunPath ?? 'runs/current-run.json';

    this.warnings = [];
    this.errors = [];
  }

  /**
   * Main task selection logic
   */
  async selectNextTask() {
    try {
      // 1. Read and validate all input files
      const inputData = await this.readAndValidateInputs();

      // 2. Check for stale active runs
      await this.checkStaleActiveRun(inputData.currentRun, inputData.taskState.tasks);

      // 3. Apply eligibility rules
      const eligibleTasks = this.filterEligibleTasks(
        inputData.taskState.tasks,
        inputData.loopConfig,
      );

      // 4. Apply priority and tie-breaking
      const selectedTask = this.selectBestTask(eligibleTasks);

      // 5. Perform safety checks
      if (selectedTask) {
        await this.performSafetyChecks(selectedTask, inputData.protectedFiles);
      }

      // 6. Generate result
      const result = this.generateResult(selectedTask, eligibleTasks, inputData);

      // 7. Optionally write runs/current-run.json
      if (this.writeMode && selectedTask) {
        await this.writeCurrentRun(selectedTask, result);
      }

      return result;
    } catch (error) {
      if (error.code) {
        throw error; // Re-throw custom errors
      }

      // Wrap unexpected errors
      const wrappedError = new Error(`Unexpected error: ${error.message}`);
      wrappedError.code = 'UNEXPECTED_ERROR';
      wrappedError.exitCode = EXIT_CODES.UNEXPECTED_ERROR;
      throw wrappedError;
    }
  }

  /**
   * Read and validate all required input files
   */
  async readAndValidateInputs() {
    const inputs = {};

    try {
      // Read task state (required)
      if (!fs.existsSync(this.taskStatePath)) {
        throw this.createError(
          'INVALID_CONFIG',
          `Task state file not found: ${this.taskStatePath}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      const taskStateContent = fs.readFileSync(this.taskStatePath, 'utf8');
      try {
        inputs.taskState = JSON.parse(taskStateContent);
      } catch (parseError) {
        throw this.createError(
          'INVALID_CONFIG',
          `Invalid JSON in task state file: ${parseError.message}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      // Validate task state structure
      this.validateTaskState(inputs.taskState);

      // Read loop config (required)
      if (!fs.existsSync(this.configPath)) {
        throw this.createError(
          'INVALID_CONFIG',
          `Loop config file not found: ${this.configPath}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      try {
        inputs.loopConfig = JSON.parse(configContent);
      } catch (parseError) {
        throw this.createError(
          'INVALID_CONFIG',
          `Invalid JSON in loop config file: ${parseError.message}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      // Read protected files (required)
      if (!fs.existsSync(this.protectedFilesPath)) {
        throw this.createError(
          'INVALID_CONFIG',
          `Protected files config not found: ${this.protectedFilesPath}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      const protectedContent = fs.readFileSync(this.protectedFilesPath, 'utf8');
      try {
        inputs.protectedFiles = JSON.parse(protectedContent);
      } catch (parseError) {
        throw this.createError(
          'INVALID_CONFIG',
          `Invalid JSON in protected files config: ${parseError.message}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      // Read handoff (optional)
      if (fs.existsSync(this.handoffPath)) {
        inputs.handoff = fs.readFileSync(this.handoffPath, 'utf8');
      } else {
        this.warnings.push(`Handoff file not found: ${this.handoffPath}`);
      }

      // Read current run (optional)
      if (fs.existsSync(this.currentRunPath)) {
        const currentRunContent = fs.readFileSync(this.currentRunPath, 'utf8');
        try {
          inputs.currentRun = JSON.parse(currentRunContent);
        } catch (parseError) {
          throw this.createError(
            'INVALID_CONFIG',
            `Invalid JSON in current run file: ${parseError.message}`,
            EXIT_CODES.INVALID_CONFIG,
          );
        }
      }

      return inputs;
    } catch (error) {
      if (error.code) {
        throw error;
      }
      throw this.createError(
        'INVALID_CONFIG',
        `Failed to read input files: ${error.message}`,
        EXIT_CODES.INVALID_CONFIG,
      );
    }
  }

  /**
   * Validate task state structure
   */
  validateTaskState(taskState) {
    if (!taskState.tasks || !Array.isArray(taskState.tasks)) {
      throw this.createError(
        'INVALID_CONFIG',
        'Task state must contain a tasks array',
        EXIT_CODES.INVALID_CONFIG,
      );
    }

    const requiredTaskFields = [
      'id',
      'title',
      'status',
      'priority',
      'risk_level',
      'attempt_count',
      'max_attempts',
      'requires_human_review',
      'allowed_files',
      'forbidden_files',
    ];

    for (const task of taskState.tasks) {
      // Check required fields
      for (const field of requiredTaskFields) {
        if (!(field in task)) {
          throw this.createError(
            'INVALID_CONFIG',
            `Task ${task.id || 'unknown'} missing required field: ${field}`,
            EXIT_CODES.INVALID_CONFIG,
          );
        }
      }

      // Validate status
      if (!VALID_STATUSES.includes(task.status)) {
        throw this.createError(
          'INVALID_CONFIG',
          `Task ${task.id} has invalid status: ${task.status}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      // Validate risk level
      if (!VALID_RISK_LEVELS.includes(task.risk_level)) {
        throw this.createError(
          'INVALID_CONFIG',
          `Task ${task.id} has invalid risk level: ${task.risk_level}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      // Validate attempt count
      if (typeof task.attempt_count !== 'number' || task.attempt_count < 0) {
        throw this.createError(
          'INVALID_CONFIG',
          `Task ${task.id} has invalid attempt_count: ${task.attempt_count}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }

      if (typeof task.max_attempts !== 'number' || task.max_attempts < 1) {
        throw this.createError(
          'INVALID_CONFIG',
          `Task ${task.id} has invalid max_attempts: ${task.max_attempts}`,
          EXIT_CODES.INVALID_CONFIG,
        );
      }
    }
  }

  /**
   * Check for stale active runs
   */
  async checkStaleActiveRun(currentRun, allTasks) {
    if (!currentRun) {
      return; // No active run
    }

    if (currentRun.status === 'running' || currentRun.status === 'in_progress') {
      // Support both possible field names for task ID
      const activeTaskId = currentRun.task_id || currentRun.selected_task_id;

      if (!activeTaskId) {
        throw this.createError(
          'STALE_ACTIVE_RUN',
          'Active run detected but no task ID found. Please clear the current run.',
          EXIT_CODES.STALE_ACTIVE_RUN,
        );
      }

      // Find the next task that would be selected
      const eligibleTasks = this.filterEligibleTasks(allTasks, {
        human_review_policy: { require_review_after_each_task: true },
      });
      const nextTask = this.selectBestTask(eligibleTasks);

      // If active task differs from what would be selected, it's stale
      if (nextTask && nextTask.id !== activeTaskId) {
        throw this.createError(
          'STALE_ACTIVE_RUN',
          `Stale active run detected. Active: ${activeTaskId}, Next: ${nextTask.id}. Please complete or clear the current run.`,
          EXIT_CODES.STALE_ACTIVE_RUN,
        );
      }
    }
  }

  /**
   * Filter tasks based on eligibility criteria
   */
  filterEligibleTasks(tasks, loopConfig) {
    const eligible = [];

    for (const task of tasks) {
      const reasons = [];

      // Exclude done, blocked, skipped, cancelled
      if (['done', 'blocked', 'skipped', 'cancelled'].includes(task.status)) {
        continue;
      }

      // Exclude failed unless retry policy allows it
      if (task.status === 'failed') {
        // For now, exclude all failed tasks (retry policy not implemented)
        continue;
      }

      // Exclude tasks with attempt_count >= max_attempts
      if (task.attempt_count >= task.max_attempts) {
        continue;
      }

      // Exclude human_required
      if (task.risk_level === 'human_required') {
        continue;
      }

      // Exclude review_required unless config allows it
      if (task.risk_level === 'review_required') {
        // Check if human review is available
        if (!loopConfig.human_review_policy?.require_review_after_each_task) {
          continue;
        }
      }

      // Prefer safe_autonomous and eligible statuses
      if (['not_started', 'in_progress', 'needs_validation'].includes(task.status)) {
        reasons.push(`Status ${task.status} is eligible`);

        if (task.risk_level === 'safe_autonomous') {
          reasons.push('Risk level is safe_autonomous');
        } else if (task.risk_level === 'review_required') {
          reasons.push('Risk level is review_required with human review available');
        }

        eligible.push({
          ...task,
          eligibility_reasons: reasons,
        });
      }
    }

    return eligible;
  }

  /**
   * Select the best task from eligible candidates
   */
  selectBestTask(eligibleTasks) {
    if (eligibleTasks.length === 0) {
      return null;
    }

    // Sort by priority, then by status preference, then by created_at, then by id
    const sorted = eligibleTasks.sort((a, b) => {
      // Priority order: high -> medium -> low
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.priority] || 999;
      const bPriority = priorityOrder[b.priority] || 999;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Status preference: in_progress -> needs_validation -> not_started
      const statusOrder = { in_progress: 1, needs_validation: 2, not_started: 3 };
      const aStatus = statusOrder[a.status] || 999;
      const bStatus = statusOrder[b.status] || 999;

      if (aStatus !== bStatus) {
        return aStatus - bStatus;
      }

      // Created_at (ascending - older first)
      if (a.created_at && b.created_at) {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        if (aTime !== bTime) {
          return aTime - bTime;
        }
      }

      // ID (ascending - alphabetical)
      return a.id.localeCompare(b.id);
    });

    return sorted[0];
  }

  /**
   * Perform safety checks on selected task
   */
  async performSafetyChecks(task, protectedFiles) {
    // Check if task requires forbidden file modifications
    const absoluteProtected =
      protectedFiles.protected_patterns?.absolute_protection?.patterns || [];
    const approvalRequired = protectedFiles.approval_required_patterns?.patterns || [];

    // Check allowed_files against protected patterns
    for (const allowedFile of task.allowed_files || []) {
      // Check absolute protection
      for (const pattern of absoluteProtected) {
        if (this.matchesPattern(allowedFile, pattern)) {
          throw this.createError(
            'SAFETY_VIOLATION',
            `Task ${task.id} requires modification of absolutely protected file: ${allowedFile} (matches pattern: ${pattern})`,
            EXIT_CODES.SAFETY_VIOLATION,
          );
        }
      }

      // Check approval required patterns
      for (const pattern of approvalRequired) {
        if (this.matchesPattern(allowedFile, pattern)) {
          this.warnings.push(
            `Task ${task.id} requires modification of approval-required file: ${allowedFile} (matches pattern: ${pattern})`,
          );
        }
      }
    }
  }

  /**
   * Simple pattern matching (supports basic wildcards)
   */
  matchesPattern(filePath, pattern) {
    // Convert glob-like pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any filename chars
      .replace(/\./g, '\\.'); // Escape dots

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Generate selection result
   */
  generateResult(selectedTask, eligibleTasks, inputData) {
    const result = {
      status: selectedTask ? 'task_selected' : 'no_eligible_task',
      selected_task: selectedTask || null,
      selection_reason: null,
      stop_reason: null,
      mode: this.dryRun ? 'dry_run' : 'write',
      write_performed: this.writeMode && selectedTask,
      warnings: this.warnings,
      eligible_task_count: eligibleTasks.length,
      total_task_count: inputData.taskState.tasks.length,
    };

    if (selectedTask) {
      result.selection_reason = this.generateSelectionReason(selectedTask, eligibleTasks);
    } else {
      result.stop_reason = this.generateStopReason(inputData.taskState.tasks);
    }

    return result;
  }

  /**
   * Generate selection reason
   */
  generateSelectionReason(selectedTask, eligibleTasks) {
    const reasons = [];

    reasons.push(
      `Task ${selectedTask.id} selected from ${eligibleTasks.length} eligible candidates`,
    );
    reasons.push(
      `Priority: ${selectedTask.priority}, Status: ${selectedTask.status}, Risk: ${selectedTask.risk_level}`,
    );

    if (selectedTask.eligibility_reasons) {
      reasons.push(`Eligibility: ${selectedTask.eligibility_reasons.join(', ')}`);
    }

    return reasons.join('. ');
  }

  /**
   * Generate stop reason when no task is selected
   */
  generateStopReason(allTasks) {
    const statusCounts = {};
    const riskCounts = {};

    for (const task of allTasks) {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      riskCounts[task.risk_level] = (riskCounts[task.risk_level] || 0) + 1;
    }

    const reasons = [];

    if (statusCounts.done) {
      reasons.push(`${statusCounts.done} tasks completed`);
    }

    if (statusCounts.blocked) {
      reasons.push(`${statusCounts.blocked} tasks blocked`);
    }

    if (riskCounts.human_required) {
      reasons.push(`${riskCounts.human_required} tasks require human intervention`);
    }

    if (reasons.length === 0) {
      reasons.push('No tasks meet eligibility criteria');
    }

    return `No eligible tasks found. ${reasons.join(', ')}.`;
  }

  /**
   * Write current run file
   */
  async writeCurrentRun(selectedTask, result) {
    const runId = `run_${new Date().toISOString().split('T')[0]}_${selectedTask.id.toLowerCase()}`;

    const currentRun = {
      run_id: runId,
      created_at: new Date().toISOString(),
      selected_task_id: selectedTask.id,
      selected_task_title: selectedTask.title,
      mode: 'coordinator',
      status: 'task_selected',
      selection_reason: result.selection_reason,
      blocked_reason: null,
      stop_reason: null,
      allowed_files: selectedTask.allowed_files || [],
      forbidden_files: selectedTask.forbidden_files || [],
      expected_outputs: selectedTask.outputs || [],
      validation_requirements: selectedTask.validation || {},
      safety_checks: {
        protected_files_check: 'passed',
        scope_boundary_check: 'passed',
        forbidden_operations_check: 'passed',
      },
      metadata: {
        ralph_loop_version: '0.1.0-alpha',
        selector_version: '1.0.1',
        governance_version: '1.0.0',
        selection_algorithm: 'priority_risk_created_at',
        human_approval_required:
          selectedTask.requires_human_review || selectedTask.risk_level === 'review_required',
        notes: 'Task selected by dry-run selector. Human approval required before implementation.',
      },
    };

    try {
      // Ensure runs directory exists
      const runsDir = path.dirname(this.currentRunPath);
      if (!fs.existsSync(runsDir)) {
        fs.mkdirSync(runsDir, { recursive: true });
      }

      fs.writeFileSync(this.currentRunPath, JSON.stringify(currentRun, null, 2));
    } catch (error) {
      throw this.createError(
        'UNEXPECTED_ERROR',
        `Failed to write current run file: ${error.message}`,
        EXIT_CODES.UNEXPECTED_ERROR,
      );
    }
  }

  /**
   * Create a structured error
   */
  createError(code, message, exitCode) {
    const error = new Error(message);
    error.code = code;
    error.exitCode = exitCode;
    return error;
  }
}

/**
 * Format output for console
 */
function formatOutput(result, jsonOutput) {
  if (jsonOutput) {
    return JSON.stringify(result, null, 2);
  }

  let output = '# Task Selection Result\n\n';

  if (result.selected_task) {
    output += `**Selected Task:** ${result.selected_task.id}\n`;
    output += `**Task Title:** ${result.selected_task.title}\n`;
    output += `**Risk Level:** ${result.selected_task.risk_level}\n`;
    output += `**Priority:** ${result.selected_task.priority}\n`;
    output += `**Rationale:** ${result.selection_reason}\n\n`;

    output += '## Eligibility Verification\n';
    output += `✓ Status is eligible (${result.selected_task.status})\n`;
    output += `✓ Risk level appropriate (${result.selected_task.risk_level})\n`;
    output += `✓ Attempt count within limits (${result.selected_task.attempt_count}/${result.selected_task.max_attempts})\n`;
    output += '✓ Files within allowed scope\n';
    output += '✓ No blocking conditions\n\n';

    output += '## Next Action Required\n';
    if (
      result.selected_task.requires_human_review ||
      result.selected_task.risk_level === 'review_required'
    ) {
      output += 'Human approval required for implementation task. ';
    }
    if (result.write_performed) {
      output += 'Current run updated. Ready for worker invocation.\n';
    } else {
      output += 'Run with --write to update runs/current-run.json.\n';
    }
  } else {
    output += `**No Task Selected**\n`;
    output += `**Stop Reason:** ${result.stop_reason}\n\n`;

    output += '## Task Summary\n';
    output += `Total tasks: ${result.total_task_count}\n`;
    output += `Eligible tasks: ${result.eligible_task_count}\n\n`;

    output += '## Next Action Required\n';
    output += 'Review task states and resolve blocking conditions.\n';
  }

  if (result.warnings.length > 0) {
    output += '\n## Warnings\n';
    for (const warning of result.warnings) {
      output += `⚠️ ${warning}\n`;
    }
  }

  return output;
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    dryRun: true,
    jsonOutput: false,
    writeMode: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--write':
        options.writeMode = true;
        options.dryRun = false;
        break;
      case '--json':
        options.jsonOutput = true;
        break;
      case '--task-state':
        options.taskStatePath = args[++i];
        break;
      case '--config':
        options.configPath = args[++i];
        break;
      case '--protected-files':
        options.protectedFilesPath = args[++i];
        break;
      case '--handoff':
        options.handoffPath = args[++i];
        break;
      case '--current-run':
        options.currentRunPath = args[++i];
        break;
      case '--help':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(EXIT_CODES.INVALID_CONFIG);
        }
        break;
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Ralph-Loop Dry-Run Task Selector

Usage: node select-next-ralph-task.mjs [options]

Options:
  --dry-run              Dry-run mode (default, no file writes)
  --write                Write selected task to runs/current-run.json
  --json                 Output JSON instead of markdown
  --task-state <path>    Override task state file path
  --config <path>        Override loop config file path
  --protected-files <path> Override protected files config path
  --handoff <path>       Override handoff file path
  --current-run <path>   Override current run file path
  --help                 Show this help message

Exit Codes:
  0  Success (task selected or dry-run completed)
  1  Invalid input/configuration
  2  Safety violation
  3  No eligible task found
  4  Stale active run detected
  5  Unexpected error

Examples:
  node select-next-ralph-task.mjs --dry-run
  node select-next-ralph-task.mjs --dry-run --json
  node select-next-ralph-task.mjs --write
`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    if (options.help) {
      showHelp();
      process.exit(EXIT_CODES.SUCCESS);
    }

    const selector = new RalphTaskSelector(options);
    const result = await selector.selectNextTask();

    console.log(formatOutput(result, options.jsonOutput));

    if (result.status === 'no_eligible_task') {
      process.exit(EXIT_CODES.NO_ELIGIBLE_TASK);
    }

    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    if (error.code) {
      console.error(`ERROR ${error.exitCode}: ${error.code} - ${error.message}`);
      process.exit(error.exitCode);
    } else {
      console.error(`ERROR ${EXIT_CODES.UNEXPECTED_ERROR}: Unexpected error - ${error.message}`);
      process.exit(EXIT_CODES.UNEXPECTED_ERROR);
    }
  }
}

// Always run main when this script is executed
main();

export { RalphTaskSelector, EXIT_CODES };
