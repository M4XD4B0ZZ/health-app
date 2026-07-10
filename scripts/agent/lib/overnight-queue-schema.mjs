export const TASK_CLASSES = Object.freeze([
  'SAFE_AUTONOMOUS',
  'REVIEW_REQUIRED',
  'HUMAN_ONLY',
  'FORBIDDEN',
]);

export const BASELINE_FORBIDDEN_FILES = Object.freeze([
  '.env',
  '.env.*',
  'secrets/**',
  'credentials/**',
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'node_modules/**',
  '.git/**',
  'src/**',
  'supabase/**',
  'tasks/task-state.json',
  'tasks/task-history.jsonl',
  'runs/current-run.json',
  'runs/run-history.jsonl',
  'validation/validation-results.jsonl',
  'review/review-results.jsonl',
]);

export const FORBIDDEN_COMMAND_PATTERNS = Object.freeze([
  { code: 'command_chaining_forbidden', pattern: /&&/ },
  { code: 'heredoc_forbidden', pattern: /<<\s*\w+|@'|@"/i },
  { code: 'set_content_forbidden', pattern: /\bSet-Content\b/i },
  { code: 'add_content_forbidden', pattern: /\bAdd-Content\b/i },
  { code: 'out_file_forbidden', pattern: /\bOut-File\b/i },
  { code: 'shell_write_redirection_forbidden', pattern: /(^|\s)(>|>>)(\s|$)/ },
  { code: 'git_push_forbidden', pattern: /\bgit\s+push\b/i },
  { code: 'git_reset_hard_forbidden', pattern: /\bgit\s+reset\s+--hard\b/i },
  { code: 'git_rebase_forbidden', pattern: /\bgit\s+rebase\b/i },
  { code: 'rm_rf_forbidden', pattern: /\brm\s+-rf\b/i },
  { code: 'npm_install_forbidden', pattern: /\bnpm\s+install\b/i },
  { code: 'npm_audit_fix_forbidden', pattern: /\bnpm\s+audit\s+fix\b/i },
  { code: 'deploy_forbidden', pattern: /\b(deploy|eas\s+build|supabase\s+functions\s+deploy)\b/i },
  { code: 'long_inline_python_forbidden', pattern: /\bpython\s+-c\s+.{80,}/i },
  { code: 'long_inline_node_forbidden', pattern: /\bnode\s+-e\s+.{80,}/i },
  {
    code: 'long_inline_powershell_forbidden',
    pattern: /\bpowershell(?:\.exe)?\s+-Command\s+.{80,}/i,
  },
]);

const REQUIRED_QUEUE_FIELDS = Object.freeze([
  'schema_version',
  'queue_id',
  'created_at',
  'created_by',
  'mode',
  'tasks',
]);
const REQUIRED_TASK_FIELDS = Object.freeze([
  'task_id',
  'title',
  'class',
  'objective',
  'allowed_files',
  'forbidden_files',
  'max_files_changed',
  'max_diff_lines',
  'allowed_commands',
  'forbidden_commands',
  'required_checks',
  'timeout_minutes',
  'max_attempts',
  'commit_policy',
  'push_policy',
  'stop_conditions',
  'expected_outputs',
  'handoff_required',
  'review_required',
  'notes',
]);
const EDIT_CAPABLE_CLASSES = new Set(['SAFE_AUTONOMOUS']);
const NON_EXECUTABLE_CLASSES = new Set(['REVIEW_REQUIRED', 'HUMAN_ONLY', 'FORBIDDEN']);
const BROAD_FILE_PATTERNS = new Set(['.', './', '*', '**', '**/*', '*/**']);

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasValue(value) {
  return typeof value === 'string'
    ? value.trim().length > 0
    : value !== undefined && value !== null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .trim();
}

function includesPattern(patterns, expected) {
  const normalized = new Set(asArray(patterns).map(normalizePath));
  return normalized.has(expected);
}

function isBroadAllowedFile(pattern) {
  const normalized = normalizePath(pattern);
  return BROAD_FILE_PATTERNS.has(normalized) || normalized === '';
}

function isProductScope(pattern) {
  const normalized = normalizePath(pattern);
  return (
    normalized === 'src' ||
    normalized === 'src/' ||
    normalized === 'src/**' ||
    normalized.startsWith('src/')
  );
}

function unsafeCommandFindings(command, taskId, field) {
  const text = String(command || '');
  return FORBIDDEN_COMMAND_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) =>
    finding('critical', entry.code, `Unsafe command pattern in ${field}: ${text}`, {
      task_id: taskId,
      command: text,
    }),
  );
}

