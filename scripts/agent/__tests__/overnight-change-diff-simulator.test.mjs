import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChangeDiffSimulation,
  classifyChangedFile,
  evaluateScope,
  evaluateThresholds,
  formatChangeDiffSimulationPretty,
  matchesPattern,
} from '../lib/overnight-change-diff-simulator.mjs';
import { parseArgs } from '../overnight-change-diff-simulator.mjs';

function changeSet(overrides = {}) {
  return {
    schema_version: '1.0.0',
    change_set_id: 'changeset_ralph_034l_fixture',
    source: {
      queue_id: 'queue_ralph_034l_fixture',
      task_id: 'RALPH-034L-FIXTURE',
      human_authored: true,
    },
    constraints: {
      allowed_files: ['scripts/agent/example.mjs', 'docs/**', 'reports/**'],
      forbidden_files: [
        '.env',
        '.env.*',
        'package.json',
        'package-lock.json',
        'src/**',
        'supabase/**',
      ],
      expected_outputs: ['scripts/agent/example.mjs'],
      max_files_changed: 2,
      max_diff_lines: 120,
    },
    changes: [
      {
        path: 'scripts/agent/example.mjs',
        change_type: 'modified',
        additions: 20,
        deletions: 5,
        binary: false,
        generated: false,
      },
    ],
    ...overrides,
  };
}

test('valid allowed file change produces would_pass', () => {
  const simulation = buildChangeDiffSimulation(changeSet());
  assert.equal(simulation.phase, 'RALPH-034L');
  assert.equal(simulation.mode, 'change_diff_monitoring_simulation_only');
  assert.equal(simulation.disposition, 'would_pass');
  assert.equal(simulation.file_evaluations[0].allowed_file_match, true);
});

test('file outside allowed_files produces would_block with scope_violation', () => {
  const simulation = buildChangeDiffSimulation(
    changeSet({
      changes: [
        { path: 'unexpected/file.mjs', change_type: 'modified', additions: 1, deletions: 0 },
      ],
    }),
  );
  assert.equal(simulation.disposition, 'would_block');
  assert.ok(simulation.reason_codes.includes('scope_violation'));
  assert.equal(simulation.scope_evaluation.scope_violation_detected, true);
});

test('forbidden file produces would_block', () => {
  const simulation = buildChangeDiffSimulation(
    changeSet({
      constraints: { ...changeSet().constraints, allowed_files: ['src/**'] },
      changes: [
        { path: 'src/domain/example.ts', change_type: 'modified', additions: 1, deletions: 0 },
      ],
    }),
  );
  assert.equal(simulation.disposition, 'would_block');
  assert.ok(simulation.reason_codes.includes('forbidden_file'));
});

test('protected file produces would_block', () => {
  const simulation = buildChangeDiffSimulation(
    changeSet({
      constraints: { ...changeSet().constraints, allowed_files: ['.env'] },
      changes: [{ path: '.env', change_type: 'modified', additions: 1, deletions: 0 }],
    }),
  );
  assert.equal(simulation.disposition, 'would_block');
  assert.ok(simulation.reason_codes.includes('protected_file'));
});

test('threshold exceeded produces would_block', () => {
  const simulation = buildChangeDiffSimulation(
    changeSet({
      changes: [
        {
          path: 'scripts/agent/example.mjs',
          change_type: 'modified',
          additions: 121,
          deletions: 0,
        },
      ],
    }),
  );
  assert.equal(simulation.disposition, 'would_block');
  assert.ok(simulation.reason_codes.includes('threshold_exceeded'));
  assert.equal(simulation.threshold_evaluation.diff_line_threshold_exceeded, true);
});

test('review trigger produces would_require_review', () => {
  const simulation = buildChangeDiffSimulation(
    changeSet({
      changes: [{ path: 'docs/example.md', change_type: 'deleted', additions: 0, deletions: 10 }],
    }),
  );
  assert.equal(simulation.disposition, 'would_require_review');
  assert.ok(simulation.reason_codes.includes('review_policy_trigger'));
  assert.equal(simulation.review_gate_simulation.manual_review_required, true);
});

