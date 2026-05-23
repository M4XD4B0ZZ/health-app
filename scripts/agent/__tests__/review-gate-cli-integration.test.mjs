import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

const SCHEMA_VERSION = '2.0.0';
const ENGINE_SCRIPT = 'scripts/agent/review-gate-engine.mjs';
const WORKFLOW_SCRIPT = 'scripts/agent/run-review-gate-workflow.mjs';
const REVIEW_RESULTS_PATH = path.join(projectRoot, 'review/review-results.jsonl');

function canonicalHandoff(overrides = {}) {
  const base = {
    schema_version: SCHEMA_VERSION,
    handoff_id: 'handoff_ralph-013_fixture',
    timestamp: '2026-05-23T12:30:00Z',
    task: {
      task_id: 'RALPH-013',
      status: 'done',
      title: 'Coordinator review-gate integration tests',
      run_id: 'run_ralph-013_fixture'
    },
    validation: {
      status: 'passed',
      validation_id: 'validation_ralph-013_fixture',
      summary: 'Fixture validation passed.'
    },
    review: {
      status: 'accepted',
      review_id: 'review_ralph-013_fixture',
      summary: 'Fixture review accepted.'
    },
    changes: {
      files_changed: ['scripts/agent/__tests__/review-gate-cli-integration.test.mjs'],
      artifacts_created: []
    },
    issues: {
      critical: [],
      warnings: []
    },
    recommended_next_task: 'Human review of coordinator review-gate integration coverage.',
    human_review_required: true
  };

  return {
    ...base,
    ...overrides,
    task: { ...base.task, ...(overrides.task || {}) },
    validation: { ...base.validation, ...(overrides.validation || {}) },
    review: { ...base.review, ...(overrides.review || {}) },
    changes: { ...base.changes, ...(overrides.changes || {}) },
    issues: { ...base.issues, ...(overrides.issues || {}) }
  };
}