function validateRequiredFields(target, fields, scope) {
  const critical = [];
  for (const field of fields) {
    if (!Object.hasOwn(target, field) || !hasValue(target[field])) {
      critical.push(
        finding('critical', 'missing_required_field', `${scope} missing required field: ${field}`, {
          field,
          scope,
        }),
      );
    }
  }
  return critical;
}

export function validateQueueTask(task, index, options = {}) {
  const critical = [];
  const warnings = [];
  const info = [];
  const taskLabel = `tasks[${index}]`;

  if (!isPlainObject(task)) {
    critical.push(
      finding('critical', 'invalid_task_shape', `${taskLabel} must be an object`, { index }),
    );
    return { critical, warnings, info };
  }

  critical.push(...validateRequiredFields(task, REQUIRED_TASK_FIELDS, taskLabel));
  const taskId = task.task_id || `index_${index}`;
  const taskClass = task.class;

  if (!TASK_CLASSES.includes(taskClass)) {
    critical.push(
      finding(
        'critical',
        'invalid_task_class',
        `Task ${taskId} has missing or unsupported class: ${taskClass || 'missing'}`,
        { task_id: taskId, class: taskClass || null },
      ),
    );
  }

  if (task.commit_policy !== 'never') {
    critical.push(
      finding(
        'critical',
        'commit_policy_must_be_never',
        `Task ${taskId} has invalid commit_policy for v1`,
        { task_id: taskId, commit_policy: task.commit_policy },
      ),
    );
  }
  if (task.push_policy !== 'never') {
    critical.push(
      finding('critical', 'push_policy_must_be_never', `Task ${taskId} has invalid push_policy`, {
        task_id: taskId,
        push_policy: task.push_policy,
      }),
    );
  }

  if (!Array.isArray(task.allowed_files) || task.allowed_files.length === 0) {
    critical.push(
      finding('critical', 'allowed_files_required', `Task ${taskId} must declare allowed_files`, {
        task_id: taskId,
      }),
    );
  } else {
    for (const file of task.allowed_files) {
      if (EDIT_CAPABLE_CLASSES.has(taskClass) && isBroadAllowedFile(file)) {
        critical.push(
          finding(
            'critical',
            'allowed_files_too_broad',
            `Task ${taskId} allowed_files contains overly broad pattern: ${file}`,
            { task_id: taskId, file },
          ),
        );
      }
      if (options.productWorkPaused !== false && isProductScope(file)) {
        critical.push(
          finding(
            'critical',
            'product_scope_forbidden_in_v1',
            `Task ${taskId} includes product scope while product work is paused: ${file}`,
            { task_id: taskId, file },
          ),
        );
      }
    }
  }

  if (!Array.isArray(task.forbidden_files) || task.forbidden_files.length === 0) {
    critical.push(
      finding(
        'critical',
        'forbidden_files_required',
        `Task ${taskId} must declare forbidden_files`,
        { task_id: taskId },
      ),
    );
  } else {
    for (const baseline of BASELINE_FORBIDDEN_FILES) {
      if (!includesPattern(task.forbidden_files, baseline)) {
        critical.push(
          finding(
            'critical',
            'baseline_forbidden_file_missing',
            `Task ${taskId} forbidden_files must include baseline protection: ${baseline}`,
            { task_id: taskId, pattern: baseline },
          ),
        );
      }
    }
  }

  for (const numericField of [
    'max_files_changed',
    'max_diff_lines',
    'timeout_minutes',
    'max_attempts',
  ]) {
    if (
      !Number.isInteger(task[numericField]) ||
      task[numericField] < 0 ||
      (numericField === 'timeout_minutes' && task[numericField] < 1)
    ) {
      critical.push(
        finding('critical', 'invalid_numeric_field', `Task ${taskId} has invalid ${numericField}`, {
          task_id: taskId,
          field: numericField,
          value: task[numericField],
        }),
      );
    }
  }

  for (const arrayField of [
    'allowed_commands',
    'forbidden_commands',
    'required_checks',
    'stop_conditions',
  ]) {
    if (!Array.isArray(task[arrayField]) || task[arrayField].length === 0) {
      critical.push(
        finding(
          'critical',
          'required_array_empty',
          `Task ${taskId} must declare non-empty ${arrayField}`,
          { task_id: taskId, field: arrayField },
        ),
      );
    }
  }

  for (const command of asArray(task.allowed_commands)) {
    critical.push(...unsafeCommandFindings(command, taskId, 'allowed_commands'));
  }
  for (const command of asArray(task.forbidden_commands)) {
    critical.push(...unsafeCommandFindings(command, taskId, 'forbidden_commands'));
  }

  if (taskClass === 'FORBIDDEN') {
    info.push(
      finding(
        'info',
        'forbidden_task_skipped',
        `Task ${taskId} is FORBIDDEN and will never be executable`,
        { task_id: taskId },
      ),
    );
  }
  if (NON_EXECUTABLE_CLASSES.has(taskClass)) {
    info.push(
      finding(
        'info',
        'non_executable_class_skipped',
        `Task ${taskId} class ${taskClass} is dry-run/report only in v1`,
        { task_id: taskId, class: taskClass },
      ),
    );
  }

  return { critical, warnings, info };
}

