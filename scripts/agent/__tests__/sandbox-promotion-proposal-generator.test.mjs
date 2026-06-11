import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSandboxPromotionProposal,
  buildSandboxPromotionProposalFromArtifact,
  formatSandboxPromotionProposalMarkdown,
  isSafeRelativePromotionInputFile
} from '../lib/sandbox-promotion-proposal-generator.mjs';
import { parseArgs } from '../generate-sandbox-promotion-proposal.mjs';

function eligibleResult(overrides = {}) {
  return {
    schema_version: '1.0.0',
    evaluator: 'sandbox-lifecycle-eligibility-evaluator',
    mode: 'read_only_stdout',
    decision: 'eligible_for_human_consideration',
    eligible_for_human_consideration: true,
    blocked: false,
    reason_codes: [],
    findings: [],
    artifact_summary: { sandbox: true, non_authoritative: true, task_id: 'RALPH-041B', queue_entry_id: null, evidence_bundled: true },
    lifecycle_summary: { state: 'evidence_bundled', next_state: null, timestamp: '2026-06-10T00:00:00Z' },
    authority_flags: { queue_execution: false, worker_execution: false, task_execution: false, runtime_authority: false, evidence_mutation: false, review_mutation: false, validation_mutation: false, canonical_queue_admission: false, staging: false, commit: false, push: false, deploy: false, network: false },
    writes_performed: false,
    stdout_only: true,
    non_authorization_statement: 'This eligibility evaluation does not authorize queue execution.',
    ...overrides
  };
}

describe('sandbox-promotion-proposal-generator', () => {
  it('eligible input creates proposal', () => {
    const result = buildSandboxPromotionProposal(eligibleResult());
    assert.equal(result.proposal_created, true);
    assert.equal(result.proposal_id, 'proposal-ralph-041b');
    assert.equal(result.writes_performed, false);
    assert.equal(result.stdout_only, true);
  });

  it('blocked eligibility refuses proposal', () => {
    const result = buildSandboxPromotionProposal(eligibleResult({ decision: 'blocked_missing_evidence', eligible_for_human_consideration: false, blocked: true }));
    assert.equal(result.proposal_created, false);
    assert.ok(result.reason_codes.includes('eligibility_decision_not_eligible'));
  });

  it('missing or malformed input fails closed', () => {
    const result = buildSandboxPromotionProposal(null);
    assert.equal(result.proposal_created, false);
    assert.ok(result.reason_codes.includes('eligibility_input_not_object'));
  });

  it('upstream writes_performed true blocks proposal', () => {
    const result = buildSandboxPromotionProposal(eligibleResult({ writes_performed: true }));
    assert.equal(result.proposal_created, false);
    assert.ok(result.reason_codes.includes('upstream_writes_performed_not_false'));
  });

  it('upstream stdout_only false blocks proposal', () => {
    const result = buildSandboxPromotionProposal(eligibleResult({ stdout_only: false }));
    assert.equal(result.proposal_created, false);
    assert.ok(result.reason_codes.includes('upstream_stdout_only_not_true'));
  });

  it('any upstream authority flag true blocks proposal', () => {
    const source = eligibleResult({ authority_flags: { ...eligibleResult().authority_flags, worker_execution: true } });
    const result = buildSandboxPromotionProposal(source);
    assert.equal(result.proposal_created, false);
    assert.ok(result.reason_codes.includes('upstream_authority_flag_not_false'));
  });

  it('canonical/protected source or target path references block proposal', () => {
    const result = buildSandboxPromotionProposal(eligibleResult({ target_path: 'tasks/task-state.json' }));
    assert.equal(result.proposal_created, false);
    assert.ok(result.reason_codes.includes('canonical_or_protected_scope_reference'));
  });

  it('forbidden authority claims block proposal', () => {
    const result = buildSandboxPromotionProposal(eligibleResult({ queue_execution: true }));
    assert.equal(result.proposal_created, false);
    assert.ok(result.reason_codes.includes('forbidden_authority_claim'));
  });

  it('JSON output is deterministic', () => {
    const first = JSON.stringify(buildSandboxPromotionProposal(eligibleResult()), null, 2);
    const second = JSON.stringify(buildSandboxPromotionProposal(eligibleResult()), null, 2);
    assert.equal(first, second);
  });

  it('markdown output is deterministic', () => {
    const first = formatSandboxPromotionProposalMarkdown(buildSandboxPromotionProposal(eligibleResult()));
    const second = formatSandboxPromotionProposalMarkdown(buildSandboxPromotionProposal(eligibleResult()));
    assert.equal(first, second);
  });

  it('no file writes performed', () => {
    const result = buildSandboxPromotionProposal(eligibleResult());
    assert.equal(result.writes_performed, false);
    assert.equal(result.stdout_only, true);
    for (const value of Object.values(result.authority_flags)) assert.equal(value, false);
  });

  it('can evaluate safe artifact JSON through existing evaluator', () => {
    const result = buildSandboxPromotionProposalFromArtifact({ sandbox: true, non_authoritative: true, task_id: 'RALPH-041B', lifecycle: { state: 'evidence_bundled' }, evidence_bundled: true, non_authoritative_statement: 'This is non-authoritative advisory metadata only.' });
    assert.equal(result.proposal_created, true);
  });

  it('CLI parse helper rejects unsafe usage through parsed fields', () => {
    const args = parseArgs(['node', 'cli', '--eligibility-file', 'reports/source.json', '--format', 'json']);
    assert.equal(args.eligibilityFile, 'reports/source.json');
    assert.equal(isSafeRelativePromotionInputFile('tasks/task-state.json'), false);
  });
});