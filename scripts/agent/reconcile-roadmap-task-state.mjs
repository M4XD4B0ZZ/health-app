#!/usr/bin/env node

/**
 * Ralph V2 ROADMAP ↔ Task-State Reconciler
 *
 * Read-only reconciler for comparing ROADMAP planning truth with Ralph runtime
 * task state. It reports discrepancies only and never writes ROADMAP.md,
 * tasks/task-state.json, or any generated runtime state.
 *
 * Usage:
 *   node scripts/agent/reconcile-roadmap-task-state.mjs [--json] [--help]
 *
 * Exit codes:
 *   0 = no critical reconciliation findings
 *   1 = critical reconciliation findings found
 *   2 = reconciler execution error
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeStatus, parseRoadmap } from './lib/roadmap-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const EXIT_CODES = {
  OK: 0,
  CRITICAL_FINDINGS: 1,
  EXECUTION_ERROR: 2,
};

const OWNERSHIP_CLASSES = {
  ROADMAP_BACKED: 'roadmap_backed',
  RUNTIME_ONLY: 'runtime_only',
  ROADMAP_ONLY: 'roadmap_only',
  HISTORICAL: 'historical',
  LEGACY: 'legacy',
  UNCLASSIFIED: 'unclassified',
};

const PATHS = {
  roadmap: 'ROADMAP.md',
  taskState: 'tasks/task-state.json',
};

const ROADMAP_STATUSES = new Set(['todo', 'in_progress', 'blocked', 'done']);
const TASK_STATE_STATUSES = new Set([
  'not_started',
  'in_progress',
  'needs_validation',
  'needs_review',
  'blocked',
  'failed',
  'done',
  'skipped',
  'cancelled',
]);
const ACTIVE_RUNTIME_STATUSES = new Set(['in_progress', 'needs_validation', 'needs_review']);

function parseArgs(argv) {
  const options = { json: false, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Ralph V2 ROADMAP <-> Task-State Reconciler

USAGE:
  node scripts/agent/reconcile-roadmap-task-state.mjs [OPTIONS]

OPTIONS:
  --json     Output machine-readable JSON
  --help     Show this help message

SAFETY:
  - Read-only: never writes files
  - Reports discrepancies only
  - Does not repair ROADMAP.md or tasks/task-state.json

EXIT CODES:
  0 = no critical reconciliation findings
  1 = critical reconciliation findings found
  2 = reconciler execution error`);
}

function nowIso() {
  return new Date().toISOString();
}

function resolvePath(relativePath) {
  return path.resolve(projectRoot, relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(resolvePath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function addFinding(findings, severity, code, message, file, details = {}, ownershipClass = null) {
  const ownership_class =
    ownershipClass || details.ownership_class || OWNERSHIP_CLASSES.UNCLASSIFIED;
  findings.push({
    severity,
    code,
    ownership_class,
    message,
    file,
    details: { ...details, ownership_class },
  });
}

function parseTaskState(taskState) {
  const tasks = Array.isArray(taskState?.tasks) ? taskState.tasks : [];
  return tasks.map((task, index) => ({
    id: task.id,
    title: task.title || '',
    status: normalizeStatus(task.status),
    priority: task.priority || null,
    risk_level: task.risk_level || null,
    source: task.source || null,
    runtime_only: task.runtime_only || false,
    order: index + 1,
  }));
}

function groupById(tasks) {
  const grouped = new Map();
  for (const task of tasks) {
    if (!grouped.has(task.id)) grouped.set(task.id, []);
    grouped.get(task.id).push(task);
  }
  return grouped;
}

function classifyRoadmapTask(taskId, runtimeById) {
  return runtimeById.has(taskId)
    ? OWNERSHIP_CLASSES.ROADMAP_BACKED
    : OWNERSHIP_CLASSES.ROADMAP_ONLY;
}

function classifyRuntimeTask(taskId, roadmapById) {
  return roadmapById.has(taskId)
    ? OWNERSHIP_CLASSES.ROADMAP_BACKED
    : OWNERSHIP_CLASSES.RUNTIME_ONLY;
}

function annotateOwnership(roadmapTasks, runtimeTasks) {
  const roadmapById = groupById(roadmapTasks);
  const runtimeById = groupById(runtimeTasks);

  const annotatedRoadmapTasks = roadmapTasks.map((task) => {
    const hasRuntimeState = runtimeById.has(task.id);
    return {
      ...task,
      ownership_class: classifyRoadmapTask(task.id, runtimeById),
      has_runtime_state: hasRuntimeState,
    };
  });

  const annotatedRuntimeTasks = runtimeTasks.map((task) => {
    const hasRoadmapEntry = roadmapById.has(task.id);
    return {
      ...task,
      ownership_class: classifyRuntimeTask(task.id, roadmapById),
      has_roadmap_entry: hasRoadmapEntry,
      ownership_explicit: task.runtime_only === true,
    };
  });

  return { roadmapTasks: annotatedRoadmapTasks, runtimeTasks: annotatedRuntimeTasks };
}

function buildOwnershipSummary(roadmapTasks, runtimeTasks) {
  const roadmapById = groupById(roadmapTasks);
  const runtimeById = groupById(runtimeTasks);
  const taskIds = new Set([...roadmapById.keys(), ...runtimeById.keys()]);
  const summary = {
    roadmap_backed_count: 0,
    runtime_only_count: 0,
    roadmap_only_count: 0,
    historical_count: 0,
    legacy_count: 0,
    unclassified_count: 0,
  };

  for (const taskId of taskIds) {
    const hasRoadmap = roadmapById.has(taskId);
    const hasRuntime = runtimeById.has(taskId);
    if (hasRoadmap && hasRuntime) summary.roadmap_backed_count += 1;
    else if (hasRuntime) summary.runtime_only_count += 1;
    else if (hasRoadmap) summary.roadmap_only_count += 1;
    else summary.unclassified_count += 1;
  }

  return summary;
}

function isStatusMappingAllowed(roadmapStatus, runtimeStatus) {
  if (!roadmapStatus || !runtimeStatus) return false;
  if (roadmapStatus === 'todo') return runtimeStatus === 'not_started';
  if (roadmapStatus === 'in_progress') return ACTIVE_RUNTIME_STATUSES.has(runtimeStatus);
  if (roadmapStatus === 'blocked') return runtimeStatus === 'blocked';
  if (roadmapStatus === 'done') return runtimeStatus === 'done';
  return false;
}

function severityForMissingRuntime(roadmapTask) {
  if (roadmapTask.status === 'done') return 'info';
  if (roadmapTask.status === 'in_progress') return 'warning';
  return 'info';
}

function severityForRuntimeMissingRoadmap(runtimeTask) {
  if (runtimeTask.runtime_only === true) return 'info';
  if (runtimeTask.status === 'done') return 'warning';
  return 'critical';
}

function compareStates(roadmapTasks, runtimeTasks) {
  const findings = [];
  const roadmapById = groupById(roadmapTasks);
  const runtimeById = groupById(runtimeTasks);

  for (const [taskId, entries] of roadmapById.entries()) {
    if (entries.length > 1) {
      addFinding(
        findings,
        'critical',
        'duplicate_roadmap_task_id',
        `Duplicate ROADMAP task ID: ${taskId}`,
        PATHS.roadmap,
        {
          task_id: taskId,
          lines: entries.map((entry) => entry.line),
        },
        runtimeById.has(taskId) ? OWNERSHIP_CLASSES.ROADMAP_BACKED : OWNERSHIP_CLASSES.ROADMAP_ONLY,
      );
    }
  }

  for (const [taskId, entries] of runtimeById.entries()) {
    if (entries.length > 1) {
      addFinding(
        findings,
        'critical',
        'duplicate_task_state_id',
        `Duplicate task-state task ID: ${taskId}`,
        PATHS.taskState,
        {
          task_id: taskId,
          orders: entries.map((entry) => entry.order),
        },
        roadmapById.has(taskId) ? OWNERSHIP_CLASSES.ROADMAP_BACKED : OWNERSHIP_CLASSES.RUNTIME_ONLY,
      );
    }
  }

  for (const task of roadmapTasks) {
    if (!task.status || !ROADMAP_STATUSES.has(task.status)) {
      addFinding(
        findings,
        'warning',
        'unknown_roadmap_status',
        `Unknown or missing ROADMAP status for ${task.id}`,
        PATHS.roadmap,
        {
          task_id: task.id,
          status: task.status,
          line: task.line,
        },
        task.ownership_class,
      );
    }

    if (!runtimeById.has(task.id)) {
      addFinding(
        findings,
        severityForMissingRuntime(task),
        'roadmap_task_missing_from_task_state',
        `ROADMAP task ${task.id} is missing from task-state`,
        PATHS.roadmap,
        {
          task_id: task.id,
          roadmap_status: task.status,
          title: task.title,
          line: task.line,
          order: task.order,
          section: task.section,
        },
        OWNERSHIP_CLASSES.ROADMAP_ONLY,
      );
    }
  }

  for (const task of runtimeTasks) {
    if (!task.status || !TASK_STATE_STATUSES.has(task.status)) {
      addFinding(
        findings,
        'warning',
        'unknown_task_state_status',
        `Unknown or missing task-state status for ${task.id}`,
        PATHS.taskState,
        {
          task_id: task.id,
          status: task.status,
          order: task.order,
        },
        task.ownership_class,
      );
    }

    if (!roadmapById.has(task.id)) {
      addFinding(
        findings,
        severityForRuntimeMissingRoadmap(task),
        'runtime_task_missing_from_roadmap',
        `Runtime task ${task.id} is missing from ROADMAP`,
        PATHS.taskState,
        {
          task_id: task.id,
          runtime_status: task.status,
          runtime_only: task.runtime_only,
          ownership_explicit: task.ownership_explicit,
          source: task.source,
          title: task.title,
          priority: task.priority,
          risk_level: task.risk_level,
        },
        OWNERSHIP_CLASSES.RUNTIME_ONLY,
      );
    }
  }

  for (const [taskId, roadmapEntries] of roadmapById.entries()) {
    const runtimeEntries = runtimeById.get(taskId);
    if (!runtimeEntries) continue;
    const roadmapTask = roadmapEntries[0];
    const runtimeTask = runtimeEntries[0];
    if (roadmapTask.status === 'done' && ACTIVE_RUNTIME_STATUSES.has(runtimeTask.status)) {
      addFinding(
        findings,
        'critical',
        'roadmap_done_runtime_active',
        `ROADMAP marks ${taskId} done while runtime is ${runtimeTask.status}`,
        PATHS.roadmap,
        {
          task_id: taskId,
          roadmap_status: roadmapTask.status,
          runtime_status: runtimeTask.status,
        },
        OWNERSHIP_CLASSES.ROADMAP_BACKED,
      );
    }
    if (runtimeTask.status === 'done' && roadmapTask.status !== 'done') {
      addFinding(
        findings,
        'critical',
        'runtime_done_roadmap_not_done',
        `Runtime marks ${taskId} done while ROADMAP is ${roadmapTask.status || 'unknown'}`,
        PATHS.taskState,
        {
          task_id: taskId,
          roadmap_status: roadmapTask.status,
          runtime_status: runtimeTask.status,
        },
        OWNERSHIP_CLASSES.ROADMAP_BACKED,
      );
    }
    if (
      roadmapTask.status &&
      runtimeTask.status &&
      !isStatusMappingAllowed(roadmapTask.status, runtimeTask.status)
    ) {
      addFinding(
        findings,
        'warning',
        'roadmap_status_differs_from_task_state',
        `ROADMAP status for ${taskId} (${roadmapTask.status}) differs from task-state (${runtimeTask.status})`,
        PATHS.taskState,
        {
          task_id: taskId,
          roadmap_status: roadmapTask.status,
          runtime_status: runtimeTask.status,
        },
        OWNERSHIP_CLASSES.ROADMAP_BACKED,
      );
    }
  }

  return findings;
}

export function buildResultFromInputs(roadmapContent, taskState) {
  const parseResult = parseRoadmap(roadmapContent);
  const roadmapTasks = parseResult.tasks || parseResult;
  const taskReferences = parseResult.taskReferences || [];
  const runtimeTasks = parseTaskState(taskState);
  const annotated = annotateOwnership(roadmapTasks, runtimeTasks);
  const findings = compareStates(annotated.roadmapTasks, annotated.runtimeTasks);
  const criticalCount = findings.filter((finding) => finding.severity === 'critical').length;
  const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
  const infoCount = findings.filter((finding) => finding.severity === 'info').length;

  return {
    summary: {
      generated_at: nowIso(),
      status: criticalCount > 0 ? 'critical_findings' : 'ok',
      roadmap_task_count: roadmapTasks.length,
      task_reference_count: taskReferences.length,
      task_state_task_count: runtimeTasks.length,
      finding_count: findings.length,
      critical_count: criticalCount,
      warning_count: warningCount,
      info_count: infoCount,
      files_read: [PATHS.roadmap, PATHS.taskState],
      read_only: true,
      exit_code: criticalCount > 0 ? EXIT_CODES.CRITICAL_FINDINGS : EXIT_CODES.OK,
    },
    ownership_summary: buildOwnershipSummary(annotated.roadmapTasks, annotated.runtimeTasks),
    roadmap_tasks: annotated.roadmapTasks,
    task_references: taskReferences,
    task_state_tasks: annotated.runtimeTasks,
    findings,
  };
}

function buildResult() {
  const roadmapContent = readText(PATHS.roadmap);
  const taskState = readJson(PATHS.taskState);
  return buildResultFromInputs(roadmapContent, taskState);
}

function formatFinding(finding) {
  return `- [${finding.severity}] [${finding.ownership_class}] [${finding.code}] ${finding.file}: ${finding.message}`;
}

export function formatHuman(result) {
  const lines = [];
  lines.push('# Ralph V2 ROADMAP <-> Task-State Reconciler');
  lines.push('');
  lines.push(`Generated: ${result.summary.generated_at}`);
  lines.push(`Status: ${result.summary.status}`);
  lines.push(`ROADMAP tasks parsed: ${result.summary.roadmap_task_count}`);
  lines.push(`ROADMAP task references: ${result.summary.task_reference_count || 0}`);
  lines.push(`Task-state tasks parsed: ${result.summary.task_state_task_count}`);
  lines.push(`Critical findings: ${result.summary.critical_count}`);
  lines.push(`Warnings: ${result.summary.warning_count}`);
  lines.push(`Info findings: ${result.summary.info_count}`);
  lines.push('');
  lines.push('## Critical Findings');
  const critical = result.findings.filter((finding) => finding.severity === 'critical');
  lines.push(...(critical.length ? critical.map(formatFinding) : ['- None']));
  lines.push('');
  lines.push('## Warnings');
  const warnings = result.findings.filter((finding) => finding.severity === 'warning');
  lines.push(...(warnings.length ? warnings.map(formatFinding) : ['- None']));
  lines.push('');
  lines.push('## Info');
  const info = result.findings.filter((finding) => finding.severity === 'info');
  lines.push(...(info.length ? info.map(formatFinding) : ['- None']));
  lines.push('');
  lines.push('## Read-only Guarantee');
  lines.push('- No files were written or repaired by this reconciler.');
  lines.push('- ROADMAP.md remains planning authority.');
  lines.push('- tasks/task-state.json remains runtime execution state.');
  return lines.join('\n');
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      process.exit(EXIT_CODES.OK);
    }

    const result = buildResult();
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatHuman(result));
    process.exit(result.summary.exit_code);
  } catch (error) {
    const payload = {
      summary: {
        generated_at: nowIso(),
        status: 'reconciler_execution_error',
        exit_code: EXIT_CODES.EXECUTION_ERROR,
      },
      error: error.message,
    };
    if (process.argv.includes('--json')) console.error(JSON.stringify(payload, null, 2));
    else console.error(`Reconciler execution error: ${error.message}`);
    process.exit(EXIT_CODES.EXECUTION_ERROR);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
