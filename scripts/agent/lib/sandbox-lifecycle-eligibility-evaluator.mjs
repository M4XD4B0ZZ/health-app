import {
  validateSandboxLifecycleMetadata,
  FORBIDDEN_AUTHORITY_CLAIMS,
  NON_AUTHORITATIVE_LIFECYCLE_STATEMENT
} from './sandbox-queue-entry-lifecycle.mjs';

export const ELIGIBILITY_DECISIONS = Object.freeze({
  ELIGIBLE_FOR_HUMAN_CONSIDERATION: 'eligible_for_human_consideration',
  BLOCKED_MISSING_EVIDENCE: 'blocked_missing_evidence',
  BLOCKED_FORBIDDEN_CLAIM: 'blocked_forbidden_claim',
  BLOCKED_INVALID_LIFECYCLE: 'blocked_invalid_lifecycle',
  BLOCKED_CANONICAL_SCOPE: 'blocked_canonical_scope'
});

const CANONICAL_PROTECTED_PATHS = Object.freeze([
  'tasks/',
  'runs/',
  'validation/',
  'review/',
  'handoffs/',
  '.agent/overnight/',
  'src/',
  'supabase/',
  'package.json',
  'package-lock.json',
  '.env',
  '.env.',
  'secrets/',
  'credentials/',
  '.git/',
  'node_modules/',
  'SSOK.md',
  'AGENTS.md',
  'VERIFY.md',
  '.governance/'
]);

const SCOPE_SCAN_FIELDS = Object.freeze([
  'path',
  'artifact_path',
  'target_path',
  'evidence_path',
  'evidence_paths',
  'expected_changed_files',
  'allowed_files',
  'target_paths',
  'referenced_paths'
]);

const EVIDENCE_MARKER_STATES = Object.freeze([
  'evidence_bundled',
  'awaiting_human_review'
]);

const NON_AUTHORIZATION_STATEMENT = 'This eligibility evaluation does not authorize queue execution, worker execution, task execution, lifecycle execution, runtime behavior, review acceptance, validation authority, task completion, commit readiness, canonical queue admission, or canonical state mutation.';

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(Object(object), key);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function checkCanonicalScopeViolation(value, fieldName, findings) {
  if (typeof value !== 'string') return;
  
  const normalized = value.replace(/\\/g, '/');
  
  for (const protectedPath of CANONICAL_PROTECTED_PATHS) {
    if (normalized.includes(protectedPath)) {
      findings.push(finding(
        'critical',
        'canonical_scope_violation',
        'Canonical or protected scope reference detected',
        { field: fieldName, value, protected_path: protectedPath }
      ));
      return;
    }
  }
}

function scanForCanonicalScopeViolations(input, findings) {
  for (const field of SCOPE_SCAN_FIELDS) {
    if (!hasOwn(input, field)) continue;
    
    const value = input[field];
    
    if (typeof value === 'string') {
      checkCanonicalScopeViolation(value, field, findings);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
          checkCanonicalScopeViolation(value[i], `${field}[${i}]`, findings);
        }
      }
    }
  }
}

function checkForbiddenAuthorityClaims(input, findings) {
  for (const claim of FORBIDDEN_AUTHORITY_CLAIMS) {
    if (hasOwn(input, claim) && input[claim] !== false && input[claim] !== null && input[claim] !== undefined) {
      findings.push(finding(
        'critical',
        'forbidden_authority_claim',
        'Forbidden authority claim detected',
        { claim, value: input[claim] }
      ));
    }
  }
}

function checkEvidenceMarkers(input, findings) {
  const lifecycle = isPlainObject(input.lifecycle) ? input.lifecycle : {};
  const state = typeof lifecycle.state === 'string' ? lifecycle.state : null;
  
  const hasEvidenceBundledFlag = input.evidence_bundled === true;
  const hasEvidenceState = EVIDENCE_MARKER_STATES.includes(state);
  
  if (!hasEvidenceBundledFlag && !hasEvidenceState) {
    findings.push(finding(
      'critical',
      'missing_evidence_marker',
      'No evidence marker detected (evidence_bundled flag or eligible lifecycle state)',
      { lifecycle_state: state, evidence_bundled: input.evidence_bundled }
    ));
  }
}

function determineDecision(findings) {
  if (findings.length === 0) {
    return ELIGIBILITY_DECISIONS.ELIGIBLE_FOR_HUMAN_CONSIDERATION;
  }
  
  // Priority order
  if (findings.some(f => f.code === 'canonical_scope_violation')) {
    return ELIGIBILITY_DECISIONS.BLOCKED_CANONICAL_SCOPE;
  }
  
  if (findings.some(f => f.code === 'forbidden_authority_claim')) {
    return ELIGIBILITY_DECISIONS.BLOCKED_FORBIDDEN_CLAIM;
  }
  
  if (findings.some(f => f.code.includes('lifecycle') || f.code.includes('transition'))) {
    return ELIGIBILITY_DECISIONS.BLOCKED_INVALID_LIFECYCLE;
  }
  
  return ELIGIBILITY_DECISIONS.BLOCKED_MISSING_EVIDENCE;
}

