import fs from 'node:fs';
import path from 'node:path';

export const RALPH_RUNTIME_SANDBOX_WRITE_SCHEMA_VERSION = '1.0.0';
export const RALPH_RUNTIME_SANDBOX_WRITE_PHASE = 'RALPH-035B';
export const SANDBOX_RUNTIME_STATE_PATH = '.agent/runtime/sandbox/ralph-035b-simulated-state.json';
export const SANDBOX_RUNTIME_STATE_PAYLOAD = Object.freeze({ simulated: true });

const NON_AUTHORIZATION_STATEMENT = 'This RALPH-035B sandbox runtime-state writer is a supervised, bounded, non-authoritative create-only capability. It can create exactly one fixed sandbox JSON file only when --write-sandbox-state is explicitly supplied. It does not mutate canonical runtime, evidence, governance, product, package, validation, review, handoff, git, or deployment state.';
const FORBIDDEN_PAYLOAD_KEYS = Object.freeze(['task', 'tasks', 'task_id', 'task_state', 'run', 'runs', 'run_id', 'status', 'history', 'evidence', 'validation', 'review', 'handoff', 'governance', 'roadmap', 'authority', 'authoritative']);

function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function normalizePath(value) { return typeof value === 'string' ? value.replace(/\\/g, '/') : value; }
function finding(severity, code, message, details = {}) { return { severity, code, message, details }; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

function exactSandboxPayload(value) {
  return isPlainObject(value) && Object.keys(value).length === 1 && value.simulated === true;
}

function hasAuthorityLikePayload(value) {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).some((key) => FORBIDDEN_PAYLOAD_KEYS.includes(key.toLowerCase()));
}

