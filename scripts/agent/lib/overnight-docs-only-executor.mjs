import fs from 'node:fs';
import path from 'node:path';

export const DOCS_ONLY_EXECUTOR_SCHEMA_VERSION = '1.0.0';
export const DOCS_ONLY_EXECUTOR_PHASE = 'RALPH-034T';
export const SOURCE_EXECUTION_CAPABILITY_PHASE = 'RALPH-034R';

const REQUIRED_SOURCE_MODE = 'execution_capability_gate_simulation_only';
const REQUIRED_SOURCE_DISPOSITION = 'eligible_for_docs_only_execution';
const SUPPORTED_OPERATION = 'create_markdown_file';
const NON_AUTHORIZATION_STATEMENT = 'This RALPH-034T docs-only executor is a supervised, bounded docs-only mutation capability. It can create exactly one direct low-authority Markdown file under docs/, plans/, or reports/ only when --write-docs-only is explicitly supplied. It does not execute queued tasks, invoke workers, invoke adapters, invoke providers or models, execute prompts, run validation commands, accept review, mutate runtime state, mutate evidence, stage, commit, push, deploy, or perform product work.';

const REQUIRED_ZERO_SOURCE_COUNTERS = Object.freeze(['queued_tasks_executed', 'worker_invocations', 'adapter_invocations', 'provider_invocations', 'model_invocations', 'prompt_executions', 'network_requests', 'validation_commands_executed', 'review_acceptance_actions', 'approval_actions', 'approval_records_written', 'approval_evidence_writes', 'review_evidence_writes', 'validation_evidence_writes', 'task_history_writes', 'run_history_writes', 'task_commands_executed', 'runtime_state_mutations', 'evidence_mutations', 'files_written', 'reports_written', 'run_logs_written', 'staged_files', 'product_work']);
const REQUIRED_FALSE_SOURCE_COUNTERS = Object.freeze(['commits', 'push']);
const REQUIRED_TRUE_SOURCE_FLAGS = Object.freeze(['planning_only', 'non_authoritative', 'non_mutating', 'non_authorizing_output', 'no_execution', 'no_runtime_state_mutation', 'no_evidence_mutation', 'no_validation_execution', 'no_review_acceptance', 'no_worker_invocation', 'no_adapter_invocation', 'no_provider_invocation', 'no_model_invocation', 'no_prompt_execution', 'no_network_activity', 'no_file_writes', 'no_stage', 'no_commit', 'no_push']);
const SOURCE_AUTHORIZATION_FIELDS = Object.freeze(['execution_authorized', 'docs_only_execution_authorized', 'runtime_mutation_authorized', 'evidence_mutation_authorized', 'worker_invocation_authorized', 'adapter_invocation_authorized', 'provider_invocation_authorized', 'model_invocation_authorized', 'prompt_execution_authorized', 'validation_execution_authorized', 'review_acceptance_authorized', 'stage_authorized', 'commit_authorized', 'push_authorized']);

