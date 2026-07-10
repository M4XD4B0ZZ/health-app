import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SCHEMA_VERSION = '1.0.0';
export const TASK_ID = 'RALPH-046A';
export const CONSUMER_ID = 'canonical-queue-consumer-probe';
export const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const ALLOWED_QUEUE_ENTRY_DIR = '.agent/overnight/queue-entries/';
export const DEFAULT_ARTIFACT_PATH =
  '.agent/overnight/queue-entries/ralph-045a-canonical-queue-entry-probe.json';
export const EXPECTED_ARTIFACT_TYPE = 'canonical_boundary_queue_entry_probe';

export const DECISIONS = Object.freeze({
  INSPECTABLE_NON_EXECUTABLE_PROBE: 'inspectable_non_executable_probe',
  BLOCKED_MISSING_OR_INVALID_ARTIFACT: 'blocked_missing_or_invalid_artifact',
  BLOCKED_AUTHORITY_CLAIM: 'blocked_authority_claim',
  BLOCKED_NOT_QUEUE_ENTRY_PROBE: 'blocked_not_queue_entry_probe',
  BLOCKED_UNSAFE_PATH: 'blocked_unsafe_path',
});

export const REQUIRED_FALSE_FLAGS = Object.freeze([
  'canonical_queue_admission',
  'queue_execution',
  'worker_execution',
  'task_execution',
  'lifecycle_execution',
  'runtime_authority',
  'runtime_write',
  'evidence_mutation',
  'review_mutation',
  'validation_mutation',
  'handoff_mutation',
  'review_acceptance',
  'validation_authority',
  'validation_pass',
  'task_completion',
  'commit_readiness',
  'staging',
  'commit',
  'push',
  'deploy',
  'dependency_install',
  'network',
  'product_work',
]);

export const NON_AUTHORIZATION_STATEMENT =
  'This RALPH-046A canonical queue consumer probe is read-only and stdout-only. It does not authorize canonical queue admission, queue consumption, dequeue, acknowledge, reserve, lock, retry, scheduling, lifecycle transition, execution-plan generation, worker execution, task execution, runtime authority, runtime mutation, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, network access, product work, or protected-file mutation.';

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function normalizeRepoPath(value) {
  return String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function buildAuthorityFlags() {
  return Object.fromEntries(REQUIRED_FALSE_FLAGS.map((flag) => [flag, false]));
}

function buildBaseResult({
  artifactPath = DEFAULT_ARTIFACT_PATH,
  decision = DECISIONS.BLOCKED_MISSING_OR_INVALID_ARTIFACT,
  findings = [],
  artifactSummary = null,
} = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    task_id: TASK_ID,
    consumer: CONSUMER_ID,
    mode: 'read_only_stdout',
    decision,
    artifact_path: normalizeRepoPath(artifactPath),
    artifact_summary: artifactSummary,
    stdout_only: true,
    writes_performed: false,
    non_authoritative: true,
    queue_consumption: false,
    dequeue: false,
    acknowledge: false,
    reserve: false,
    lock: false,
    retry: false,
    scheduling: false,
    lifecycle_transition: false,
    execution_plan_generation: false,
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
    ...buildAuthorityFlags(),
    findings,
  };
}

