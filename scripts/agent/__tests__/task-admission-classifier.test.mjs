import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  classifyTaskAdmission,
  isSafeRelativeTaskFile,
  readTaskMetadataFile,
} from '../lib/task-admission-classifier.mjs';

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
    never_allowed: {
      actions: [
        'push',
        'deploy',
        'secret_printing',
        'destructive_delete',
        'dependency_install',
        'environment_variable_modification',
      ],
    },
    approval_required: { actions: ['dependency_update', 'configuration_change', 'schema_change'] },
  },
};

function task(overrides = {}) {
  return {
    task_id: 'RALPH-T',
    title: 'Docs update',
    goal: 'Update documentation only',
    task_type: 'docs_only',
    allowed_files: ['docs/example.md'],
    forbidden_files: [],
    expected_outputs: ['stdout summary'],
    expected_changed_files: ['docs/example.md'],
    forbidden_actions: [],
    verification_category: 'docs_only',
    required_checks: ['git --no-pager diff --name-only'],
    evidence_requirements: ['status output'],
    requires_human_review: false,
    commit_policy: 'no_commit',
    push_policy: 'no_push',
    stop_conditions: ['validation failure'],
    risk_level: 'low',
    authority_references: ['ROADMAP.md', 'VERIFY.md'],
    ...overrides,
  };
}

function classify(overrides) {
  return classifyTaskAdmission(task(overrides), { protectedConfig: protectedFixture });
}

test('docs-only safe task classifies as SAFE_AUTONOMOUS', () => {
  const result = classify({});
  assert.equal(result.classification, 'SAFE_AUTONOMOUS');
  assert.equal(result.admission_allowed, true);
});

test('agent tooling task classifies as REVIEW_REQUIRED', () => {
  const result = classify({
    task_type: 'agent_tooling',
    allowed_files: ['scripts/agent/x.mjs'],
    expected_changed_files: ['scripts/agent/x.mjs'],
    verification_category: 'agent_tooling',
  });
  assert.equal(result.classification, 'REVIEW_REQUIRED');
  assert.equal(result.admission_allowed, false);
});

test('product-code task classifies as HUMAN_ONLY', () => {
  const result = classify({
    task_type: 'product_code',
    allowed_files: ['src/domain/x.ts'],
    expected_changed_files: ['src/domain/x.ts'],
    verification_category: 'product',
  });
  assert.equal(result.classification, 'HUMAN_ONLY');
});

test('.env or secret mutation classifies as FORBIDDEN', () => {
  assert.equal(
    classify({ allowed_files: ['.env'], expected_changed_files: ['.env'] }).classification,
    'FORBIDDEN',
  );
  assert.equal(
    classify({ allowed_files: ['secrets/api.txt'], expected_changed_files: ['secrets/api.txt'] })
      .classification,
    'FORBIDDEN',
  );
});

test('push/deploy/network/destructive shell action classifies as FORBIDDEN', () => {
  for (const action of ['push', 'deploy', 'network request', 'destructive_delete']) {
    assert.equal(classify({ forbidden_actions: [action] }).classification, 'FORBIDDEN');
  }
});

test('package/dependency change without explicit approval is not SAFE_AUTONOMOUS', () => {
  const result = classify({
    allowed_files: ['package.json'],
    expected_changed_files: ['package.json'],
  });
  assert.notEqual(result.classification, 'SAFE_AUTONOMOUS');
  assert.ok(result.reason_codes.includes('package_change_without_explicit_dependency_task'));
});

test('protected and approval-required pattern matching works', () => {
  const result = classify({
    allowed_files: ['.env', 'supabase/migrations/1.sql'],
    expected_changed_files: ['.env', 'supabase/migrations/1.sql'],
  });
  assert.equal(result.classification, 'FORBIDDEN');
  assert.equal(result.protected_matches[0].file, '.env');
  assert.equal(result.approval_required_matches[0].file, 'supabase/migrations/1.sql');
});

test('missing/ambiguous metadata fails closed', () => {
  const incomplete = task();
  delete incomplete.goal;
  incomplete.allowed_files = 'docs/example.md';
  const result = classifyTaskAdmission(incomplete, { protectedConfig: protectedFixture });
  assert.notEqual(result.classification, 'SAFE_AUTONOMOUS');
  assert.equal(result.admission_allowed, false);
  assert.ok(result.reason_codes.includes('missing_required_metadata'));
});

test('multiple verification categories choose strictest classification', () => {
  const result = classify({ verification_category: ['docs_only', 'product'] });
  assert.equal(result.verify_category, 'product');
  assert.equal(result.classification, 'HUMAN_ONLY');
});

test('diff/file-count thresholds escalate classification', () => {
  assert.equal(
    classify({ expected_changed_files: ['a.md', 'b.md', 'c.md', 'd.md'] }).classification,
    'REVIEW_REQUIRED',
  );
  assert.equal(classify({ expected_file_count: 11 }).classification, 'HUMAN_ONLY');
});

test('CLI rejects unsafe task-file paths when file input is used', () => {
  assert.equal(isSafeRelativeTaskFile('../task.json'), false);
  assert.equal(isSafeRelativeTaskFile('..\\task.json'), false);
  assert.equal(isSafeRelativeTaskFile('foo\\..\\task.json'), false);
  assert.equal(isSafeRelativeTaskFile('foo\\..\\..\\task.json'), false);
  assert.equal(isSafeRelativeTaskFile('C:/task.json'), false);
  assert.equal(isSafeRelativeTaskFile('/tmp/task.json'), false);
  const result = spawnSync(
    process.execPath,
    ['scripts/agent/task-admission-classifier.mjs', '--task-file', '../task.json'],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsafe task-file path/);
});

test('file input reads bounded relative JSON read-only', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-039b-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'task.json'), JSON.stringify(task()), 'utf8');
  const before = fs.readdirSync(root);
  const metadata = readTaskMetadataFile('task.json', { projectRoot: root });
  const after = fs.readdirSync(root);
  assert.equal(metadata.task_id, 'RALPH-T');
  assert.deepEqual(after, before);
});

test('classifier performs no queue/runtime/evidence/review/handoff/governance/product/package mutation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-039b-no-mutation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of [
    'tasks',
    'runs',
    'validation',
    'review',
    'handoffs',
    '.governance',
    'src',
    'supabase',
  ])
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{}', 'utf8');
  const before = fs.readdirSync(root, { recursive: true }).sort();
  const result = classifyTaskAdmission(task(), {
    protectedConfig: protectedFixture,
    projectRoot: root,
  });
  const after = fs.readdirSync(root, { recursive: true }).sort();
  assert.equal(result.non_authorization_statement.includes('read-only advisory'), true);
  assert.deepEqual(after, before);
});

test('malformed protected config fails closed', () => {
  const result = classifyTaskAdmission(task(), { protectedConfig: { bad: true } });
  assert.notEqual(result.classification, 'SAFE_AUTONOMOUS');
  assert.ok(result.reason_codes.includes('malformed_protected_config'));
});