function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function asArray(value) { return Array.isArray(value) ? [...value] : []; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function finding(severity, code, message, details = {}) { return { severity, code, message, details }; }
function normalizePath(value) { return typeof value === 'string' ? value.replace(/\\/g, '/') : value; }

export function extractSource(input = {}) {
  if (isPlainObject(input.ralph_034r_source)) return input.ralph_034r_source;
  if (isPlainObject(input.source)) return input.source;
  if (input.phase === SOURCE_EXECUTION_CAPABILITY_PHASE) return input;
  return null;
}

export function extractOperation(input = {}) {
  if (isPlainObject(input.operation)) return input.operation;
  const operations = asArray(input.operations);
  return operations.length === 1 && isPlainObject(operations[0]) ? operations[0] : null;
}

function intendedFiles(source = {}) {
  const fromScope = isPlainObject(source.hypothetical_task_scope) ? source.hypothetical_task_scope.intended_changed_files : null;
  const files = Array.isArray(fromScope) ? fromScope : Array.isArray(source.intended_changed_files) ? source.intended_changed_files : null;
  if (files) return files.map(normalizePath);
  return asArray(source.file_scope_analysis).map((entry) => normalizePath(entry?.path));
}

export function validateDocsOnlyPath(pathValue) {
  const pathText = normalizePath(pathValue);
  if (typeof pathText !== 'string' || pathText.trim() === '') return { valid: false, path: pathValue, code: 'invalid_path', message: 'Path must be a non-empty string.' };
  const requestedPath = pathText.trim();
  if (requestedPath.startsWith('/') || /^[A-Za-z]:\//.test(requestedPath)) return { valid: false, path: requestedPath, code: 'invalid_path', message: 'Absolute or drive-letter paths are forbidden.' };
  if (requestedPath.split('/').includes('..')) return { valid: false, path: requestedPath, code: 'invalid_path', message: 'Path traversal is forbidden.' };
  if (requestedPath === '.env' || requestedPath.startsWith('.env.')) return { valid: false, path: requestedPath, code: 'forbidden_path', message: '.env paths are forbidden.' };
  if (['package.json', 'package-lock.json', 'README.md', 'AGENTS.md', 'SSOK.md', 'ROADMAP.md', 'VERIFY.md'].includes(requestedPath)) return { valid: false, path: requestedPath, code: 'forbidden_path', message: 'Root/high-authority files are forbidden.' };
  if (['.agent/', '.governance/', 'handoffs/', 'tasks/', 'runs/', 'validation/', 'review/', 'scripts/', 'src/', 'supabase/', '.git/'].some((prefix) => requestedPath.startsWith(prefix))) return { valid: false, path: requestedPath, code: 'forbidden_path', message: 'Forbidden scope for docs-only executor.' };
  if (!/^(docs|plans|reports)\/[^/]+\.md$/.test(requestedPath)) return { valid: false, path: requestedPath, code: 'not_direct_low_authority_markdown', message: 'Only direct docs/<file>.md, plans/<file>.md, or reports/<file>.md paths are allowed.' };
  return { valid: true, path: requestedPath, code: 'allowed_direct_docs_plans_reports_markdown', message: 'Allowed direct low-authority Markdown path.' };
}

export function validateSource(source = {}) {
  const blocking = [];
  if (!isPlainObject(source)) return { valid: false, blocking_findings: [finding('blocking', 'missing_ralph_034r_source', 'Input must include a RALPH-034R source object.')] };
  if (source.phase !== SOURCE_EXECUTION_CAPABILITY_PHASE) blocking.push(finding('blocking', 'invalid_source_phase', `Expected source phase ${SOURCE_EXECUTION_CAPABILITY_PHASE}.`, { actual: source.phase ?? null }));
  if (source.mode !== REQUIRED_SOURCE_MODE) blocking.push(finding('blocking', 'invalid_source_mode', `Expected source mode ${REQUIRED_SOURCE_MODE}.`, { actual: source.mode ?? null }));
  if (source.execution_capability_disposition !== REQUIRED_SOURCE_DISPOSITION) blocking.push(finding('blocking', 'source_not_eligible', `Expected source disposition ${REQUIRED_SOURCE_DISPOSITION}.`, { actual: source.execution_capability_disposition ?? null }));
  if (source.valid !== true) blocking.push(finding('blocking', 'source_not_valid', 'Source RALPH-034R simulation must be valid true.', { actual: source.valid ?? null }));
  const plan = isPlainObject(source.execution_plan) ? source.execution_plan : {};
  const safety = isPlainObject(source.safety_summary) ? source.safety_summary : {};
  const auth = isPlainObject(source.execution_authorization) ? source.execution_authorization : {};
  for (const field of REQUIRED_ZERO_SOURCE_COUNTERS) if (plan[field] !== 0) blocking.push(finding('blocking', 'nonzero_source_counter', `Source counter must remain zero: ${field}`, { field, actual: plan[field] ?? null }));
  for (const field of REQUIRED_FALSE_SOURCE_COUNTERS) if (plan[field] !== false) blocking.push(finding('blocking', 'unsafe_source_boolean', `Source boolean must remain false: ${field}`, { field, actual: plan[field] ?? null }));
  for (const field of REQUIRED_TRUE_SOURCE_FLAGS) if (safety[field] !== true) blocking.push(finding('blocking', 'missing_source_safety_flag', `Source safety flag must be true: ${field}`, { field, actual: safety[field] ?? null }));
  for (const field of SOURCE_AUTHORIZATION_FIELDS) if (source[field] === true || auth[field] === true) blocking.push(finding('blocking', 'source_claims_authorization', `Source must not claim authorization: ${field}`, { field }));
  return { valid: blocking.length === 0, blocking_findings: blocking };
}

export function validateOperation(operation, source) {
  const blocking = [];
  if (!isPlainObject(operation)) return { valid: false, requested_path: null, content: null, blocking_findings: [finding('blocking', 'missing_operation', 'Input must include exactly one operation object.')] };
  if (operation.type !== SUPPORTED_OPERATION) blocking.push(finding('blocking', 'unsupported_operation', `Only ${SUPPORTED_OPERATION} is supported.`, { actual: operation.type ?? null }));
  const pathCheck = validateDocsOnlyPath(operation.path);
  if (!pathCheck.valid) blocking.push(finding('blocking', pathCheck.code, pathCheck.message, { path: pathCheck.path }));
  const content = operation.content;
  if (typeof content !== 'string' || content.length === 0) blocking.push(finding('blocking', 'invalid_content', 'Markdown content must be a non-empty string.'));
  if (typeof content === 'string' && content.startsWith('\uFEFF')) blocking.push(finding('blocking', 'content_has_bom', 'Markdown content must not start with a BOM; remove the leading BOM before docs-only write.'));
  if (typeof content === 'string' && content.length > 100000) blocking.push(finding('blocking', 'content_too_large', 'Markdown content is too large for first docs-only capability.'));
  if (typeof content === 'string' && /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content)) blocking.push(finding('blocking', 'content_has_control_characters', 'Markdown content contains forbidden control characters.'));
  const requestedPath = pathCheck.valid ? pathCheck.path : normalizePath(operation.path);
  const sourceFiles = intendedFiles(source);
  if (sourceFiles.length !== 1) blocking.push(finding('blocking', 'source_file_count_not_one', 'RALPH-034T supports exactly one intended changed file.', { source_files: sourceFiles }));
  if (requestedPath && sourceFiles.length === 1 && sourceFiles[0] !== requestedPath) blocking.push(finding('blocking', 'requested_path_mismatch', 'Requested operation path must match RALPH-034R intended changed file.', { requested_path: requestedPath, source_files: sourceFiles }));
  const sourceFileScope = asArray(source?.file_scope_analysis).find((entry) => normalizePath(entry?.path) === requestedPath);
  if (sourceFileScope && sourceFileScope.classification !== 'eligible_low_authority_docs_markdown') blocking.push(finding('blocking', 'source_file_scope_not_eligible', 'Matching RALPH-034R file_scope_analysis entry must be eligible low-authority Markdown.', { classification: sourceFileScope.classification ?? null }));
  return { valid: blocking.length === 0, requested_path: requestedPath || null, content, blocking_findings: blocking };
}

function safeTargetPath(root, relativePath) {
  const target = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (target !== normalizedRoot && target.startsWith(`${normalizedRoot}${path.sep}`)) return target;
  throw new Error('Resolved target path escaped execution root.');
}

export function executeDocsOnlyOperation(input = {}, options = {}) {
  const writeMode = options.writeDocsOnly === true;
  const executionRoot = options.executionRoot ? path.resolve(options.executionRoot) : process.cwd();
  const source = extractSource(input);
  const operation = extractOperation(input);
  const sourceValidation = validateSource(source);
  const operationValidation = validateOperation(operation, source || {});
  const blockingFindings = [...sourceValidation.blocking_findings, ...operationValidation.blocking_findings];
  const plannedFiles = operationValidation.requested_path ? [operationValidation.requested_path] : [];
  const createdFiles = [];
  const refusedFiles = blockingFindings.map((entry) => entry.details?.path).filter(Boolean);
  let operationStatus = blockingFindings.length > 0 ? 'refused' : writeMode ? 'ready_to_write' : 'dry_run_planned';
  if (blockingFindings.length === 0 && writeMode) {
    try {
      const target = safeTargetPath(executionRoot, operationValidation.requested_path);
      if (fs.existsSync(target)) throw new Error('Target file already exists; overwrite is refused.');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, operationValidation.content, { encoding: 'utf8', flag: 'wx' });
      createdFiles.push(operationValidation.requested_path);
      operationStatus = 'written';
    } catch (error) {
      blockingFindings.push(finding('blocking', 'write_failed', 'Docs-only write failed or was refused.', { message: error.message, path: operationValidation.requested_path }));
      refusedFiles.push(operationValidation.requested_path);
      operationStatus = 'refused';
    }
  }
  const filesWritten = createdFiles.length;
  return {
    schema_version: DOCS_ONLY_EXECUTOR_SCHEMA_VERSION,
    runner: 'overnight-docs-only-executor.mjs',
    phase: DOCS_ONLY_EXECUTOR_PHASE,
    mode: 'supervised_docs_only_executor',
    source_phase: source?.phase || null,
    source_mode: source?.mode || null,
    execution_mode: writeMode ? 'write_docs_only' : 'dry_run',
    operation_status: operationStatus,
    valid: blockingFindings.length === 0,
    planned_files: plannedFiles,
    files_written: filesWritten,
    created_files: createdFiles,
    refused_files: unique(refusedFiles),
    verification_readbacks: ['node --check scripts/agent/lib/overnight-docs-only-executor.mjs', 'node --check scripts/agent/overnight-docs-only-executor.mjs', 'node --test scripts/agent/__tests__/overnight-docs-only-executor.test.mjs', 'git --no-pager status --short docs plans reports'],
    blocking_findings: blockingFindings,
    reason_codes: unique(blockingFindings.map((entry) => entry.code).concat(operationStatus)),
    execution_plan: { queued_tasks_executed: 0, worker_invocations: 0, adapter_invocations: 0, provider_invocations: 0, model_invocations: 0, prompt_executions: 0, network_requests: 0, validation_commands_executed: 0, review_acceptance_actions: 0, approval_actions: 0, approval_records_written: 0, approval_evidence_writes: 0, review_evidence_writes: 0, validation_evidence_writes: 0, task_history_writes: 0, run_history_writes: 0, task_commands_executed: 0, runtime_state_mutations: 0, evidence_mutations: 0, files_written: filesWritten, staged_files: 0, product_work: 0, commits: false, push: false },
    safety_summary: { supervised_docs_only_executor: true, dry_run_by_default: true, writes_require_explicit_write_docs_only_flag: true, writes_limited_to_direct_docs_plans_reports_markdown: true, create_only: true, overwrite_refused: true, no_queued_task_execution: true, no_worker_invocation: true, no_adapter_invocation: true, no_provider_invocation: true, no_model_invocation: true, no_prompt_execution: true, no_validation_execution: true, no_review_acceptance: true, no_runtime_state_mutation: true, no_evidence_mutation: true, no_stage: true, no_commit: true, no_push: true, no_product_work: true },
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT
  };
}

export function formatDocsOnlyExecutorPretty(result) {
  const lines = ['RALPH-034T Supervised Docs-Only Executor', '', `Execution mode: ${result.execution_mode}`, `Operation status: ${result.operation_status}`, `Valid: ${result.valid}`, `Files written: ${result.files_written}`, '', 'Planned files:'];
  for (const file of result.planned_files) lines.push(`- ${file}`);
  if (result.planned_files.length === 0) lines.push('- (none)');
  lines.push('', 'Created files:');
  for (const file of result.created_files) lines.push(`- ${file}`);
  if (result.created_files.length === 0) lines.push('- (none)');
  lines.push('', 'Refused files:');
  for (const file of result.refused_files) lines.push(`- ${file}`);
  if (result.refused_files.length === 0) lines.push('- (none)');
  lines.push('', 'Execution: supervised docs-only create capability; dry-run by default; write requires --write-docs-only; no queued task execution; no validation execution; no review acceptance; no runtime/evidence mutation; no worker invocation; no adapter invocation; no provider/model invocation; no prompt execution; no staging; no commit; no push.', '', `Non-authorization: ${result.non_authorization_statement}`);
  return lines.join('\n');
}