export function validateQueueEntryPath(
  inputPath = DEFAULT_ARTIFACT_PATH,
  projectRoot = DEFAULT_PROJECT_ROOT,
) {
  const raw = String(inputPath ?? '');
  const normalized = normalizeRepoPath(raw);
  const findings = [];
  const root = path.resolve(projectRoot);

  if (!raw.trim()) {
    findings.push(finding('critical', 'missing_path', 'Queue-entry artifact path is required'));
  }
  if (path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) {
    findings.push(
      finding(
        'critical',
        'absolute_or_drive_path_refused',
        'Absolute or drive-qualified paths are refused',
        { artifact_path: raw },
      ),
    );
  }
  if (normalized.split('/').includes('..')) {
    findings.push(
      finding('critical', 'path_traversal_refused', 'Path traversal is refused', {
        artifact_path: raw,
      }),
    );
  }
  if (!normalized.startsWith(ALLOWED_QUEUE_ENTRY_DIR)) {
    findings.push(
      finding(
        'critical',
        'outside_allowed_queue_entry_dir',
        'Only queue-entry artifacts under the allowed canonical-boundary queue-entry directory may be inspected',
        { artifact_path: raw, allowed_dir: ALLOWED_QUEUE_ENTRY_DIR },
      ),
    );
  }
  if (!normalized.endsWith('.json')) {
    findings.push(
      finding(
        'critical',
        'non_json_artifact_refused',
        'Only JSON queue-entry artifacts may be inspected',
        { artifact_path: raw },
      ),
    );
  }

  const absolutePath = path.resolve(root, ...normalized.split('/'));
  const relative = path.relative(root, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    findings.push(
      finding(
        'critical',
        'repo_containment_failed',
        'Artifact path must remain contained within the project root',
        { artifact_path: raw },
      ),
    );
  }

  if (findings.length === 0) {
    const rootReal = fs.realpathSync.native(root);
    const relativeParts = normalized.split('/');
    let current = root;
    for (const part of relativeParts) {
      current = path.join(current, part);
      if (!fs.existsSync(current)) break;
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        findings.push(
          finding(
            'critical',
            'symlink_escape_refused',
            'Symlink path components are refused for queue-entry artifact inspection',
            { path: normalizeRepoPath(path.relative(root, current)) },
          ),
        );
        break;
      }
      const real = fs.realpathSync.native(current);
      if (!real.startsWith(`${rootReal}${path.sep}`) && real !== rootReal) {
        findings.push(
          finding(
            'critical',
            'repo_containment_failed',
            'Resolved artifact path escaped project root',
            { path: normalizeRepoPath(path.relative(root, current)) },
          ),
        );
        break;
      }
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    normalized_path: normalized,
    absolute_path: absolutePath,
  };
}

export function parseArtifactContent(content) {
  try {
    return { ok: true, artifact: JSON.parse(String(content)), findings: [] };
  } catch (error) {
    return {
      ok: false,
      artifact: null,
      findings: [
        finding('critical', 'invalid_json', 'Queue-entry artifact JSON could not be parsed', {
          error: error.message,
        }),
      ],
    };
  }
}

export function evaluateQueueEntryArtifact(artifact) {
  const findings = [];

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    findings.push(
      finding('critical', 'artifact_not_object', 'Queue-entry artifact must be a JSON object'),
    );
    return {
      decision: DECISIONS.BLOCKED_MISSING_OR_INVALID_ARTIFACT,
      findings,
      artifact_summary: null,
    };
  }

  const artifactSummary = {
    schema_version: artifact.schema_version ?? null,
    task_id: artifact.task_id ?? null,
    writer: artifact.writer ?? null,
    artifact_type: artifact.artifact_type ?? null,
    target_path: artifact.target_path ?? null,
    queue_entry_id: artifact.queue_entry_id ?? null,
    queue_entry_created: artifact.queue_entry_created ?? null,
    non_authoritative: artifact.non_authoritative ?? null,
  };

  const requiredFields = [
    'schema_version',
    'task_id',
    'writer',
    'artifact_type',
    'target_path',
    'queue_entry_id',
    'queue_entry_created',
    'non_authoritative',
  ];
  for (const field of requiredFields) {
    if (!(field in artifact))
      findings.push(
        finding(
          'critical',
          'missing_required_field',
          'Required queue-entry artifact field is missing',
          { field },
        ),
      );
  }

  if (artifact.artifact_type !== EXPECTED_ARTIFACT_TYPE) {
    findings.push(
      finding(
        'critical',
        'wrong_artifact_type',
        'Artifact is not a canonical-boundary queue-entry probe',
        { artifact_type: artifact.artifact_type, expected_artifact_type: EXPECTED_ARTIFACT_TYPE },
      ),
    );
  }

  if (artifact.non_authoritative !== true) {
    findings.push(
      finding(
        'critical',
        'non_authoritative_required',
        'Queue-entry artifact must declare non_authoritative as true',
        { value: artifact.non_authoritative },
      ),
    );
  }

  for (const flag of REQUIRED_FALSE_FLAGS) {
    if (artifact[flag] !== false) {
      findings.push(
        finding(
          'critical',
          'authority_or_execution_claim',
          'Authority, execution, mutation, or external-operation claim detected',
          { flag, value: artifact[flag] },
        ),
      );
    }
  }

  if (findings.some((entry) => entry.code === 'wrong_artifact_type')) {
    return {
      decision: DECISIONS.BLOCKED_NOT_QUEUE_ENTRY_PROBE,
      findings,
      artifact_summary: artifactSummary,
    };
  }
  if (
    findings.some(
      (entry) =>
        entry.code === 'authority_or_execution_claim' ||
        entry.code === 'non_authoritative_required',
    )
  ) {
    return {
      decision: DECISIONS.BLOCKED_AUTHORITY_CLAIM,
      findings,
      artifact_summary: artifactSummary,
    };
  }
  if (findings.length > 0) {
    return {
      decision: DECISIONS.BLOCKED_MISSING_OR_INVALID_ARTIFACT,
      findings,
      artifact_summary: artifactSummary,
    };
  }

  return {
    decision: DECISIONS.INSPECTABLE_NON_EXECUTABLE_PROBE,
    findings,
    artifact_summary: artifactSummary,
  };
}

