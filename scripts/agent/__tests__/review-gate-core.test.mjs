import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNormalizedReviewDecision, SCHEMA_VERSION } from '../lib/review-gate-core.mjs';

function canonicalHandoff(overrides = {}) {
  const base = {
    schema_version: SCHEMA_VERSION,
    handoff_id: 'handoff_ralph-012_fixture',
    timestamp: '2026-05-23T11:55:00Z',
    task: {
      task_id: 'RALPH-012',
      status: 'done',
      title: 'Fixture review-gate core tests',
      run_id: 'run_ralph-012_fixture',
    },
    validation: {
      status: 'passed',
      validation_id: 'validation_ralph-012_fixture',
      summary: 'Fixture validation passed.',
    },
    review: {
      status: 'accepted',
      review_id: 'review_ralph-012_fixture',
      summary: 'Fixture review accepted.',
    },
    changes: {
      files_changed: ['scripts/agent/lib/review-gate-core.mjs'],
      artifacts_created: [],
    },
    issues: {
      critical: [],
      warnings: [],
    },
    recommended_next_task: 'Human review of fixture coverage.',
    human_review_required: true,
  };

  return {
    ...base,
    ...overrides,
    task: { ...base.task, ...(overrides.task || {}) },
    validation: { ...base.validation, ...(overrides.validation || {}) },
    review: { ...base.review, ...(overrides.review || {}) },
    changes: { ...base.changes, ...(overrides.changes || {}) },
    issues: { ...base.issues, ...(overrides.issues || {}) },
  };
}

test('accepted handoff returns accepted without blockers or warnings', () => {
  const decision = buildNormalizedReviewDecision(canonicalHandoff());

  assert.equal(decision.review_result, 'accepted');
  assert.equal(decision.blocking_findings.length, 0);
  assert.equal(decision.warnings.length, 0);
});

test('needs_changes handoff returns warnings without blockers', () => {
  const decision = buildNormalizedReviewDecision(
    canonicalHandoff({
      issues: {
        warnings: ['Non-blocking fixture warning.'],
      },
    }),
  );

  assert.equal(decision.review_result, 'needs_changes');
  assert.ok(decision.warnings.length > 0);
  assert.equal(decision.blocking_findings.length, 0);
});

test('rejected handoff returns blockers for validation failure', () => {
  const decision = buildNormalizedReviewDecision(
    canonicalHandoff({
      validation: {
        status: 'failed',
        summary: 'Fixture validation failed.',
      },
    }),
  );

  assert.equal(decision.review_result, 'rejected');
  assert.ok(decision.blocking_findings.length > 0);
});

test('malformed handoff missing task_id is rejected with schema finding', () => {
  const malformed = canonicalHandoff();
  delete malformed.task.task_id;

  const decision = buildNormalizedReviewDecision(malformed);

  assert.notEqual(decision.review_result, 'accepted');
  assert.equal(decision.review_result, 'rejected');
  assert.ok(decision.blocking_findings.some((finding) => finding.code === 'missing_task_id'));
});

test('unsupported schema_version is rejected with schema finding', () => {
  const decision = buildNormalizedReviewDecision(
    canonicalHandoff({
      schema_version: '999.0.0',
    }),
  );

  assert.notEqual(decision.review_result, 'accepted');
  assert.equal(decision.review_result, 'rejected');
  assert.ok(
    decision.blocking_findings.some((finding) => finding.code === 'unsupported_schema_version'),
  );
});
