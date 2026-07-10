import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_ARTIFACT_PATH,
  DECISIONS as CONSUMER_DECISIONS,
  REQUIRED_FALSE_FLAGS,
  consumeCanonicalQueueEntryProbe,
  consumeCanonicalQueueEntryProbeFromContent,
  validateQueueEntryPath,
} from './canonical-queue-consumer-probe.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SCHEMA_VERSION = '1.0.0';
export const TASK_ID = 'RALPH-047A';
export const PREVIEW_ID = 'read-only-execution-plan-preview';
export const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');
export { DEFAULT_ARTIFACT_PATH };

export const PREVIEW_DECISIONS = Object.freeze({
  PREVIEW_ONLY_NON_EXECUTABLE: 'preview_only_non_executable',
  BLOCKED_INVALID_JSON: 'blocked_invalid_json',
  BLOCKED_UNSAFE_PATH: 'blocked_unsafe_path',
  BLOCKED_MISSING_CONSUMER_DECISION: 'blocked_missing_consumer_decision',
  BLOCKED_CONSUMER_NOT_ADVISORY: 'blocked_consumer_not_advisory',
  BLOCKED_AUTHORITY_CLAIM: 'blocked_authority_claim',
  BLOCKED_EXECUTION_CLAIM: 'blocked_execution_claim',
  BLOCKED_MUTATION_CLAIM: 'blocked_mutation_claim',
  BLOCKED_WRONG_ARTIFACT_TYPE: 'blocked_wrong_artifact_type',
});

export const PREVIEW_REQUIRED_FALSE_FLAGS = Object.freeze([
  ...REQUIRED_FALSE_FLAGS,
  'canonical_queue_admission',
  'queue_consumption',
  'dequeue',
  'acknowledge',
  'reserve',
  'lock',
  'retry',
  'scheduling',
  'lifecycle_transition',
  'execution_plan_generation',
  'execution_authority',
  'executable',
  'queue_admission',
  'validation_execution',
  'review_acceptance',
  'handoff_write',
]);

export const NON_AUTHORIZATION_STATEMENT =
  'This RALPH-047A execution-plan preview is read-only, stdout-only, preview_only, non-authoritative, and non-executable. It performs no writes and does not authorize canonical queue admission, queue consumption, worker execution, task execution, lifecycle transitions, runtime authority, runtime mutation, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, network access, product work, or execution.';

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function normalizeRepoPath(value) {
  return String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function falseFlags() {
  return Object.fromEntries(
    Array.from(new Set(PREVIEW_REQUIRED_FALSE_FLAGS)).map((flag) => [flag, false]),
  );
}

function buildBasePreview({
  decision = PREVIEW_DECISIONS.BLOCKED_MISSING_CONSUMER_DECISION,
  sourcePath = null,
  consumerDecision = null,
  findings = [],
} = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    task_id: TASK_ID,
    preview: PREVIEW_ID,
    mode: 'read_only_stdout_preview',
    decision,
    preview_only: true,
    stdout_only: true,
    writes_performed: false,
    non_authoritative: true,
    executable: false,
    source_path: sourcePath ? normalizeRepoPath(sourcePath) : null,
    consumer_decision: consumerDecision,
    required_future_execution_envelope_inputs: [],
    blockers: [],
    next_review_requirements: [],
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    ...falseFlags(),
    findings,
  };
}

function parseJson(content, label) {
  try {
    return { ok: true, value: JSON.parse(String(content)), findings: [] };
  } catch (error) {
    return {
      ok: false,
      value: null,
      findings: [
        finding('critical', 'invalid_json', `${label} JSON could not be parsed`, {
          error: error.message,
        }),
      ],
    };
  }
}

function isConsumerDecisionObject(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.consumer === 'canonical-queue-consumer-probe'
  );
}

function classifyBlockingDecision(findings) {
  if (findings.some((entry) => entry.code === 'wrong_artifact_type'))
    return PREVIEW_DECISIONS.BLOCKED_WRONG_ARTIFACT_TYPE;
  if (findings.some((entry) => entry.code === 'execution_claim'))
    return PREVIEW_DECISIONS.BLOCKED_EXECUTION_CLAIM;
  if (findings.some((entry) => entry.code === 'mutation_claim'))
    return PREVIEW_DECISIONS.BLOCKED_MUTATION_CLAIM;
  if (findings.some((entry) => entry.code === 'authority_claim'))
    return PREVIEW_DECISIONS.BLOCKED_AUTHORITY_CLAIM;
  if (findings.some((entry) => entry.code === 'missing_consumer_decision'))
    return PREVIEW_DECISIONS.BLOCKED_MISSING_CONSUMER_DECISION;
  return PREVIEW_DECISIONS.BLOCKED_CONSUMER_NOT_ADVISORY;
}

