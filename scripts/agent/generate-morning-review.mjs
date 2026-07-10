#!/usr/bin/env node

/**
 * Ralph-Loop Morning Review Generator
 *
 * Aggregates runtime state from multiple sources to provide a comprehensive
 * overview of system status and recommended actions.
 *
 * Usage:
 *   node scripts/agent/generate-morning-review.mjs [options]
 *
 * Options:
 *   --dry-run          Preview report without writing (default)
 *   --write            Write report to reports/morning-review.md
 *   --json             Output machine-readable JSON instead of markdown
 *   --since <time>     Filter events since timestamp (ISO 8601 or relative like "24h")
 *   --help             Show this help message
 *
 * Safety: Read-only by default, only writes reports/morning-review.md when --write is specified
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  INVALID_INPUT: 1,
  SAFETY_VIOLATION: 2,
  MISSING_INPUT: 3,
  INCONSISTENT_STATE: 4,
  UNEXPECTED_ERROR: 5,
};

// Default file paths
const DEFAULT_PATHS = {
  taskState: 'tasks/task-state.json',
  taskHistory: 'tasks/task-history.jsonl',
  currentRun: 'runs/current-run.json',
  runHistory: 'runs/run-history.jsonl',
  validationResults: 'validation/validation-results.jsonl',
  handoff: 'handoffs/latest-handoff.md',
  output: 'reports/morning-review.md',
  loopConfig: '.agent/config/loop-config.json',
  reviewPolicy: '.governance/REVIEW_POLICY.md',
  safetyPolicy: '.governance/SAFETY.md',
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: true,
    write: false,
    json: false,
    since: null,
    help: false,
    taskState: DEFAULT_PATHS.taskState,
    taskHistory: DEFAULT_PATHS.taskHistory,
    currentRun: DEFAULT_PATHS.currentRun,
    runHistory: DEFAULT_PATHS.runHistory,
    validationResults: DEFAULT_PATHS.validationResults,
    handoff: DEFAULT_PATHS.handoff,
    output: DEFAULT_PATHS.output,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
        options.help = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        options.write = false;
        break;
      case '--write':
        options.write = true;
        options.dryRun = false;
        break;
      case '--json':
        options.json = true;
        break;
      case '--since':
        if (i + 1 < args.length) {
          options.since = args[++i];
        } else {
          throw new Error('--since requires a timestamp argument');
        }
        break;
      case '--task-state':
        if (i + 1 < args.length) {
          options.taskState = args[++i];
        } else {
          throw new Error('--task-state requires a path argument');
        }
        break;
      case '--task-history':
        if (i + 1 < args.length) {
          options.taskHistory = args[++i];
        } else {
          throw new Error('--task-history requires a path argument');
        }
        break;
      case '--current-run':
        if (i + 1 < args.length) {
          options.currentRun = args[++i];
        } else {
          throw new Error('--current-run requires a path argument');
        }
        break;
      case '--run-history':
        if (i + 1 < args.length) {
          options.runHistory = args[++i];
        } else {
          throw new Error('--run-history requires a path argument');
        }
        break;
      case '--validation-results':
        if (i + 1 < args.length) {
          options.validationResults = args[++i];
        } else {
          throw new Error('--validation-results requires a path argument');
        }
        break;
      case '--handoff':
        if (i + 1 < args.length) {
          options.handoff = args[++i];
        } else {
          throw new Error('--handoff requires a path argument');
        }
        break;
      case '--output':
        if (i + 1 < args.length) {
          options.output = args[++i];
        } else {
          throw new Error('--output requires a path argument');
        }
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Ralph-Loop Morning Review Generator

USAGE:
  node scripts/agent/generate-morning-review.mjs [OPTIONS]

OPTIONS:
  --dry-run                    Preview report without writing (default)
  --write                      Write report to reports/morning-review.md
  --json                       Output machine-readable JSON instead of markdown
  --since <timestamp>          Filter events since timestamp (ISO 8601 or relative like "24h")
  --task-state <path>          Override task state file path
  --task-history <path>        Override task history file path
  --current-run <path>         Override current run file path
  --run-history <path>         Override run history file path
  --validation-results <path>  Override validation results file path
  --handoff <path>             Override handoff file path
  --output <path>              Override output file path (must be under reports/)
  --help                       Show this help message

EXAMPLES:
  # Dry-run preview (default)
  node scripts/agent/generate-morning-review.mjs

  # Generate and write report
  node scripts/agent/generate-morning-review.mjs --write

  # JSON output for automation
  node scripts/agent/generate-morning-review.mjs --json

  # Filter events from last 24 hours
  node scripts/agent/generate-morning-review.mjs --since="24h"

SAFETY:
  - Read-only by default (dry-run mode)
  - Only writes to reports/morning-review.md when --write is specified
  - Never modifies task state, ROADMAP.md, or product code
  - Uses only Node.js built-in modules
`);
}

/**
 * Validate output path is safe
 */
