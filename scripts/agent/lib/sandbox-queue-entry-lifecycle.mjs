export const SANDBOX_LIFECYCLE_STATES = Object.freeze([
  'draft',
  'admission_previewed',
  'write_planned',
  'sandbox_written',
  'readback_verified',
  'evidence_bundled',
  'awaiting_human_review',
  'blocked',
]);

export const FORBIDDEN_LIFECYCLE_STATES = Object.freeze([
  'queued',
  'canonical_queued',
  'ready_to_execute',
  'executing',
  'worker_executing',
  'task_executing',
  'runtime_mutated',
  'evidence_mutated',
  'review_accepted',
  'validation_passed',
  'task_done',
  'commit_ready',
  'committed',
  'pushed',
  'deployed',
  'production_ready',
  'approved',
  'merged',
  'released',
]);

const LINEAR_SANDBOX_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['admission_previewed']),
  admission_previewed: Object.freeze(['write_planned']),
  write_planned: Object.freeze(['sandbox_written']),
  sandbox_written: Object.freeze(['readback_verified']),
  readback_verified: Object.freeze(['evidence_bundled']),
  evidence_bundled: Object.freeze(['awaiting_human_review']),
  awaiting_human_review: Object.freeze([]),
  blocked: Object.freeze([]),
});

export const ALLOWED_SANDBOX_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['admission_previewed', 'blocked']),
  admission_previewed: Object.freeze(['write_planned', 'blocked']),
  write_planned: Object.freeze(['sandbox_written', 'blocked']),
  sandbox_written: Object.freeze(['readback_verified', 'blocked']),
  readback_verified: Object.freeze(['evidence_bundled', 'blocked']),
  evidence_bundled: Object.freeze(['awaiting_human_review', 'blocked']),
  awaiting_human_review: Object.freeze(['blocked']),
  blocked: Object.freeze([]),
});

export const NON_AUTHORITATIVE_LIFECYCLE_STATEMENT =
  'This sandbox lifecycle probe is non-authoritative advisory metadata only.';

export const FORBIDDEN_AUTHORITY_CLAIMS = Object.freeze([
  'queue_execution',
  'worker_execution',
  'task_execution',
  'runtime_authority',
  'evidence_mutation',
  'review_acceptance',
  'validation_pass',
  'task_completion',
  'staging',
  'commit',
  'push',
  'deploy',
  'dependency_install',
  'network',
  'product_work',
  'canonical_queue_admission',
]);