export function validateConsumerDecisionForPreview(consumerDecision) {
  const findings = [];
  if (!isConsumerDecisionObject(consumerDecision)) {
    findings.push(
      finding(
        'critical',
        'missing_consumer_decision',
        'RALPH-047A requires a RALPH-046A canonical queue consumer decision object',
      ),
    );
    return { ok: false, decision: PREVIEW_DECISIONS.BLOCKED_MISSING_CONSUMER_DECISION, findings };
  }

  if (consumerDecision.decision !== CONSUMER_DECISIONS.INSPECTABLE_NON_EXECUTABLE_PROBE) {
    findings.push(
      finding(
        'critical',
        'consumer_not_advisory',
        'Consumer decision must be inspectable_non_executable_probe before preview generation',
        { decision: consumerDecision.decision },
      ),
    );
  }
  if (consumerDecision.stdout_only !== true)
    findings.push(
      finding(
        'critical',
        'stdout_only_required',
        'Consumer decision must declare stdout_only true',
        { value: consumerDecision.stdout_only },
      ),
    );
  if (consumerDecision.writes_performed !== false)
    findings.push(
      finding(
        'critical',
        'mutation_claim',
        'Consumer decision must declare writes_performed false',
        { value: consumerDecision.writes_performed },
      ),
    );
  if (consumerDecision.non_authoritative !== true)
    findings.push(
      finding(
        'critical',
        'authority_claim',
        'Consumer decision must declare non_authoritative true',
        { value: consumerDecision.non_authoritative },
      ),
    );
  if (consumerDecision.execution_plan_generation !== false)
    findings.push(
      finding(
        'critical',
        'execution_claim',
        'Consumer decision must not claim execution-plan generation',
        { value: consumerDecision.execution_plan_generation },
      ),
    );

  if (consumerDecision.artifact_summary?.artifact_type !== 'canonical_boundary_queue_entry_probe') {
    findings.push(
      finding(
        'critical',
        'wrong_artifact_type',
        'Consumer artifact summary must reference the RALPH-045A canonical-boundary queue-entry probe artifact',
        { artifact_type: consumerDecision.artifact_summary?.artifact_type ?? null },
      ),
    );
  }

  const executionFlags = [
    'queue_consumption',
    'dequeue',
    'acknowledge',
    'reserve',
    'lock',
    'retry',
    'scheduling',
    'lifecycle_transition',
    'queue_execution',
    'worker_execution',
    'task_execution',
    'lifecycle_execution',
  ];
  const mutationFlags = [
    'runtime_write',
    'evidence_mutation',
    'review_mutation',
    'validation_mutation',
    'handoff_mutation',
    'staging',
    'commit',
    'push',
    'deploy',
    'dependency_install',
    'network',
    'product_work',
  ];
  const authorityFlags = [
    'canonical_queue_admission',
    'runtime_authority',
    'review_acceptance',
    'validation_authority',
    'validation_pass',
    'task_completion',
    'commit_readiness',
  ];

  for (const flag of executionFlags) {
    if (consumerDecision[flag] !== false)
      findings.push(
        finding(
          'critical',
          'execution_claim',
          'Consumer decision includes an execution or lifecycle claim',
          { flag, value: consumerDecision[flag] },
        ),
      );
  }
  for (const flag of mutationFlags) {
    if (consumerDecision[flag] !== false)
      findings.push(
        finding(
          'critical',
          'mutation_claim',
          'Consumer decision includes a mutation or external-operation claim',
          { flag, value: consumerDecision[flag] },
        ),
      );
  }
  for (const flag of authorityFlags) {
    if (consumerDecision[flag] !== false)
      findings.push(
        finding('critical', 'authority_claim', 'Consumer decision includes an authority claim', {
          flag,
          value: consumerDecision[flag],
        }),
      );
  }

  const decision =
    findings.length === 0
      ? PREVIEW_DECISIONS.PREVIEW_ONLY_NON_EXECUTABLE
      : classifyBlockingDecision(findings);
  return { ok: findings.length === 0, decision, findings };
}