export function validateOvernightQueue(queue, options = {}) {
  const critical = [];
  const warnings = [];
  const info = [];

  if (!isPlainObject(queue)) {
    critical.push(finding('critical', 'invalid_queue_shape', 'Queue must be a JSON object'));
    return { valid: false, findings: { critical, warnings, info } };
  }

  critical.push(...validateRequiredFields(queue, REQUIRED_QUEUE_FIELDS, 'queue'));

  if (queue.mode !== 'dry_run') {
    critical.push(
      finding(
        'critical',
        'queue_mode_must_be_dry_run',
        'Overnight v1 foundation only accepts mode: dry_run',
        { mode: queue.mode || null },
      ),
    );
  }

  if (!Array.isArray(queue.tasks) || queue.tasks.length === 0) {
    critical.push(
      finding('critical', 'queue_tasks_required', 'Queue tasks must be a non-empty array'),
    );
  } else {
    queue.tasks.forEach((task, index) => {
      const taskResult = validateQueueTask(task, index, options);
      critical.push(...taskResult.critical);
      warnings.push(...taskResult.warnings);
      info.push(...taskResult.info);
    });
  }

  return { valid: critical.length === 0, findings: { critical, warnings, info } };
}

function taskDisposition(task) {
  if (task.class === 'FORBIDDEN') return 'skipped_forbidden';
  if (task.class === 'HUMAN_ONLY') return 'skipped_human_only';
  if (task.class === 'REVIEW_REQUIRED') return 'skipped_review_required';
  return 'dry_run_only_no_execution';
}

export function buildDryRunPlan(queue, options = {}) {
  const validation = validateOvernightQueue(queue, options);
  const tasks = Array.isArray(queue?.tasks) ? queue.tasks : [];
  const classDistribution = Object.fromEntries(TASK_CLASSES.map((taskClass) => [taskClass, 0]));
  const taskSummaries = [];
  const reviewRequiredItems = [];
  const skippedItems = [];

  for (const task of tasks) {
    if (TASK_CLASSES.includes(task?.class)) classDistribution[task.class] += 1;
    const summary = {
      task_id: task?.task_id || null,
      title: task?.title || null,
      class: task?.class || null,
      disposition: taskDisposition(task || {}),
      execution: 'not_executed',
      worker_invocation: 'not_invoked',
      runtime_state_mutation: 'not_performed',
      commit: 'not_performed',
      push: 'not_performed',
    };
    taskSummaries.push(summary);
    if (
      task?.review_required === true ||
      task?.class === 'REVIEW_REQUIRED' ||
      task?.class === 'HUMAN_ONLY'
    ) {
      reviewRequiredItems.push(summary);
    }
    if (summary.disposition !== 'dry_run_only_no_execution') {
      skippedItems.push(summary);
    }
  }

  return {
    schema_version: '1.0.0',
    planner: 'overnight-dry-run-plan.mjs',
    queue_id: queue?.queue_id || null,
    valid: validation.valid,
    findings: validation.findings,
    task_summaries: taskSummaries,
    class_distribution: classDistribution,
    execution_plan: {
      mode: 'dry_run',
      queued_tasks_executed: 0,
      worker_invocations: 0,
      runtime_state_mutations: 0,
      commands_executed_from_queue: 0,
      message: validation.valid
        ? 'Queue is valid for dry-run planning only. No execution is authorized.'
        : 'Queue is invalid or unsafe. No execution is authorized.',
    },
    review_required_items: reviewRequiredItems,
    skipped_items: skippedItems,
    safety_summary: {
      no_execution: true,
      no_worker_invocation: true,
      no_runtime_state_mutation: true,
      no_product_work: true,
      no_commit: true,
      no_push: true,
    },
    recommended_next_human_actions: validation.valid
      ? [
          'Review dry-run plan.',
          'Do not proceed to executor implementation without a separate planning task.',
        ]
      : [
          'Repair queue critical findings.',
          'Rerun dry-run planner before any overnight execution design.',
        ],
  };
}