export function validateSandboxRuntimeStatePath(pathValue = SANDBOX_RUNTIME_STATE_PATH) {
  const pathText = normalizePath(pathValue);
  if (typeof pathText !== 'string' || pathText.trim() === '') return { valid: false, path: pathValue, code: 'invalid_path', message: 'Sandbox path must be a non-empty string.' };
  const requestedPath = pathText.trim();
  if (requestedPath.startsWith('/') || /^[A-Za-z]:\//.test(requestedPath)) return { valid: false, path: requestedPath, code: 'invalid_path', message: 'Absolute or drive-letter paths are forbidden.' };
  if (requestedPath.split('/').includes('..')) return { valid: false, path: requestedPath, code: 'path_traversal_refused', message: 'Path traversal is forbidden.' };
  if (requestedPath !== SANDBOX_RUNTIME_STATE_PATH) return { valid: false, path: requestedPath, code: 'not_allowlisted_sandbox_path', message: 'Only the fixed RALPH-035B sandbox runtime-state path is allowed.' };
  return { valid: true, path: requestedPath, code: 'allowlisted_sandbox_runtime_state_path', message: 'Allowed fixed sandbox runtime-state path.' };
}

export function validateSandboxRuntimeStatePayload(payload = SANDBOX_RUNTIME_STATE_PAYLOAD) {
  if (hasAuthorityLikePayload(payload)) return { valid: false, code: 'authority_like_payload_refused', message: 'Authority-like runtime/evidence/governance payload fields are forbidden.' };
  if (!exactSandboxPayload(payload)) return { valid: false, code: 'payload_schema_mismatch', message: 'Sandbox payload must match exactly { "simulated": true }.' };
  return { valid: true, code: 'exact_sandbox_payload', message: 'Sandbox payload matches exactly { "simulated": true }.' };
}

function safeTargetPath(root, relativePath) {
  const target = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (target !== normalizedRoot && target.startsWith(`${normalizedRoot}${path.sep}`)) return target;
  throw new Error('Resolved target path escaped execution root.');
}

function assertDirectoryContainment(executionRoot, targetDirectory) {
  const normalizedRoot = path.resolve(executionRoot);
  const realRoot = fs.realpathSync(normalizedRoot);
  const realTargetDirectory = fs.realpathSync(targetDirectory);
  if (realTargetDirectory === realRoot || realTargetDirectory.startsWith(`${realRoot}${path.sep}`)) return;
  throw new Error('Resolved sandbox directory escaped execution root.');
}

function readbackExactSandboxPayload(target) {
  const raw = fs.readFileSync(target, 'utf8');
  const parsed = JSON.parse(raw);
  if (!exactSandboxPayload(parsed)) throw new Error('Sandbox state readback did not match exact schema.');
  return parsed;
}

export function executeSandboxRuntimeStateWrite(options = {}) {
  const writeMode = options.writeSandboxState === true;
  const executionRoot = options.executionRoot ? path.resolve(options.executionRoot) : process.cwd();
  const requestedPath = options.path ?? SANDBOX_RUNTIME_STATE_PATH;
  const payload = Object.hasOwn(options, 'payload') ? options.payload : SANDBOX_RUNTIME_STATE_PAYLOAD;
  const pathValidation = validateSandboxRuntimeStatePath(requestedPath);
  const payloadValidation = validateSandboxRuntimeStatePayload(payload);
  const blockingFindings = [];
  if (!pathValidation.valid) blockingFindings.push(finding('blocking', pathValidation.code, pathValidation.message, { path: pathValidation.path }));
  if (!payloadValidation.valid) blockingFindings.push(finding('blocking', payloadValidation.code, payloadValidation.message));

  const plannedFiles = pathValidation.valid ? [pathValidation.path] : [];
  const createdFiles = [];
  const refusedFiles = pathValidation.valid ? [] : [normalizePath(requestedPath)];
  const readbackValidations = [];
  let operationStatus = blockingFindings.length > 0 ? 'refused' : writeMode ? 'ready_to_write' : 'dry_run_planned';

  if (blockingFindings.length === 0 && writeMode) {
    try {
      const target = safeTargetPath(executionRoot, pathValidation.path);
      if (fs.existsSync(target)) throw new Error('Target file already exists; overwrite is refused.');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      assertDirectoryContainment(executionRoot, path.dirname(target));
      fs.writeFileSync(target, `${JSON.stringify(SANDBOX_RUNTIME_STATE_PAYLOAD, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      const readbackPayload = readbackExactSandboxPayload(target);
      readbackValidations.push({ path: pathValidation.path, schema_exact: true, payload: readbackPayload });
      createdFiles.push(pathValidation.path);
      operationStatus = 'written';
    } catch (error) {
      blockingFindings.push(finding('blocking', 'write_failed', 'Sandbox runtime-state write failed or was refused.', { message: error.message, path: pathValidation.path }));
      refusedFiles.push(pathValidation.path);
      operationStatus = 'refused';
    }
  }

  const filesWritten = createdFiles.length;
  return {
    schema_version: RALPH_RUNTIME_SANDBOX_WRITE_SCHEMA_VERSION,
    runner: 'ralph-runtime-sandbox-write.mjs',
    phase: RALPH_RUNTIME_SANDBOX_WRITE_PHASE,
    mode: 'supervised_sandbox_runtime_state_write',
    execution_mode: writeMode ? 'write_sandbox_state' : 'dry_run',
    operation_status: operationStatus,
    valid: blockingFindings.length === 0,
    fixed_allowed_path: SANDBOX_RUNTIME_STATE_PATH,
    planned_files: plannedFiles,
    files_written: filesWritten,
    created_files: createdFiles,
    refused_files: unique(refusedFiles),
    readback_validations: readbackValidations,
    verification_readbacks: ['node --check scripts/agent/lib/ralph-runtime-sandbox-write.mjs', 'node --check scripts/agent/ralph-runtime-sandbox-write.mjs', 'node --test scripts/agent/__tests__/ralph-runtime-sandbox-write.test.mjs', 'git --no-pager status --short', 'git --no-pager diff --name-only'],
    blocking_findings: blockingFindings,
    reason_codes: unique(blockingFindings.map((entry) => entry.code).concat(operationStatus)),
    execution_plan: { queued_tasks_executed: 0, worker_invocations: 0, adapter_invocations: 0, provider_invocations: 0, model_invocations: 0, prompt_executions: 0, command_executions: 0, network_requests: 0, validation_commands_executed: 0, review_acceptance_actions: 0, approval_actions: 0, approval_records_written: 0, approval_evidence_writes: 0, review_evidence_writes: 0, validation_evidence_writes: 0, task_history_writes: 0, run_history_writes: 0, task_commands_executed: 0, canonical_runtime_state_mutations: 0, evidence_mutations: 0, governance_mutations: 0, product_work: 0, package_mutations: 0, handoff_mutations: 0, files_written: filesWritten, staged_files: 0, commits: false, push: false, deploy: false },
    safety_summary: { supervised_sandbox_runtime_state_writer: true, dry_run_by_default: true, writes_require_explicit_write_sandbox_state_flag: true, fixed_allowlisted_path_only: true, create_only: true, overwrite_refused: true, append_refused: true, truncate_refused: true, path_containment_enforced: true, traversal_refused: true, alternative_output_paths_refused: true, authority_like_payloads_refused: true, exact_schema_validation: true, readback_validation_after_write: true, no_arbitrary_output_paths: true, no_command_execution_capability: true, no_network_activity: true, no_canonical_runtime_mutation: true, no_evidence_mutation: true, no_governance_mutation: true, no_product_work: true, no_package_mutation: true, no_handoff_mutation: true, no_stage: true, no_commit: true, no_push: true, no_deploy: true },
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT
  };
}

export function formatSandboxRuntimeStateWritePretty(result) {
  const lines = ['RALPH-035B Sandbox Runtime-State Writer', '', `Execution mode: ${result.execution_mode}`, `Operation status: ${result.operation_status}`, `Valid: ${result.valid}`, `Files written: ${result.files_written}`, `Fixed allowed path: ${result.fixed_allowed_path}`, '', 'Planned files:'];
  for (const file of result.planned_files) lines.push(`- ${file}`);
  if (result.planned_files.length === 0) lines.push('- (none)');
  lines.push('', 'Created files:');
  for (const file of result.created_files) lines.push(`- ${file}`);
  if (result.created_files.length === 0) lines.push('- (none)');
  lines.push('', 'Refused files:');
  for (const file of result.refused_files) lines.push(`- ${file}`);
  if (result.refused_files.length === 0) lines.push('- (none)');
  lines.push('', 'Execution: supervised sandbox runtime-state create capability; dry-run by default; write requires --write-sandbox-state; fixed allowlisted path only; exact payload only; no canonical runtime/evidence/governance/product/package/handoff mutation; no command execution capability; no network; no staging; no commit; no push; no deploy.', '', `Non-authorization: ${result.non_authorization_statement}`);
  return lines.join('\n');
}