export function consumeCanonicalQueueEntryProbeFromContent(content, options = {}) {
  const artifactPath = options.artifactPath || DEFAULT_ARTIFACT_PATH;
  const parsed = parseArtifactContent(content);
  if (!parsed.ok) {
    return buildBaseResult({
      artifactPath,
      decision: DECISIONS.BLOCKED_MISSING_OR_INVALID_ARTIFACT,
      findings: parsed.findings,
    });
  }
  const evaluation = evaluateQueueEntryArtifact(parsed.artifact);
  return buildBaseResult({
    artifactPath,
    decision: evaluation.decision,
    findings: evaluation.findings,
    artifactSummary: evaluation.artifact_summary,
  });
}

export function consumeCanonicalQueueEntryProbe(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const artifactPath = options.artifactPath || DEFAULT_ARTIFACT_PATH;
  const pathValidation = validateQueueEntryPath(artifactPath, projectRoot);
  if (!pathValidation.ok) {
    return buildBaseResult({
      artifactPath,
      decision: DECISIONS.BLOCKED_UNSAFE_PATH,
      findings: pathValidation.findings,
    });
  }
  if (!fs.existsSync(pathValidation.absolute_path)) {
    return buildBaseResult({
      artifactPath: pathValidation.normalized_path,
      decision: DECISIONS.BLOCKED_MISSING_OR_INVALID_ARTIFACT,
      findings: [
        finding('critical', 'artifact_missing', 'Queue-entry artifact does not exist', {
          artifact_path: pathValidation.normalized_path,
        }),
      ],
    });
  }
  const content = fs.readFileSync(pathValidation.absolute_path, 'utf8');
  return consumeCanonicalQueueEntryProbeFromContent(content, {
    artifactPath: pathValidation.normalized_path,
  });
}

export function formatCanonicalQueueConsumerProbeSummary(result) {
  const lines = [];
  lines.push(`# ${TASK_ID} Read-Only Canonical Queue Consumer Probe`);
  lines.push(`Decision: ${result.decision}`);
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Artifact path: ${result.artifact_path}`);
  lines.push(`Stdout only: ${result.stdout_only}`);
  lines.push(`Writes performed: ${result.writes_performed}`);
  lines.push(`Non-authoritative: ${result.non_authoritative}`);
  for (const flag of REQUIRED_FALSE_FLAGS) lines.push(`${flag}: ${result[flag]}`);
  if (result.findings.length === 0) lines.push('Findings: none');
  for (const entry of result.findings)
    lines.push(`Finding: ${entry.severity} ${entry.code} - ${entry.message}`);
  return lines.join('\n');
}