test('invalid input produces would_block', () => {
  const simulation = buildChangeDiffSimulation({
    changes: [{ path: '../escape.md', change_type: 'modified' }],
  });
  assert.equal(simulation.disposition, 'would_block');
  assert.ok(simulation.reason_codes.includes('invalid_input'));
});

test('category classification flags documentation and dependency categories', () => {
  const doc = classifyChangedFile(
    { path: 'docs/readme.md', change_type: 'modified' },
    changeSet().constraints,
  );
  assert.equal(doc.validation_category, 'documentation-only');
  const dependency = classifyChangedFile(
    { path: 'package.json', change_type: 'modified' },
    { ...changeSet().constraints, allowed_files: ['package.json'] },
  );
  assert.equal(dependency.validation_category, 'dependency-change');
  assert.ok(dependency.reason_codes.includes('category_escalation'));
});

test('safety counters remain zero and safety summary is non-authoritative/non-mutating', () => {
  const simulation = buildChangeDiffSimulation(changeSet());
  assert.equal(simulation.execution_plan.queued_tasks_executed, 0);
  assert.equal(simulation.execution_plan.worker_invocations, 0);
  assert.equal(simulation.execution_plan.adapter_invocations, 0);
  assert.equal(simulation.execution_plan.provider_invocations, 0);
  assert.equal(simulation.execution_plan.model_invocations, 0);
  assert.equal(simulation.execution_plan.prompt_executions, 0);
  assert.equal(simulation.execution_plan.network_requests, 0);
  assert.equal(simulation.execution_plan.validation_commands_executed, 0);
  assert.equal(simulation.execution_plan.runtime_state_mutations, 0);
  assert.equal(simulation.execution_plan.evidence_mutations, 0);
  assert.equal(simulation.execution_plan.files_written, 0);
  assert.equal(simulation.safety_summary.planning_only, true);
  assert.equal(simulation.safety_summary.non_authoritative, true);
  assert.equal(simulation.safety_summary.non_mutating, true);
  assert.equal(simulation.safety_summary.non_authorizing_output, true);
});

test('CLI argument parser rejects execution and write flags', () => {
  for (const flag of [
    '--execute',
    '--worker',
    '--run-worker',
    '--invoke-worker',
    '--adapter',
    '--invoke-adapter',
    '--provider',
    '--model',
    '--execute-prompt',
    '--apply-diff',
    '--write-changes',
    '--validate',
    '--run-validation',
    '--write-report',
    '--write-run-log',
    '--output',
    '--commit',
    '--push',
    '--stage',
  ]) {
    assert.throws(() => parseArgs(['node', 'cli', 'change-set.json', flag]), /forbidden/, flag);
  }
});

test('pretty output contains non-authorization language', () => {
  const pretty = formatChangeDiffSimulationPretty(buildChangeDiffSimulation(changeSet()));
  assert.match(pretty, /planning-only change\/diff simulation/);
  assert.match(pretty, /no worker invocation/);
  assert.match(pretty, /no adapter invocation/);
  assert.match(pretty, /no validation commands/);
  assert.match(pretty, /does not authorize worker invocation/);
});

test('helper evaluations and pattern matching are deterministic', () => {
  assert.equal(matchesPattern('docs/a/b.md', 'docs/**'), true);
  assert.equal(matchesPattern('.env.local', '.env.*'), true);
  const fileEvaluations = [
    classifyChangedFile(
      { path: 'unexpected.md', change_type: 'modified' },
      changeSet().constraints,
    ),
  ];
  assert.equal(evaluateScope(fileEvaluations).scope_violation_detected, true);
  assert.equal(
    evaluateThresholds([{ additions: 2, deletions: 3 }], {
      max_files_changed: 1,
      max_diff_lines: 5,
    }).threshold_exceeded,
    false,
  );
});
