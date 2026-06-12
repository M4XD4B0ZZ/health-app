import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseArgs } from '../generate-canonical-promotion-proposal-probe.mjs';
import {
  EXPECTED_ARTIFACT,
  EXPECTED_HASH,
  TARGET_PATH,
  isSafeRelativeProposalInputFile,
  runSandboxPromotionProposalWriterProbe,
  validateFixedTarget,
  validatePromotionProposalInput
} from '../lib/sandbox-promotion-proposal-writer-probe.mjs';

function validProposal(overrides = {}) {
  return {
    schema_version: '1.0.0',
    generator: 'sandbox-promotion-proposal-generator',
    mode: 'read_only_stdout',
    proposal_id: 'proposal-ralph-041b',
    proposal_created: true,
    promotion_proposal_type: 'sandbox_to_future_canonical_promotion_advisory',
    source_summary: { task_id: 'RALPH-041B', queue_entry_id: null, sandbox: true, non_authoritative: true },
    source_eligibility_decision: 'eligible_for_human_consideration',
    authority_flags: {
      canonical_write: false,
      canonical_promotion_authorized: false,
      canonical_queue_admission: false,
      queue_execution: false,
      worker_execution: false,
      task_execution: false,
      lifecycle_execution: false,
      runtime_authority: false,
      runtime_write: false,
      evidence_mutation: false,
      review_mutation: false,
      validation_mutation: false,
      review_acceptance: false,
      validation_authority: false,
      validation_pass: false,
      task_completion: false,
      commit_readiness: false,
      staging: false,
      commit: false,
      push: false,
      deploy: false,
      dependency_install: false,
      network: false,
      product_work: false
    },
    writes_performed: false,
    stdout_only: true,
    ...overrides
  };
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-044b-'));
}