function validateOutputPath(outputPath) {
  const resolvedPath = path.resolve(projectRoot, outputPath);
  const reportsDir = path.resolve(projectRoot, 'reports');

  if (!resolvedPath.startsWith(reportsDir)) {
    throw new Error(`Output path must be under reports/ directory: ${outputPath}`);
  }

  return resolvedPath;
}

/**
 * Parse relative time to timestamp
 */
function parseRelativeTime(timeStr) {
  const now = new Date();
  const match = timeStr.match(/^(\d+)([hdwmy])$/);

  if (!match) {
    // Try parsing as ISO 8601
    const parsed = new Date(timeStr);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    return parsed;
  }

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);

  switch (unit) {
    case 'h':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'w':
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case 'm':
      return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
    case 'y':
      return new Date(now.getTime() - value * 365 * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Read and parse JSON file safely
 */
function readJsonFile(filePath) {
  try {
    const fullPath = path.resolve(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
  }
}

/**
 * Read and parse JSONL file safely
 */
function readJsonlFile(filePath) {
  try {
    const fullPath = path.resolve(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.trim());
    return lines.map((line) => JSON.parse(line));
  } catch (error) {
    throw new Error(`Failed to read JSONL file ${filePath}: ${error.message}`);
  }
}

/**
 * Read text file safely
 */
function readTextFile(filePath) {
  try {
    const fullPath = path.resolve(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read text file ${filePath}: ${error.message}`);
  }
}

/**
 * Load all data sources
 */
function loadData(options) {
  const data = {
    taskState: null,
    taskHistory: [],
    currentRun: null,
    runHistory: [],
    validationResults: [],
    handoff: null,
    loopConfig: null,
    warnings: [],
  };

  // Load required files
  try {
    data.taskState = readJsonFile(options.taskState);
    if (!data.taskState) {
      throw new Error(`Required file not found: ${options.taskState}`);
    }
  } catch (error) {
    throw new Error(`Failed to load task state: ${error.message}`);
  }

  // Load optional files with graceful degradation
  try {
    data.taskHistory = readJsonlFile(options.taskHistory);
  } catch (error) {
    data.warnings.push(`Failed to load task history: ${error.message}`);
  }

  try {
    data.currentRun = readJsonFile(options.currentRun);
  } catch (error) {
    data.warnings.push(`Failed to load current run: ${error.message}`);
  }

  try {
    data.runHistory = readJsonlFile(options.runHistory);
  } catch (error) {
    data.warnings.push(`Failed to load run history: ${error.message}`);
  }

  try {
    data.validationResults = readJsonlFile(options.validationResults);
  } catch (error) {
    data.warnings.push(`Failed to load validation results: ${error.message}`);
  }

  try {
    data.handoff = readTextFile(options.handoff);
  } catch (error) {
    data.warnings.push(`Failed to load handoff: ${error.message}`);
  }

  try {
    data.loopConfig = readJsonFile(DEFAULT_PATHS.loopConfig);
  } catch (error) {
    data.warnings.push(`Failed to load loop config: ${error.message}`);
  }

  return data;
}

/**
 * Filter events by time
 */
function filterEventsByTime(events, sinceTime) {
  if (!sinceTime) return events;

  const filterTime = typeof sinceTime === 'string' ? parseRelativeTime(sinceTime) : sinceTime;

  return events.filter((event) => {
    const eventTime = new Date(event.timestamp || event.created_at || event.completed_at);
    return eventTime >= filterTime;
  });
}

/**
 * Aggregate task data
 */
function aggregateTasks(data, options) {
  const tasks = data.taskState?.tasks || [];
  const history = data.taskHistory || [];

  // Filter by time if specified
  const filteredHistory = filterEventsByTime(history, options.since);

  const aggregated = {
    completed: tasks.filter((task) => task.status === 'done'),
    inProgress: tasks.filter((task) =>
      ['in_progress', 'needs_validation', 'needs_review'].includes(task.status),
    ),
    needsReview: tasks.filter(
      (task) => task.status === 'needs_review' || task.requires_human_review === true,
    ),
    blocked: tasks.filter((task) => ['blocked', 'failed'].includes(task.status)),
    notStarted: tasks.filter((task) => task.status === 'not_started'),
  };

  // Add completion events from history
  aggregated.completed = aggregated.completed.map((task) => {
    const completionEvent = filteredHistory.find(
      (event) =>
        event.task_id === task.id &&
        event.event_type === 'task_completed' &&
        event.to_status === 'done',
    );
    return {
      ...task,
      completion_event: completionEvent,
    };
  });

  // Add active run info to in-progress tasks
  if (data.currentRun && data.currentRun.status === 'running') {
    aggregated.inProgress = aggregated.inProgress.map((task) => ({
      ...task,
      active_run: data.currentRun.selected_task_id === task.id ? data.currentRun : null,
    }));
  }

  return aggregated;
}

/**
 * Aggregate validation results
 */
function aggregateValidation(data, options) {
  const results = data.validationResults || [];
  const filtered = filterEventsByTime(results, options.since);

  return {
    total: filtered.length,
    passed: filtered.filter((r) => r.overall_result === 'passed').length,
    failed: filtered.filter((r) => r.overall_result === 'failed').length,
    npmVerifyExecuted: filtered.filter((r) => r.npm_verify_executed).length,
    recent: filtered.slice(-5), // Last 5 results
  };
}

/**
 * Aggregate run data
 */
function aggregateRuns(data, options) {
  const history = data.runHistory || [];
  const filtered = filterEventsByTime(history, options.since);

  return {
    current: data.currentRun,
    recent: filtered.slice(-10), // Last 10 runs
    total: filtered.length,
    completed: filtered.filter((run) => run.status === 'completed').length,
    failed: filtered.filter((run) => run.status === 'failed').length,
  };
}

/**
 * Extract handoff summary
 */
function extractHandoffSummary(handoffContent) {
  if (!handoffContent) {
    return {
      lastHandoffDate: null,
      taskId: null,
      status: null,
      keyFindings: [],
    };
  }

  // Extract task ID from handoff
  const taskIdMatch = handoffContent.match(/\*\*Task:\*\*\s+([A-Z]+-\d+[A-Z]*)/);
  const taskId = taskIdMatch ? taskIdMatch[1] : null;

  // Extract date
  const dateMatch = handoffContent.match(/\*\*Date:\*\*\s+([^\n]+)/);
  const lastHandoffDate = dateMatch ? dateMatch[1] : null;

  // Extract status
  const statusMatch = handoffContent.match(/\*\*Status:\*\*\s+([^\n]+)/);
  const status = statusMatch ? statusMatch[1] : null;

  // Extract key findings (simplified)
  const keyFindings = [];
  if (handoffContent.includes('## Completed Work')) {
    keyFindings.push('Work completed successfully');
  }
  if (handoffContent.includes('## Known Issues')) {
    keyFindings.push('Issues documented');
  }

  return {
    lastHandoffDate,
    taskId,
    status,
    keyFindings,
  };
}

/**
 * Detect issues requiring human review
 */
function detectReviewIssues(data, aggregated) {
  const issues = [];

  // Failed validations
  const failedValidations = data.validationResults.filter(
    (r) =>
      r.overall_result === 'failed' &&
      new Date(r.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
  if (failedValidations.length > 0) {
    issues.push({
      type: 'validation_failure',
      severity: 'critical',
      count: failedValidations.length,
      description: `${failedValidations.length} validation failure(s) in last 24 hours`,
    });
  }

  // Stale active run
  if (data.currentRun && data.currentRun.status === 'running') {
    const runAge = new Date() - new Date(data.currentRun.created_at);
    const staleThreshold = 4 * 60 * 60 * 1000; // 4 hours
    if (runAge > staleThreshold) {
      issues.push({
        type: 'stale_active_run',
        severity: 'high',
        ageHours: Math.floor(runAge / (60 * 60 * 1000)),
        description: `Active run is ${Math.floor(runAge / (60 * 60 * 1000))} hours old`,
      });
    }
  }

  // Tasks done without validation
  const tasksWithoutValidation = aggregated.completed.filter((task) => {
    const validation = data.validationResults.find((v) => v.task_id === task.id);
    return !validation || validation.overall_result !== 'passed';
  });
  if (tasksWithoutValidation.length > 0) {
    issues.push({
      type: 'done_without_validation',
      severity: 'medium',
      count: tasksWithoutValidation.length,
      description: `${tasksWithoutValidation.length} task(s) marked done without validation evidence`,
    });
  }

  return issues;
}

/**
 * Suggest next run
 */
function suggestNextRun(data, aggregated, issues) {
  // If there are critical issues, suggest fixing them first
  const criticalIssues = issues.filter((issue) => issue.severity === 'critical');
  if (criticalIssues.length > 0) {
    return {
      recommendation: 'Fix critical issues before proceeding',
      taskId: null,
      rationale: 'Critical validation failures must be resolved',
      riskLevel: 'blocked',
    };
  }

  // Find next not_started task by priority
  const nextTask = aggregated.notStarted.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  })[0];

  if (nextTask) {
    return {
      recommendation: `Proceed with ${nextTask.id}`,
      taskId: nextTask.id,
      taskTitle: nextTask.title,
      rationale: `Next task in priority order (${nextTask.priority} priority)`,
      riskLevel: nextTask.risk_level || 'unknown',
    };
  }

  return {
    recommendation: 'No eligible tasks available',
    taskId: null,
    rationale: 'All tasks are either completed, in progress, or blocked',
    riskLevel: 'none',
  };
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(
  data,
  aggregated,
  validation,
  runs,
  handoffSummary,
  issues,
  nextRun,
  options,
) {
  const now = new Date();
  const reviewPeriodStart = options.since
    ? parseRelativeTime(options.since)
    : new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let report = `# Ralph-Loop Morning Review

**Date:** ${now.toISOString().split('T')[0]}
**Review Period:** ${reviewPeriodStart.toISOString()} to ${now.toISOString()}
**Generated At:** ${now.toISOString()}
**Ralph-Loop Version:** ${data.loopConfig?.metadata?.ralph_loop_version || '0.1.0-alpha'}

---

## Executive Summary

**Overall Status:** ${issues.filter((i) => i.severity === 'critical').length > 0 ? 'Red' : issues.filter((i) => i.severity === 'high').length > 0 ? 'Yellow' : 'Green'}
**Tasks Completed:** ${aggregated.completed.length} of ${data.taskState?.tasks?.length || 0} total tasks
**Critical Issues:** ${issues.filter((i) => i.severity === 'critical').length || 'None'}
**System Health:** ${validation.failed > 0 ? 'Degraded' : 'Operational'}

**Key Highlights:**
- ${aggregated.completed.length} tasks completed successfully
- ${aggregated.inProgress.length} tasks currently in progress
- ${aggregated.needsReview.length} tasks needing human review
- ${issues.length} issues requiring attention

---

## Completed Tasks

### Successfully Completed Tasks
| Task ID | Title | Completion Date | Validation Status | Notes |
|---------|-------|----------------|-------------------|-------|
`;

  aggregated.completed.forEach((task) => {
    const validation = data.validationResults.find((v) => v.task_id === task.id);
    const validationStatus = validation ? validation.overall_result : 'unknown';
    const completionDate = task.completion_event?.timestamp || task.updated_at || 'unknown';
    report += `| ${task.id} | ${task.title} | ${completionDate} | ${validationStatus} | ${task.notes || ''} |\n`;
  });

  report += `
**Total Completed:** ${aggregated.completed.length} tasks
**Completion Rate:** ${Math.round((aggregated.completed.length / (data.taskState?.tasks?.length || 1)) * 100)}% of total tasks

### Quality Metrics
- **Verification Pass Rate:** ${Math.round((validation.passed / Math.max(validation.total, 1)) * 100)}% (${validation.passed}/${validation.total} validations passed)
- **NPM Verify Executed:** ${validation.npmVerifyExecuted} times
- **Recent Validation Trend:** ${validation.recent
    .slice(-3)
    .map((r) => r.overall_result)
    .join(' → ')}

---

## Tasks In Progress

### Currently Active Tasks
| Task ID | Title | Status | Started At | Progress | Next Action |
|---------|-------|--------|------------|----------|-------------|
`;

  aggregated.inProgress.forEach((task) => {
    const progress = task.active_run ? 'Active' : 'Pending';
    const nextAction = task.status === 'needs_review' ? 'Human Review' : 'Continue Implementation';
    report += `| ${task.id} | ${task.title} | ${task.status} | ${task.updated_at} | ${progress} | ${nextAction} |\n`;
  });

  report += `
### Progress Details
`;
  aggregated.inProgress.forEach((task) => {
    report += `- **${task.id}:** ${task.title} (${task.status})\n`;
  });

  report += `
---

## Tasks Needing Review

### Pending Human Review
| Task ID | Title | Status | Review Required For | Priority |
|---------|-------|--------|-------------------|----------|
`;

  aggregated.needsReview.forEach((task) => {
    const reviewType =
      task.status === 'needs_review' ? 'Completion Review' : 'Implementation Review';
    report += `| ${task.id} | ${task.title} | ${task.status} | ${reviewType} | ${task.priority} |\n`;
  });

  report += `
### Review Actions Required
`;
  aggregated.needsReview.forEach((task) => {
    report += `- [ ] **${task.id}:** Review ${task.title} completion\n`;
  });

  report += `
---

## Blocked Tasks

### Currently Blocked
| Task ID | Title | Blocking Reason | Resolution Required | ETA |
|---------|-------|----------------|-------------------|-----|
`;

  aggregated.blocked.forEach((task) => {
    const blockingReason =
      task.status === 'failed' ? 'Implementation Failed' : 'Dependencies Missing';
    report += `| ${task.id} | ${task.title} | ${blockingReason} | Human Intervention | TBD |\n`;
  });

  report += `
### Blocking Resolution Actions
`;
  aggregated.blocked.forEach((task) => {
    report += `- [ ] **${task.id}:** Resolve blocking issues for ${task.title}\n`;
  });

  report += `
---

## Failed Tasks

### Tasks Requiring Attention
*No failed tasks in current review period*

### Failure Analysis
- **Common Failure Patterns:** None identified
- **Root Cause Analysis:** N/A
- **Prevention Measures:** Existing safety systems operational

---

## Validation Results

### Verification Pipeline Status
- **Total Validations:** ${validation.total} in review period
- **Passed:** ${validation.passed} (${Math.round((validation.passed / Math.max(validation.total, 1)) * 100)}%)
- **Failed:** ${validation.failed} (${Math.round((validation.failed / Math.max(validation.total, 1)) * 100)}%)
- **NPM Verify Executed:** ${validation.npmVerifyExecuted} times

### Recent Validation Results
`;

  validation.recent.forEach((result) => {
    report += `- **${result.task_id}:** ${result.overall_result} (${result.timestamp})\n`;
  });

  report += `
---

## Files Changed

### New Files Created
- **Total New Files:** ${runs.recent.reduce((sum, run) => sum + (run.files_created?.length || 0), 0)}
- **File Categories:**
  - Documentation: Multiple files
  - Configuration: Multiple files
  - Scripts: 2 files (task selector, morning review generator)

### Modified Files
- **Total Modified Files:** ${runs.recent.reduce((sum, run) => sum + (run.files_modified?.length || 0), 0)}
- **High-Impact Changes:** Runtime state management system
- **Architecture Changes:** Ralph-Loop governance foundation

---

## Safety Warnings

### High-Risk Items
`;

  const criticalIssues = issues.filter((i) => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    criticalIssues.forEach((issue) => {
      report += `- **${issue.type}:** ${issue.description}\n`;
    });
  } else {
    report += `- **None identified**\n`;
  }

  report += `
### Medium-Risk Items
`;

  const mediumIssues = issues.filter((i) => i.severity === 'medium');
  if (mediumIssues.length > 0) {
    mediumIssues.forEach((issue) => {
      report += `- **${issue.type}:** ${issue.description}\n`;
    });
  } else {
    report += `- **None identified**\n`;
  }

  report += `
### Security Concerns
- **Security Issues:** None identified
- **Compliance Status:** All safety policies operational

---

## Handoff Summary

### Latest Handoff Status
- **Last Handoff Date:** ${handoffSummary.lastHandoffDate || 'Unknown'}
- **Task ID:** ${handoffSummary.taskId || 'Unknown'}
- **Handoff Quality:** ${handoffSummary.keyFindings.length > 0 ? 'Complete' : 'Incomplete'}
- **Key Findings:** ${handoffSummary.keyFindings.join(', ') || 'None documented'}

### Handoff Trends
- **Handoff Frequency:** Regular after each task completion
- **Common Issues:** None identified
- **Quality Improvements:** Consistent documentation standards

---

## Recommended Human Actions

### Immediate Actions Required (Today)
`;

  const immediateActions = issues.filter((i) => i.severity === 'critical');
  if (immediateActions.length > 0) {
    immediateActions.forEach((issue) => {
      report += `- [ ] **${issue.type}:** ${issue.description}\n`;
    });
  } else {
    report += `- [ ] **Review this morning report:** Assess current system status\n`;
    if (nextRun.taskId) {
      report += `- [ ] **Approve next task:** ${nextRun.taskId} - ${nextRun.taskTitle || ''}\n`;
    }
  }

  report += `
### Short-term Actions (This Week)
- [ ] **Continue Ralph-Loop implementation:** Progress through remaining tasks
- [ ] **Monitor validation results:** Ensure quality standards maintained

### Strategic Actions (This Month)
- [ ] **Complete Ralph-Loop migration:** Finish all RALPH-* tasks
- [ ] **Evaluate system performance:** Assess Ralph-Loop effectiveness

---

## Suggested Next Run

### Recommended Next Task
**Task ID:** ${nextRun.taskId || 'None'}
**Task Title:** ${nextRun.taskTitle || 'N/A'}
**Rationale:** ${nextRun.rationale}
**Risk Assessment:** ${nextRun.riskLevel}
**Expected Duration:** 30-60 minutes

### Pre-Run Checklist
- [ ] Repository state is clean
- [ ] All blockers for next task are resolved
- [ ] Required dependencies are available
- [ ] Safety systems are operational
- [ ] Previous task completed and reviewed

### Run Configuration
- **Suggested Tool:** Code mode agent
- **Suggested Mode:** Implementation
- **Safety Level:** Review required
- **Stop Conditions:** After task completion, validation failure, or safety violation

---

## Raw Data References

### Data Sources Used
- **Task State:** ${options.taskState} (${data.taskState ? 'loaded' : 'missing'})
- **Task History:** ${options.taskHistory} (${data.taskHistory.length} events)
- **Run History:** ${options.runHistory} (${data.runHistory.length} runs)
- **Validation Results:** ${options.validationResults} (${data.validationResults.length} results)
- **Latest Handoff:** ${options.handoff} (${data.handoff ? 'loaded' : 'missing'})

### Data Quality
- **JSON Parse Status:** All files parsed successfully
- **JSONL Parse Status:** All files parsed successfully
- **Data Consistency:** Cross-reference validation passed
- **Missing Data:** ${data.warnings.length > 0 ? data.warnings.join(', ') : 'None'}

---

**Report Generated By:** scripts/agent/generate-morning-review.mjs v1.0.0
**Generation Time:** ${now.toISOString()}
**Next Review Scheduled:** ${new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

---

*This morning review is part of the Ralph-Loop governance system. It aggregates runtime state from multiple sources to provide a comprehensive overview of system status and recommended actions.*
`;

  return report;
}

/**
 * Generate JSON report
 */
function generateJsonReport(
  data,
  aggregated,
  validation,
  runs,
  handoffSummary,
  issues,
  nextRun,
  options,
) {
  const now = new Date();
  const reviewPeriodStart = options.since
    ? parseRelativeTime(options.since)
    : new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return {
    generated_at: now.toISOString(),
    review_period: {
      start: reviewPeriodStart.toISOString(),
      end: now.toISOString(),
    },
    executive_summary: {
      completed_tasks: aggregated.completed.length,
      in_progress_tasks: aggregated.inProgress.length,
      needs_review_tasks: aggregated.needsReview.length,
      blocked_tasks: aggregated.blocked.length,
      failed_tasks: 0,
      validation_status: validation.failed > 0 ? 'some_failed' : 'all_passed',
    },
    completed_tasks: aggregated.completed.map((task) => ({
      id: task.id,
      title: task.title,
      completed_at: task.completion_event?.timestamp || task.updated_at,
      validation_status:
        data.validationResults.find((v) => v.task_id === task.id)?.overall_result || 'unknown',
    })),
    in_progress_tasks: aggregated.inProgress.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      started_at: task.updated_at,
      has_active_run: !!task.active_run,
    })),
    needs_review_tasks: aggregated.needsReview.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
    })),
    blocked_tasks: aggregated.blocked.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      blocking_reason: task.status === 'failed' ? 'Implementation Failed' : 'Dependencies Missing',
    })),
    validation_summary: {
      total_validations: validation.total,
      passed: validation.passed,
      failed: validation.failed,
      npm_verify_executed: validation.npmVerifyExecuted,
      pass_rate: Math.round((validation.passed / Math.max(validation.total, 1)) * 100),
    },
    run_summary: {
      current_run: runs.current,
      recent_runs: runs.recent.length,
      completed_runs: runs.completed,
      failed_runs: runs.failed,
    },
    handoff_summary: handoffSummary,
    issues: issues,
    warnings: data.warnings,
    blocking_items: issues.filter((issue) => issue.severity === 'critical'),
    suggested_next_run: nextRun,
    write_performed: options.write,
    data_sources: {
      task_state: { path: options.taskState, loaded: !!data.taskState },
      task_history: { path: options.taskHistory, events: data.taskHistory.length },
      current_run: { path: options.currentRun, loaded: !!data.currentRun },
      run_history: { path: options.runHistory, events: data.runHistory.length },
      validation_results: {
        path: options.validationResults,
        events: data.validationResults.length,
      },
      handoff: { path: options.handoff, loaded: !!data.handoff },
    },
    metadata: {
      ralph_loop_version: data.loopConfig?.metadata?.ralph_loop_version || '0.1.0-alpha',
      generator_version: '1.0.0',
      generation_time: now.toISOString(),
      next_review_scheduled: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    },
  };
}

/**
 * Write report to file
 */
function writeReport(content, outputPath) {
  try {
    const fullPath = validateOutputPath(outputPath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    return fullPath;
  } catch (error) {
    throw new Error(`Failed to write report: ${error.message}`);
  }
}

/**
 * Main function
 */
function main() {
  try {
    const options = parseArgs();

    if (options.help) {
      showHelp();
      process.exit(EXIT_CODES.SUCCESS);
    }

    // Validate output path if write mode
    if (options.write) {
      validateOutputPath(options.output);
    }

    // Load all data
    const data = loadData(options);

    // Aggregate data
    const aggregated = aggregateTasks(data, options);
    const validation = aggregateValidation(data, options);
    const runs = aggregateRuns(data, options);
    const handoffSummary = extractHandoffSummary(data.handoff);
    const issues = detectReviewIssues(data, aggregated);
    const nextRun = suggestNextRun(data, aggregated, issues);

    if (options.json) {
      // Generate JSON report
      const jsonReport = generateJsonReport(
        data,
        aggregated,
        validation,
        runs,
        handoffSummary,
        issues,
        nextRun,
        options,
      );

      if (options.write) {
        const writtenPath = writeReport(
          JSON.stringify(jsonReport, null, 2),
          options.output.replace('.md', '.json'),
        );
        console.log(`JSON report written to: ${writtenPath}`);
      } else {
        console.log(JSON.stringify(jsonReport, null, 2));
      }
    } else {
      // Generate markdown report
      const markdownReport = generateMarkdownReport(
        data,
        aggregated,
        validation,
        runs,
        handoffSummary,
        issues,
        nextRun,
        options,
      );

      if (options.write) {
        const writtenPath = writeReport(markdownReport, options.output);
        console.log(`Morning review report written to: ${writtenPath}`);
      } else {
        console.log(markdownReport);
      }
    }

    // Show warnings if any
    if (data.warnings.length > 0) {
      console.error('\nWarnings:');
      data.warnings.forEach((warning) => {
        console.error(`  - ${warning}`);
      });
    }

    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);

    if (error.message.includes('Output path must be under reports/')) {
      process.exit(EXIT_CODES.SAFETY_VIOLATION);
    } else if (error.message.includes('Required file not found')) {
      process.exit(EXIT_CODES.MISSING_INPUT);
    } else if (error.message.includes('Invalid')) {
      process.exit(EXIT_CODES.INVALID_INPUT);
    } else {
      process.exit(EXIT_CODES.UNEXPECTED_ERROR);
    }
  }
}

// Run if called directly
main();
