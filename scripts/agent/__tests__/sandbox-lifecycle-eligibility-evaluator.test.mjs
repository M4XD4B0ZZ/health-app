import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSandboxLifecycleEligibility,
  parseEligibilityJson,
  isSafeRelativeEligibilityFile,
  ELIGIBILITY_DECISIONS,
} from '../lib/sandbox-lifecycle-eligibility-evaluator.mjs';

describe('sandbox-lifecycle-eligibility-evaluator', () => {
  describe('evaluateSandboxLifecycleEligibility', () => {
    it('returns eligible_for_human_consideration for valid eligible artifact', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
          timestamp: '2026-06-10T11:00:00Z',
        },
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.ELIGIBLE_FOR_HUMAN_CONSIDERATION);
      assert.equal(result.eligible_for_human_consideration, true);
      assert.equal(result.blocked, false);
      assert.equal(result.findings.length, 0);
      assert.equal(result.writes_performed, false);
      assert.equal(result.stdout_only, true);
    });

    it('returns eligible_for_human_consideration for awaiting_human_review state', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        queue_entry_id: 'QE-001',
        lifecycle: {
          state: 'awaiting_human_review',
          timestamp: '2026-06-10T11:00:00Z',
        },
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.ELIGIBLE_FOR_HUMAN_CONSIDERATION);
      assert.equal(result.eligible_for_human_consideration, true);
      assert.equal(result.blocked, false);
    });

    it('returns blocked_missing_evidence when sandbox marker is missing', () => {
      const input = {
        sandbox: false,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.blocked, true);
      assert.ok(result.findings.some((f) => f.code === 'sandbox_marker_missing'));
    });

    it('returns blocked_missing_evidence when non_authoritative marker is missing', () => {
      const input = {
        sandbox: true,
        non_authoritative: false,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.blocked, true);
      assert.ok(result.findings.some((f) => f.code === 'non_authoritative_marker_missing'));
    });

    it('returns blocked_missing_evidence when lifecycle is missing', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.blocked, true);
      assert.ok(result.findings.some((f) => f.code === 'lifecycle_object_missing'));
    });

    it('returns blocked_missing_evidence when evidence markers are absent', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'draft',
          timestamp: '2026-06-10T11:00:00Z',
        },
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_MISSING_EVIDENCE);
      assert.equal(result.blocked, true);
      assert.ok(result.findings.some((f) => f.code === 'missing_evidence_marker'));
    });

    it('returns blocked_forbidden_claim when forbidden authority claim is present', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        queue_execution: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_FORBIDDEN_CLAIM);
      assert.equal(result.blocked, true);
      assert.ok(
        result.findings.some(
          (f) => f.code === 'forbidden_authority_claim' && f.details.claim === 'queue_execution',
        ),
      );
    });

    it('returns blocked_invalid_lifecycle for forbidden lifecycle state', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'queued',
          timestamp: '2026-06-10T11:00:00Z',
        },
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_INVALID_LIFECYCLE);
      assert.equal(result.blocked, true);
      assert.ok(result.findings.some((f) => f.code === 'forbidden_lifecycle_state'));
    });

    it('returns blocked_invalid_lifecycle for invalid lifecycle transition', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'draft',
          next_state: 'evidence_bundled',
          timestamp: '2026-06-10T11:00:00Z',
        },
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_INVALID_LIFECYCLE);
      assert.equal(result.blocked, true);
      assert.ok(result.findings.some((f) => f.code === 'skipped_lifecycle_transition'));
    });

    it('returns blocked_canonical_scope for tasks/ reference', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        artifact_path: 'tasks/task-state.json',
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_CANONICAL_SCOPE);
      assert.equal(result.blocked, true);
      assert.ok(
        result.findings.some(
          (f) => f.code === 'canonical_scope_violation' && f.details.protected_path === 'tasks/',
        ),
      );
    });

    it('returns blocked_canonical_scope for runs/ reference', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        target_path: 'runs/current-run.json',
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_CANONICAL_SCOPE);
      assert.ok(
        result.findings.some(
          (f) => f.code === 'canonical_scope_violation' && f.details.protected_path === 'runs/',
        ),
      );
    });

    it('returns blocked_canonical_scope for validation/ reference', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        evidence_path: 'validation/validation-results.jsonl',
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_CANONICAL_SCOPE);
      assert.ok(
        result.findings.some(
          (f) =>
            f.code === 'canonical_scope_violation' && f.details.protected_path === 'validation/',
        ),
      );
    });

    it('returns blocked_canonical_scope for src/ reference', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        allowed_files: ['src/domain/model.ts'],
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_CANONICAL_SCOPE);
      assert.ok(
        result.findings.some(
          (f) => f.code === 'canonical_scope_violation' && f.details.protected_path === 'src/',
        ),
      );
    });

    it('returns blocked_canonical_scope for package.json reference', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        expected_changed_files: ['package.json'],
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_CANONICAL_SCOPE);
      assert.ok(
        result.findings.some(
          (f) =>
            f.code === 'canonical_scope_violation' && f.details.protected_path === 'package.json',
        ),
      );
    });

    it('prioritizes canonical_scope over forbidden_claim', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        artifact_path: 'tasks/task-state.json',
        queue_execution: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.decision, ELIGIBILITY_DECISIONS.BLOCKED_CANONICAL_SCOPE);
      assert.ok(result.findings.some((f) => f.code === 'canonical_scope_violation'));
      assert.ok(result.findings.some((f) => f.code === 'forbidden_authority_claim'));
    });

    it('ensures all authority flags are false', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.authority_flags.queue_execution, false);
      assert.equal(result.authority_flags.worker_execution, false);
      assert.equal(result.authority_flags.task_execution, false);
      assert.equal(result.authority_flags.runtime_authority, false);
      assert.equal(result.authority_flags.evidence_mutation, false);
      assert.equal(result.authority_flags.review_mutation, false);
      assert.equal(result.authority_flags.validation_mutation, false);
      assert.equal(result.authority_flags.canonical_queue_admission, false);
      assert.equal(result.authority_flags.staging, false);
      assert.equal(result.authority_flags.commit, false);
      assert.equal(result.authority_flags.push, false);
      assert.equal(result.authority_flags.deploy, false);
      assert.equal(result.authority_flags.network, false);
    });

    it('includes non-authoritative and non-authorization statements', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.ok(result.non_authoritative_statement);
      assert.ok(result.non_authoritative_statement.includes('non-authoritative'));
      assert.ok(result.non_authorization_statement);
      assert.ok(result.non_authorization_statement.includes('does not authorize'));
    });
  });

  describe('parseEligibilityJson', () => {
    it('parses valid JSON string', () => {
      const json = '{"sandbox": true, "task_id": "RALPH-043B"}';
      const result = parseEligibilityJson(json);

      assert.equal(result.sandbox, true);
      assert.equal(result.task_id, 'RALPH-043B');
    });

    it('throws on invalid JSON', () => {
      assert.throws(() => {
        parseEligibilityJson('not valid json');
      }, /Failed to parse JSON/);
    });

    it('throws on non-string input', () => {
      assert.throws(() => {
        parseEligibilityJson({ sandbox: true });
      }, /Input must be a JSON string/);
    });
  });

  describe('isSafeRelativeEligibilityFile', () => {
    it('accepts safe relative .json file', () => {
      assert.equal(isSafeRelativeEligibilityFile('sandbox/test.json'), true);
      assert.equal(isSafeRelativeEligibilityFile('reports/artifact.json'), true);
    });

    it('rejects absolute paths', () => {
      assert.equal(isSafeRelativeEligibilityFile('/absolute/path.json'), false);
      assert.equal(isSafeRelativeEligibilityFile('C:/absolute/path.json'), false);
    });

    it('rejects traversal paths', () => {
      assert.equal(isSafeRelativeEligibilityFile('../parent/file.json'), false);
      assert.equal(isSafeRelativeEligibilityFile('dir/../file.json'), false);
    });

    it('rejects non-json files', () => {
      assert.equal(isSafeRelativeEligibilityFile('file.txt'), false);
      assert.equal(isSafeRelativeEligibilityFile('file.js'), false);
    });

    it('rejects canonical/protected paths', () => {
      assert.equal(isSafeRelativeEligibilityFile('tasks/task-state.json'), false);
      assert.equal(isSafeRelativeEligibilityFile('runs/current-run.json'), false);
      assert.equal(isSafeRelativeEligibilityFile('validation/results.json'), false);
      assert.equal(isSafeRelativeEligibilityFile('src/domain/model.json'), false);
    });

    it('rejects non-string input', () => {
      assert.equal(isSafeRelativeEligibilityFile(null), false);
      assert.equal(isSafeRelativeEligibilityFile(undefined), false);
      assert.equal(isSafeRelativeEligibilityFile(123), false);
    });
  });

  describe('no file writes performed', () => {
    it('evaluator performs no file writes', () => {
      const input = {
        sandbox: true,
        non_authoritative: true,
        task_id: 'RALPH-043B',
        lifecycle: {
          state: 'evidence_bundled',
        },
        evidence_bundled: true,
        non_authoritative_statement: 'This is non-authoritative advisory metadata only.',
      };

      const result = evaluateSandboxLifecycleEligibility(input);

      assert.equal(result.writes_performed, false);
      assert.equal(result.stdout_only, true);
    });
  });
});
