import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { validateQueueAdmission } from '../lib/queue-admission-validator.mjs';

const protectedFixture = {
  protected_patterns: {
    absolute_protection: { patterns: ['.env', '.env.*', 'secrets/**'] },
    conditional_protection: {
      patterns: [
        { pattern: 'package.json', condition: 'dependency_task', approval_required: true },
      ],
    },
  },
  approval_required_patterns: { patterns: ['package.json', 'supabase/migrations/**', 'app.json'] },
  forbidden_actions: {
    never_allowed: { actions: ['push', 'deploy', 'dependency_install'] },
    approval_required: { actions: ['dependency_update', 'configuration_change'] },
  },
};

function metadata(overrides = {}) {
  return {
    queue_entry_id: 'queue-RALPH-040B',
    task_id: 'RALPH-040B',
    classification: 'SAFE_AUTONOMOUS',
    admission_decision: 'admissible',
    allowed_files: ['docs/example.md'],
    expected_changed_files: ['docs/example.md'],
    required_checks: ['git --no-pager status --short'],
    evidence_requirements: ['git status evidence'],
    review_requirement: false,
    commit_policy: 'no_commit',
    push_policy: 'no_push',
    stop_conditions: ['validation failure'],
    non_authoritative_statement:
      'This queue-entry preview is non-authoritative and does not authorize execution or mutation.',
    dirty_tree: false,
    staged_files: [],
    existing_queue_entry_ids: [],
    approval_required_resolved: false,
    ...overrides,
  };
}

function validate(overrides = {}) {
  return validateQueueAdmission(metadata(overrides), { protectedConfig: protectedFixture });
}

test('SAFE_AUTONOMOUS maps to admissible', () => {
  const result = validate();
  assert.equal(result.admission_decision, 'admissible');
  assert.equal(result.admission_allowed, true);
});

test('REVIEW_REQUIRED maps to requires_review_before_queue', () => {
  const result = validate({
    classification: 'REVIEW_REQUIRED',
    admission_decision: 'requires_review_before_queue',
    review_requirement: true,
  });
  assert.equal(result.admission_decision, 'requires_review_before_queue');
  assert.equal(result.admission_allowed, false);
});

test('HUMAN_ONLY maps to human_only', () => {
  const result = validate({
    classification: 'HUMAN_ONLY',
    admission_decision: 'human_only',
    review_requirement: true,
  });
  assert.equal(result.admission_decision, 'human_only');
  assert.equal(result.admission_allowed, false);
});

test('FORBIDDEN maps to rejected', () => {
  const result = validate({
    classification: 'FORBIDDEN',
    admission_decision: 'rejected',
    review_requirement: true,
  });
  assert.equal(result.admission_decision, 'rejected');
  assert.equal(result.admission_allowed, false);
});

test('missing metadata is rejected', () => {
  const incomplete = metadata();
  delete incomplete.required_checks;
  const result = validateQueueAdmission(incomplete, { protectedConfig: protectedFixture });
  assert.equal(result.admission_decision, 'rejected');
  assert.ok(result.reason_codes.includes('missing_queue_metadata'));
});

test('protected file is rejected', () => {
  const result = validate({ allowed_files: ['.env'], expected_changed_files: ['.env'] });
  assert.equal(result.admission_decision, 'rejected');
  assert.ok(result.reason_codes.includes('protected_file_match_blocks_queue_admission'));
});

test('approval-required unresolved match is blocked', () => {
  const result = validate({
    allowed_files: ['package.json'],
    expected_changed_files: ['package.json'],
  });
  assert.equal(result.admission_decision, 'requires_review_before_queue');
  assert.equal(result.admission_allowed, false);
  assert.ok(result.reason_codes.includes('approval_required_unresolved_blocks_queue_admission'));
});

test('dirty-tree signal is blocked', () => {
  const result = validate({ dirty_tree: true });
  assert.equal(result.admission_decision, 'rejected');
  assert.ok(result.reason_codes.includes('dirty_tree_blocks_queue_admission'));
});

test('staged-file signal is blocked', () => {
  const result = validate({ staged_files: ['docs/example.md'] });
  assert.equal(result.admission_decision, 'rejected');
  assert.ok(result.reason_codes.includes('staged_files_block_queue_admission'));
});

test('queue-entry collision is blocked', () => {
  const result = validate({ existing_queue_entry_ids: ['queue-RALPH-040B'] });
  assert.equal(result.admission_decision, 'rejected');
  assert.ok(result.reason_codes.includes('queue_entry_collision_blocks_queue_admission'));
});

test('preview generation is deterministic', () => {
  const first = validate({ queue_entry_id: undefined });
  const second = validate({ queue_entry_id: undefined });
  assert.deepEqual(first.queue_entry_preview, second.queue_entry_preview);
  assert.equal(first.queue_entry_preview.queue_entry_id, 'preview-ralph-040b');
});

test('non-authoritative statement is preserved', () => {
  const statement = 'Custom non-authoritative statement for human review only.';
  const result = validate({ non_authoritative_statement: statement });
  assert.equal(result.queue_entry_preview.non_authoritative_statement, statement);
  assert.equal(result.non_authoritative_statement, statement);
});

test('CLI rejects unsafe metadata-file paths', () => {
  for (const unsafePath of [
    '../metadata.json',
    '..\\metadata.json',
    'foo\\..\\metadata.json',
    'C:/metadata.json',
    '/tmp/metadata.json',
  ]) {
    const result = spawnSync(
      process.execPath,
      ['scripts/agent/queue-admission-validator.mjs', '--metadata-file', unsafePath],
      { encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0, unsafePath);
    assert.match(result.stderr, /Unsafe metadata-file path/, unsafePath);
  }
});