function tempRoot(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-013-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeHandoff(directory, filename, handoff) {
  const filePath = path.join(directory, filename);
  fs.writeFileSync(filePath, `${JSON.stringify(handoff, null, 2)}\n`, 'utf8');
  return filePath;
}

function runCli(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
}

function parseJsonStdout(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function readReviewResults() {
  return fs.readFileSync(REVIEW_RESULTS_PATH, 'utf8');
}

test('review-gate-engine returns accepted decision for accepted handoff in dry-run JSON mode', (t) => {
  const root = tempRoot(t);
  const handoffPath = writeHandoff(root, 'accepted-handoff.json', canonicalHandoff());

  const result = runCli(ENGINE_SCRIPT, ['--input', handoffPath, '--dry-run', '--json']);
  const decision = parseJsonStdout(result);

  assert.equal(decision.schema_version, SCHEMA_VERSION);
  assert.equal(decision.task_id, 'RALPH-013');
  assert.equal(decision.review_result, 'accepted');
  assert.equal(decision.source.engine, 'ralph-v2-review-gate-engine');
  assert.equal(decision.source.handoff_id, 'handoff_ralph-013_fixture');
  assert.deepEqual(decision.blocking_findings, []);
  assert.deepEqual(decision.warnings, []);
});

test('review-gate-engine returns rejected decision with missing_task_id blocker for malformed handoff', (t) => {
  const root = tempRoot(t);
  const malformed = canonicalHandoff();
  delete malformed.task.task_id;
  const handoffPath = writeHandoff(root, 'missing-task-id-handoff.json', malformed);

  const result = runCli(ENGINE_SCRIPT, ['--input', handoffPath, '--dry-run', '--json']);
  const decision = parseJsonStdout(result);

  assert.equal(decision.schema_version, SCHEMA_VERSION);
  assert.equal(decision.task_id, 'unknown');
  assert.equal(decision.review_result, 'rejected');
  assert.ok(decision.blocking_findings.some((finding) => finding.code === 'missing_task_id'));
});

test('run-review-gate-workflow writes only temp decision and prepared evidence for accepted dry-run', (t) => {
  const reviewResultsBefore = readReviewResults();
  const root = tempRoot(t);
  const outputDir = path.join(root, 'out');
  const handoffPath = writeHandoff(root, 'accepted-handoff.json', canonicalHandoff());

  const result = runCli(WORKFLOW_SCRIPT, ['--handoff', handoffPath, '--output-dir', outputDir, '--dry-run', '--json']);
  const summary = parseJsonStdout(result);
  const decisionPath = path.join(outputDir, 'review-decision.json');
  const preparedEvidencePath = path.join(outputDir, 'prepared-review-evidence.json');
  const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
  const preparedEvidence = JSON.parse(fs.readFileSync(preparedEvidencePath, 'utf8'));

  assert.equal(summary.schema_version, SCHEMA_VERSION);
  assert.equal(summary.workflow, 'ralph-v2-review-gate-workflow');
  assert.equal(summary.dry_run, true);
  assert.equal(summary.review_result, 'accepted');
  assert.equal(summary.append_performed, false);
  assert.equal(summary.decision_path, decisionPath.replace(/\\/g, '/'));
  assert.equal(summary.prepared_review_evidence_path, preparedEvidencePath.replace(/\\/g, '/'));

  assert.equal(decision.review_result, 'accepted');
  assert.equal(decision.source.engine, 'ralph-v2-review-gate-engine');
  assert.equal(decision.source.workflow, 'ralph-v2-review-gate-workflow');
  assert.equal(preparedEvidence.task_id, 'RALPH-013');
  assert.equal(preparedEvidence.review_result, 'accepted');
  assert.equal(preparedEvidence.reviewer, 'ralph-v2-review-gate-workflow');
  assert.equal(readReviewResults(), reviewResultsBefore);
});

test('run-review-gate-workflow writes decision but no prepared evidence for needs_changes handoff', (t) => {
  const reviewResultsBefore = readReviewResults();
  const root = tempRoot(t);
  const outputDir = path.join(root, 'out');
  const handoffPath = writeHandoff(root, 'needs-changes-handoff.json', canonicalHandoff({
    issues: {
      warnings: ['Fixture warning requiring review attention.']
    }
  }));

  const result = runCli(WORKFLOW_SCRIPT, ['--handoff', handoffPath, '--output-dir', outputDir, '--dry-run', '--json']);
  const summary = parseJsonStdout(result);
  const decisionPath = path.join(outputDir, 'review-decision.json');
  const preparedEvidencePath = path.join(outputDir, 'prepared-review-evidence.json');
  const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

  assert.equal(summary.review_result, 'needs_changes');
  assert.equal(summary.append_performed, false);
  assert.equal(summary.prepared_review_evidence_path, null);
  assert.equal(decision.review_result, 'needs_changes');
  assert.ok(decision.warnings.some((finding) => finding.code === 'handoff_warning'));
  assert.equal(fs.existsSync(preparedEvidencePath), false);
  assert.equal(readReviewResults(), reviewResultsBefore);
});

test('run-review-gate-workflow refuses append for rejected handoff and does not append real review evidence', (t) => {
  const reviewResultsBefore = readReviewResults();
  const root = tempRoot(t);
  const outputDir = path.join(root, 'out');
  const handoffPath = writeHandoff(root, 'rejected-handoff.json', canonicalHandoff({
    validation: {
      status: 'failed',
      summary: 'Fixture validation failed.'
    }
  }));

  const result = runCli(WORKFLOW_SCRIPT, ['--handoff', handoffPath, '--output-dir', outputDir, '--append', '--confirm-append', '--json']);
  const decisionPath = path.join(outputDir, 'review-decision.json');
  const preparedEvidencePath = path.join(outputDir, 'prepared-review-evidence.json');
  const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Refusing append for rejected decision\. Only accepted decisions may be appended\./);
  assert.equal(decision.review_result, 'rejected');
  assert.ok(decision.blocking_findings.some((finding) => finding.code === 'validation_failed'));
  assert.equal(fs.existsSync(preparedEvidencePath), false);
  assert.equal(readReviewResults(), reviewResultsBefore);
});

test('run-review-gate-workflow append without confirm fails before writing output files', (t) => {
  const reviewResultsBefore = readReviewResults();
  const root = tempRoot(t);
  const outputDir = path.join(root, 'out');
  const handoffPath = writeHandoff(root, 'accepted-handoff.json', canonicalHandoff());

  const result = runCli(WORKFLOW_SCRIPT, ['--handoff', handoffPath, '--output-dir', outputDir, '--append', '--json']);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--append requires --confirm-append for real review evidence append/);
  assert.equal(fs.existsSync(path.join(outputDir, 'review-decision.json')), false);
  assert.equal(fs.existsSync(path.join(outputDir, 'prepared-review-evidence.json')), false);
  assert.equal(readReviewResults(), reviewResultsBefore);
});