export function evaluateSandboxLifecycleEligibility(input, options = {}) {
  const findings = [];
  
  if (!isPlainObject(input)) {
    findings.push(finding('critical', 'input_not_object', 'Input must be an object'));
    return buildResult(input, findings, options);
  }
  
  if (input.sandbox !== true) {
    findings.push(finding('critical', 'sandbox_marker_missing', 'Input must include sandbox: true', { sandbox: input.sandbox }));
  }
  
  if (input.non_authoritative !== true) {
    findings.push(finding('critical', 'non_authoritative_marker_missing', 'Input must include non_authoritative: true', { non_authoritative: input.non_authoritative }));
  }
  
  if (!hasOwn(input, 'task_id') && !hasOwn(input, 'queue_entry_id')) {
    findings.push(finding('critical', 'missing_identifier', 'Input must include task_id or queue_entry_id'));
  }
  
  if (!hasOwn(input, 'lifecycle') || !isPlainObject(input.lifecycle)) {
    findings.push(finding('critical', 'lifecycle_object_missing', 'Input must include a lifecycle object'));
  } else if (!hasOwn(input.lifecycle, 'state')) {
    findings.push(finding('critical', 'lifecycle_state_missing', 'Lifecycle object must include state'));
  }
  
  // Canonical scope check (highest priority)
  scanForCanonicalScopeViolations(input, findings);
  
  // Forbidden authority claims check
  checkForbiddenAuthorityClaims(input, findings);
  
  // Lifecycle validation
  if (isPlainObject(input.lifecycle) && hasOwn(input.lifecycle, 'state')) {
    const lifecycleValidation = validateSandboxLifecycleMetadata(input);
    findings.push(...lifecycleValidation.findings);
  }
  
  // Evidence markers check
  if (findings.filter(f => f.code === 'canonical_scope_violation' || f.code === 'forbidden_authority_claim').length === 0) {
    checkEvidenceMarkers(input, findings);
  }
  
  return buildResult(input, findings, options);
}

function buildResult(input, findings, options) {
  const decision = determineDecision(findings);
  const lifecycle = isPlainObject(input.lifecycle) ? input.lifecycle : {};
  
  return {
    schema_version: '1.0.0',
    evaluator: 'sandbox-lifecycle-eligibility-evaluator',
    mode: 'read_only_stdout',
    decision,
    eligible_for_human_consideration: decision === ELIGIBILITY_DECISIONS.ELIGIBLE_FOR_HUMAN_CONSIDERATION,
    blocked: decision !== ELIGIBILITY_DECISIONS.ELIGIBLE_FOR_HUMAN_CONSIDERATION,
    reason_codes: findings.map(f => f.code),
    findings,
    artifact_summary: {
      sandbox: input.sandbox === true,
      non_authoritative: input.non_authoritative === true,
      task_id: input.task_id || null,
      queue_entry_id: input.queue_entry_id || null,
      evidence_bundled: input.evidence_bundled === true
    },
    lifecycle_summary: {
      state: lifecycle.state || null,
      next_state: lifecycle.next_state || null,
      timestamp: lifecycle.timestamp || null
    },
    authority_flags: {
      queue_execution: false,
      worker_execution: false,
      task_execution: false,
      runtime_authority: false,
      evidence_mutation: false,
      review_mutation: false,
      validation_mutation: false,
      canonical_queue_admission: false,
      staging: false,
      commit: false,
      push: false,
      deploy: false,
      network: false
    },
    writes_performed: false,
    stdout_only: true,
    non_authoritative_statement: NON_AUTHORITATIVE_LIFECYCLE_STATEMENT,
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT
  };
}

export function parseEligibilityJson(value) {
  if (typeof value !== 'string') {
    throw new Error('Input must be a JSON string');
  }
  
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
}

export function isSafeRelativeEligibilityFile(path) {
  if (typeof path !== 'string') return false;
  
  // Reject absolute paths
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  
  // Reject traversal
  if (path.includes('..')) return false;
  
  // Require .json extension
  if (!path.endsWith('.json')) return false;
  
  // Reject canonical/protected paths
  const normalized = path.replace(/\\/g, '/');
  for (const protectedPath of CANONICAL_PROTECTED_PATHS) {
    if (normalized.includes(protectedPath)) return false;
  }
  
  return true;
}

export async function readEligibilityInputFile(path, options = {}) {
  if (!isSafeRelativeEligibilityFile(path)) {
    throw new Error(`Unsafe file path rejected: ${path}`);
  }
  
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(path, 'utf8');
  return parseEligibilityJson(content);
}
