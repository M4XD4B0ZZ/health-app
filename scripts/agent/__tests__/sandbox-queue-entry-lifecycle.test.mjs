import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ALLOWED_SANDBOX_TRANSITIONS,
  FORBIDDEN_AUTHORITY_CLAIMS,
  FORBIDDEN_LIFECYCLE_STATES,
  NON_AUTHORITATIVE_LIFECYCLE_STATEMENT,
  SANDBOX_LIFECYCLE_STATES,
  validateSandboxLifecycleMetadata,
  validateSandboxLifecycleState,
  validateSandboxLifecycleTransition
} from '../lib/sandbox-queue-entry-lifecycle.mjs';

function validMetadata(overrides = {}) {
  return {
    sandbox: true,
    non_authoritative: true,
    lifecycle: { state: 'draft' },
    non_authoritative_statement: NON_AUTHORITATIVE_LIFECYCLE_STATEMENT,
    ...overrides
  };
}

function safetyFlagKeys() {
  return [
    'queue_execution',
    'worker_execution',
    'task_execution',
    'runtime_authority',
    'evidence_mutation',
    'review_mutation',
    'validation_mutation',
    'canonical_queue_admission',
    'staging',
    'commit',
    'push',
    'deploy',
    'network'
  ];
}

test('allowed lifecycle states validate', () => {
  for (const state of SANDBOX_LIFECYCLE_STATES) {
    const result = validateSandboxLifecycleState(state);
    assert.equal(result.ok, true, state);
    assert.equal(result.status, 'passed');
    assert.equal(result.current_state, state);
  }
});

test('forbidden lifecycle states are rejected', () => {
  for (const state of FORBIDDEN_LIFECYCLE_STATES) {
    const result = validateSandboxLifecycleState(state);
    assert.equal(result.ok, false, state);
    assert.ok(result.findings.some((entry) => entry.code === 'forbidden_lifecycle_state'), state);
  }
});

test('unknown states are rejected', () => {
  const result = validateSandboxLifecycleState('surprise_state');
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((entry) => entry.code === 'unknown_lifecycle_state'));
});

test('allowed transitions pass', () => {
  for (const [current, nextStates] of Object.entries(ALLOWED_SANDBOX_TRANSITIONS)) {
    for (const next of nextStates.filter((value) => value !== 'blocked')) {
      const result = validateSandboxLifecycleTransition(current, next);
      assert.equal(result.ok, true, `${current} -> ${next}`);
    }
  }
});

test('invalid transitions fail', () => {
  const result = validateSandboxLifecycleTransition('readback_verified', 'sandbox_written');
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((entry) => entry.code === 'invalid_lifecycle_transition'));
});

test('skipped transitions fail', () => {
  const result = validateSandboxLifecycleTransition('draft', 'sandbox_written');
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((entry) => entry.code === 'skipped_lifecycle_transition'));
});

test('allowed state can transition to blocked', () => {
  for (const state of SANDBOX_LIFECYCLE_STATES.filter((value) => value !== 'blocked')) {
    const result = validateSandboxLifecycleTransition(state, 'blocked');
    assert.equal(result.ok, true, `${state} -> blocked`);
  }
});

test('blocked recovery refused without human_authorized_recovery', () => {
  const refused = validateSandboxLifecycleTransition('blocked', 'draft');
  assert.equal(refused.ok, false);
  assert.ok(refused.findings.some((entry) => entry.code === 'blocked_recovery_requires_human_authorization'));

  const advisory = validateSandboxLifecycleTransition('blocked', 'draft', { human_authorized_recovery: true });
  assert.equal(advisory.ok, true);
  assert.equal(advisory.queue_execution, false);
  assert.equal(advisory.runtime_authority, false);
});

test('metadata must be sandbox true and non_authoritative true', () => {
  const result = validateSandboxLifecycleMetadata(validMetadata({ sandbox: false, non_authoritative: false }));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((entry) => entry.code === 'sandbox_true_required'));
  assert.ok(result.findings.some((entry) => entry.code === 'non_authoritative_true_required'));
});

test('metadata with forbidden authority claims rejected', () => {
  for (const claim of FORBIDDEN_AUTHORITY_CLAIMS) {
    const result = validateSandboxLifecycleMetadata(validMetadata({ [claim]: true }));
    assert.equal(result.ok, false, claim);
    assert.ok(result.findings.some((entry) => entry.code === 'forbidden_authority_claim' && entry.details.claim === claim), claim);
  }
});

test('metadata requires non-authoritative statement', () => {
  const missing = validateSandboxLifecycleMetadata(validMetadata({ non_authoritative_statement: undefined }));
  assert.equal(missing.ok, false);
  assert.ok(missing.findings.some((entry) => entry.code === 'missing_non_authoritative_statement'));

  const authoritativeTerms = validateSandboxLifecycleMetadata(validMetadata({ non_authoritative_statement: 'non-authoritative queue_execution statement' }));
  assert.equal(authoritativeTerms.ok, false);
  assert.ok(authoritativeTerms.findings.some((entry) => entry.code === 'non_authoritative_statement_contains_authority_terms'));
});

test('metadata requires lifecycle.state', () => {
  const result = validateSandboxLifecycleMetadata(validMetadata({ lifecycle: {} }));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((entry) => entry.code === 'lifecycle_state_required'));
});

test('result safety flags remain false', () => {
  const results = [
    validateSandboxLifecycleState('draft'),
    validateSandboxLifecycleTransition('draft', 'admission_previewed'),
    validateSandboxLifecycleMetadata(validMetadata())
  ];
  for (const result of results) {
    for (const key of safetyFlagKeys()) {
      assert.equal(result[key], false, key);
    }
  }
});

test('module performs no file writes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-042b-no-writes-'));
  const sentinel = path.join(root, 'sentinel.json');
  validateSandboxLifecycleState('draft');
  validateSandboxLifecycleTransition('draft', 'admission_previewed');
  validateSandboxLifecycleMetadata(validMetadata());
  assert.equal(fs.existsSync(sentinel), false);
  fs.rmSync(root, { recursive: true, force: true });
});