export function generateExecutionPlanPreviewFromConsumerDecision(consumerDecision, options = {}) {
  const validation = validateConsumerDecisionForPreview(consumerDecision);
  const preview = buildBasePreview({
    decision: validation.decision,
    sourcePath: options.sourcePath || consumerDecision?.artifact_path || null,
    consumerDecision: isConsumerDecisionObject(consumerDecision) ? consumerDecision.decision : null,
    findings: validation.findings,
  });

  if (!validation.ok) {
    preview.blockers = validation.findings.map((entry) => entry.code);
    preview.next_review_requirements = [
      'Human review required before any future execution-envelope planning continues',
    ];
    return preview;
  }

  return {
    ...preview,
    decision: PREVIEW_DECISIONS.PREVIEW_ONLY_NON_EXECUTABLE,
    required_future_execution_envelope_inputs: [
      'human-approved task identity and scope',
      'authoritative execution envelope schema from a future ROADMAP task',
      'allowed_files and forbidden_files for the future task',
      'required verification commands and stop conditions',
      'review gate requirements before any execution authority exists',
      'fresh git readbacks confirming no staged files and expected changed-file scope',
    ],
    blockers: [
      'preview_only_non_executable',
      'no_execution_authority',
      'no_queue_admission',
      'no_queue_consumption',
      'no_lifecycle_transition',
      'no_runtime_or_evidence_mutation',
    ],
    next_review_requirements: [
      'Human review must approve any future task that introduces execution-envelope authority',
      'A separate ROADMAP task must explicitly authorize any future runtime, queue, evidence, review, validation, or handoff mutation',
      'Future implementation must preserve fail-closed handling for authority, execution, and mutation claims',
    ],
  };
}

export function generateExecutionPlanPreviewFromJson(content, options = {}) {
  const parsed = parseJson(content, 'Input');
  if (!parsed.ok) {
    return buildBasePreview({
      decision: PREVIEW_DECISIONS.BLOCKED_INVALID_JSON,
      sourcePath: options.sourcePath || null,
      findings: parsed.findings,
    });
  }
  if (isConsumerDecisionObject(parsed.value))
    return generateExecutionPlanPreviewFromConsumerDecision(parsed.value, options);
  const consumerDecision = consumeCanonicalQueueEntryProbeFromContent(content, {
    artifactPath: options.sourcePath || DEFAULT_ARTIFACT_PATH,
  });
  return generateExecutionPlanPreviewFromConsumerDecision(consumerDecision, options);
}

export function generateExecutionPlanPreview(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  if (typeof options.inputJson === 'string')
    return generateExecutionPlanPreviewFromJson(options.inputJson, {
      sourcePath: options.sourcePath || 'inline-json',
    });

  const inputPath = options.inputPath || DEFAULT_ARTIFACT_PATH;
  const pathValidation = validateQueueEntryPath(inputPath, projectRoot);
  if (!pathValidation.ok) {
    return buildBasePreview({
      decision: PREVIEW_DECISIONS.BLOCKED_UNSAFE_PATH,
      sourcePath: inputPath,
      findings: pathValidation.findings,
    });
  }
  if (!fs.existsSync(pathValidation.absolute_path)) {
    return buildBasePreview({
      decision: PREVIEW_DECISIONS.BLOCKED_MISSING_CONSUMER_DECISION,
      sourcePath: pathValidation.normalized_path,
      findings: [
        finding('critical', 'input_missing', 'Input artifact path does not exist', {
          input_path: pathValidation.normalized_path,
        }),
      ],
    });
  }
  const consumerDecision = consumeCanonicalQueueEntryProbe({
    projectRoot,
    artifactPath: pathValidation.normalized_path,
  });
  return generateExecutionPlanPreviewFromConsumerDecision(consumerDecision, {
    sourcePath: pathValidation.normalized_path,
  });
}

export function formatExecutionPlanPreviewSummary(result) {
  const lines = [];
  lines.push(`# ${TASK_ID} Read-Only Execution Plan Preview`);
  lines.push(`Decision: ${result.decision}`);
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Preview only: ${result.preview_only}`);
  lines.push(`Executable: ${result.executable}`);
  lines.push(`Stdout only: ${result.stdout_only}`);
  lines.push(`Writes performed: ${result.writes_performed}`);
  lines.push(`Non-authoritative: ${result.non_authoritative}`);
  lines.push(
    `Required future inputs: ${result.required_future_execution_envelope_inputs.length === 0 ? 'none' : result.required_future_execution_envelope_inputs.join('; ')}`,
  );
  lines.push(`Blockers: ${result.blockers.length === 0 ? 'none' : result.blockers.join('; ')}`);
  for (const flag of Object.keys(falseFlags()).sort()) lines.push(`${flag}: ${result[flag]}`);
  if (result.findings.length === 0) lines.push('Findings: none');
  for (const entry of result.findings)
    lines.push(`Finding: ${entry.severity} ${entry.code} - ${entry.message}`);
  return lines.join('\n');
}