const SANDBOX_STATE_SET = new Set(SANDBOX_LIFECYCLE_STATES);
const FORBIDDEN_STATE_SET = new Set(FORBIDDEN_LIFECYCLE_STATES);
const FORBIDDEN_AUTHORITY_SET = new Set(FORBIDDEN_AUTHORITY_CLAIMS);
const LINEAR_STATE_INDEX = new Map(SANDBOX_LIFECYCLE_STATES.map((state, index) => [state, index]));
const STATEMENT_FORBIDDEN_TERMS =
  /\b(queue_execution|worker_execution|task_execution|runtime_authority|evidence_mutation|review_acceptance|validation_pass|task_completion|staging|commit|push|deploy|dependency_install|network|product_work|canonical_queue_admission|queued|executing|committed|pushed|deployed|approved|merged|released)\b/i;

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(Object(object), key);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stateValue(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function baseResult({
  findings = [],
  currentState = null,
  nextState = null,
  sandbox = false,
  nonAuthoritative = false,
  statement = null,
} = {}) {
  return {
    ok: findings.length === 0,
    status: findings.length === 0 ? 'passed' : 'blocked',
    findings,
    current_state: currentState,
    next_state: nextState,
    allowed_next_states: allowedNextStates(currentState),
    sandbox,
    non_authoritative: nonAuthoritative,
    non_authoritative_statement: statement,
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
    network: false,
  };
}

export function allowedNextStates(currentState) {
  const normalized = stateValue(currentState);
  return Object.freeze([...(ALLOWED_SANDBOX_TRANSITIONS[normalized] || [])]);
}

export function validateSandboxLifecycleState(input) {
  const currentState = stateValue(input);
  const findings = [];

  if (FORBIDDEN_STATE_SET.has(currentState)) {
    findings.push(
      finding(
        'critical',
        'forbidden_lifecycle_state',
        'Forbidden lifecycle states are refused in sandbox lifecycle metadata',
        { state: currentState },
      ),
    );
  } else if (!SANDBOX_STATE_SET.has(currentState)) {
    findings.push(
      finding('critical', 'unknown_lifecycle_state', 'Unknown lifecycle states are refused', {
        state: currentState,
      }),
    );
  }

  return baseResult({
    findings,
    currentState,
    sandbox: true,
    nonAuthoritative: true,
    statement: NON_AUTHORITATIVE_LIFECYCLE_STATEMENT,
  });
}

export function validateSandboxLifecycleTransition(
  currentStateInput,
  nextStateInput,
  options = {},
) {
  const currentState = stateValue(currentStateInput);
  const nextState = stateValue(nextStateInput);
  const findings = [];
  const currentValidation = validateSandboxLifecycleState(currentState);
  const nextValidation = validateSandboxLifecycleState(nextState);

  findings.push(
    ...currentValidation.findings.map((entry) => ({
      ...entry,
      details: { ...entry.details, role: 'current_state' },
    })),
  );
  findings.push(
    ...nextValidation.findings.map((entry) => ({
      ...entry,
      details: { ...entry.details, role: 'next_state' },
    })),
  );

  if (findings.length === 0) {
    const directNext = ALLOWED_SANDBOX_TRANSITIONS[currentState] || [];
    if (currentState === 'blocked' && nextState === 'draft') {
      if (options.human_authorized_recovery === true) {
        // Advisory only: recovery is recognized as human-authorized metadata, not as an executed transition.
      } else {
        findings.push(
          finding(
            'critical',
            'blocked_recovery_requires_human_authorization',
            'blocked -> draft recovery is refused unless human_authorized_recovery is true',
            { current_state: currentState, next_state: nextState },
          ),
        );
      }
    } else if (!directNext.includes(nextState)) {
      const linearNext = LINEAR_SANDBOX_TRANSITIONS[currentState] || [];
      const currentIndex = LINEAR_STATE_INDEX.get(currentState);
      const nextIndex = LINEAR_STATE_INDEX.get(nextState);
      const skipped =
        !linearNext.includes(nextState) &&
        SANDBOX_STATE_SET.has(nextState) &&
        nextState !== 'blocked' &&
        nextIndex > currentIndex;
      findings.push(
        finding(
          'critical',
          skipped ? 'skipped_lifecycle_transition' : 'invalid_lifecycle_transition',
          'Lifecycle transition is not in the allowed sandbox transition table',
          {
            current_state: currentState,
            next_state: nextState,
            allowed_next_states: [...directNext],
          },
        ),
      );
    }
  }

  return baseResult({
    findings,
    currentState,
    nextState,
    sandbox: true,
    nonAuthoritative: true,
    statement: NON_AUTHORITATIVE_LIFECYCLE_STATEMENT,
  });
}

function collectForbiddenAuthorityClaims(metadata, findings) {
  for (const claim of FORBIDDEN_AUTHORITY_SET) {
    if (
      hasOwn(metadata, claim) &&
      metadata[claim] !== false &&
      metadata[claim] !== null &&
      metadata[claim] !== undefined
    ) {
      findings.push(
        finding(
          'critical',
          'forbidden_authority_claim',
          'Forbidden authority claims are refused in sandbox lifecycle metadata',
          { claim, value: metadata[claim] },
        ),
      );
    }
  }
}

function validateNonAuthoritativeStatement(statement, findings) {
  if (typeof statement !== 'string' || statement.trim() === '') {
    findings.push(
      finding(
        'critical',
        'missing_non_authoritative_statement',
        'Lifecycle metadata must include a non-authoritative statement',
      ),
    );
    return;
  }
  if (!statement.includes('non-authoritative')) {
    findings.push(
      finding(
        'critical',
        'non_authoritative_statement_missing_marker',
        'Lifecycle statement must contain the non-authoritative marker',
      ),
    );
  }
  if (STATEMENT_FORBIDDEN_TERMS.test(statement)) {
    findings.push(
      finding(
        'critical',
        'non_authoritative_statement_contains_authority_terms',
        'Lifecycle statement must not contain execution or authority terms',
        { statement },
      ),
    );
  }
}

export function validateSandboxLifecycleMetadata(metadataInput) {
  const metadata = isPlainObject(metadataInput) ? metadataInput : {};
  const lifecycle = isPlainObject(metadata.lifecycle) ? metadata.lifecycle : {};
  const currentState = stateValue(lifecycle.state);
  const nextState = stateValue(lifecycle.next_state);
  const statement = metadata.non_authoritative_statement;
  const findings = [];

  if (!isPlainObject(metadataInput)) {
    findings.push(
      finding('critical', 'metadata_not_object', 'Lifecycle metadata must be an object'),
    );
  }
  if (metadata.sandbox !== true) {
    findings.push(
      finding(
        'critical',
        'sandbox_true_required',
        'Lifecycle metadata must include sandbox: true',
        { sandbox: metadata.sandbox },
      ),
    );
  }
  if (metadata.non_authoritative !== true) {
    findings.push(
      finding(
        'critical',
        'non_authoritative_true_required',
        'Lifecycle metadata must include non_authoritative: true',
        { non_authoritative: metadata.non_authoritative },
      ),
    );
  }
  if (!hasOwn(metadata, 'lifecycle') || !isPlainObject(metadata.lifecycle)) {
    findings.push(
      finding(
        'critical',
        'lifecycle_object_required',
        'Lifecycle metadata must include a lifecycle object',
      ),
    );
  }
  if (!hasOwn(lifecycle, 'state')) {
    findings.push(
      finding(
        'critical',
        'lifecycle_state_required',
        'Lifecycle metadata must include lifecycle.state',
      ),
    );
  } else {
    findings.push(...validateSandboxLifecycleState(currentState).findings);
  }
  if (hasOwn(lifecycle, 'next_state')) {
    findings.push(
      ...validateSandboxLifecycleTransition(currentState, nextState, {
        human_authorized_recovery: metadata.human_authorized_recovery === true,
      }).findings,
    );
  }

  validateNonAuthoritativeStatement(statement, findings);
  collectForbiddenAuthorityClaims(metadata, findings);

  return baseResult({
    findings,
    currentState: currentState ?? null,
    nextState: nextState ?? null,
    sandbox: metadata.sandbox === true,
    nonAuthoritative: metadata.non_authoritative === true,
    statement: typeof statement === 'string' ? statement : null,
  });
}