describe('sandbox-promotion-proposal-writer-probe', () => {
  it('dry-run is default and writes no files', async () => {
    const projectRoot = tempRoot();
    const result = await runSandboxPromotionProposalWriterProbe({ projectRoot, proposal: validProposal() });
    assert.equal(result.status, 'dry_run_ready');
    assert.equal(result.dry_run, true);
    assert.equal(result.writes_performed, false);
    assert.equal(fs.existsSync(path.join(projectRoot, ...TARGET_PATH.split('/'))), false);
  });

  it('explicit write creates exactly the fixed artifact in an isolated project root', async () => {
    const projectRoot = tempRoot();
    const result = await runSandboxPromotionProposalWriterProbe({ projectRoot, execute: true, proposal: validProposal() });
    assert.equal(result.status, 'passed');
    assert.equal(result.writes_performed, true);
    assert.deepEqual(result.files_written, [TARGET_PATH]);
    assert.equal(result.readback_valid, true);
    assert.equal(result.readback_hash, EXPECTED_HASH);
    assert.deepEqual(result.readback_payload, EXPECTED_ARTIFACT);
  });

  it('written artifact explicitly keeps all authority and execution flags false', async () => {
    const projectRoot = tempRoot();
    const result = await runSandboxPromotionProposalWriterProbe({ projectRoot, execute: true, proposal: validProposal() });
    assert.equal(result.readback_payload.non_authoritative, true);
    for (const key of ['canonical_promotion_authorized', 'canonical_queue_admission', 'queue_execution', 'worker_execution', 'task_execution', 'lifecycle_execution', 'runtime_authority', 'evidence_mutation', 'review_mutation', 'validation_mutation', 'task_completion', 'commit_readiness']) {
      assert.equal(result.readback_payload[key], false, key);
    }
  });

  it('refuses overwrite via create-only semantics', async () => {
    const projectRoot = tempRoot();
    const first = await runSandboxPromotionProposalWriterProbe({ projectRoot, execute: true, proposal: validProposal() });
    const second = await runSandboxPromotionProposalWriterProbe({ projectRoot, execute: true, proposal: validProposal() });
    assert.equal(first.status, 'passed');
    assert.equal(second.status, 'blocked');
    assert.ok(second.findings.some((entry) => entry.code === 'target_exists_refused'));
  });

  it('refuses arbitrary, absolute, drive-qualified, traversal, and protected target paths', () => {
    assert.ok(validateFixedTarget('reports/other.json').findings.some((entry) => entry.code === 'alternate_target_refused'));
    assert.ok(validateFixedTarget('/tmp/other.json').findings.some((entry) => entry.code === 'absolute_or_drive_path_refused'));
    assert.ok(validateFixedTarget('C:/tmp/other.json').findings.some((entry) => entry.code === 'absolute_or_drive_path_refused'));
    assert.ok(validateFixedTarget('../other.json').findings.some((entry) => entry.code === 'path_traversal_refused'));
    assert.ok(validateFixedTarget('tasks/task-state.json').findings.some((entry) => entry.code === 'protected_target_refused'));
  });

  it('refuses symlink escapes in target path components', async () => {
    const projectRoot = tempRoot();
    const outside = tempRoot();
    fs.mkdirSync(path.join(projectRoot, '.agent', 'overnight'), { recursive: true });
    fs.symlinkSync(outside, path.join(projectRoot, '.agent', 'overnight', 'promotion-proposals'), 'junction');
    const result = await runSandboxPromotionProposalWriterProbe({ projectRoot, execute: true, proposal: validProposal() });
    assert.equal(result.status, 'blocked');
    assert.ok(result.findings.some((entry) => entry.code === 'symlink_escape_refused'));
  });

  it('fails closed for malformed or non-RALPH-044A proposal shapes', () => {
    assert.equal(validatePromotionProposalInput(null).ok, false);
    assert.ok(validatePromotionProposalInput(validProposal({ generator: 'other' })).findings.some((entry) => entry.code === 'source_generator_mismatch'));
    assert.ok(validatePromotionProposalInput(validProposal({ proposal_created: false })).findings.some((entry) => entry.code === 'proposal_not_created'));
  });

  it('fails closed when writes/stdout/authority/source markers are invalid', () => {
    assert.ok(validatePromotionProposalInput(validProposal({ writes_performed: true })).findings.some((entry) => entry.code === 'proposal_writes_performed_not_false'));
    assert.ok(validatePromotionProposalInput(validProposal({ stdout_only: false })).findings.some((entry) => entry.code === 'proposal_stdout_only_not_true'));
    assert.ok(validatePromotionProposalInput(validProposal({ authority_flags: { ...validProposal().authority_flags, queue_execution: true } })).findings.some((entry) => entry.code === 'proposal_authority_flags_not_all_false'));
    assert.ok(validatePromotionProposalInput(validProposal({ source_summary: { sandbox: false, non_authoritative: true } })).findings.some((entry) => entry.code === 'source_sandbox_marker_missing'));
  });

  it('CLI parser requires explicit write mode and refuses write/path operation flags', () => {
    assert.equal(parseArgs(['node', 'cli', '--proposal-json', '{}']).execute, false);
    assert.equal(parseArgs(['node', 'cli', '--proposal-json', '{}', '--execute-canonical-promotion-proposal-probe']).execute, true);
    for (const flag of ['--target', '--output', '--append', '--delete', '--rename', '--move', '--commit', '--push', '--deploy']) {
      assert.throws(() => parseArgs(['node', 'cli', flag]), /refused/);
    }
  });

  it('proposal input file path safety rejects protected and escaping paths', () => {
    assert.equal(isSafeRelativeProposalInputFile('reports/proposal.json'), true);
    assert.equal(isSafeRelativeProposalInputFile('tasks/task-state.json'), false);
    assert.equal(isSafeRelativeProposalInputFile('../proposal.json'), false);
    assert.equal(isSafeRelativeProposalInputFile('C:/tmp/proposal.json'), false);
    assert.equal(isSafeRelativeProposalInputFile('/tmp/proposal.json'), false);
  });
});