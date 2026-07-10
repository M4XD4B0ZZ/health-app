import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateSandboxLifecycleEligibility,
  parseEligibilityJson,
  readEligibilityInputFile,
  isSafeRelativeEligibilityFile,
  ELIGIBILITY_DECISIONS,
} from './sandbox-lifecycle-eligibility-evaluator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const SCHEMA_VERSION = '1.0.0';
export const GENERATOR_ID = 'sandbox-promotion-proposal-generator';
export const MODE = 'read_only_stdout';
export const PROMOTION_PROPOSAL_TYPE = 'sandbox_to_future_canonical_promotion_advisory';

export const FORBIDDEN_AUTHORITY_FIELDS = Object.freeze([
  'canonical_write',
  'canonical_promotion_authorized',
  'canonical_queue_admission',
  'queue_execution',
  'worker_execution',
  'task_execution',
  'lifecycle_execution',
  'runtime_authority',
  'runtime_write',
  'evidence_mutation',
  'review_mutation',
  'validation_mutation',
  'review_acceptance',
  'validation_pass',
  'task_completion',
  'commit_readiness',
  'staging',
  'commit',
  'push',
  'deploy',
  'dependency_install',
  'network',
  'product_work',
]);

export const SCOPE_SCAN_FIELDS = Object.freeze([
  'path',
  'artifact_path',
  'target_path',
  'canonical_target_path',
  'promotion_target_path',
  'source_path',
  'evidence_path',
  'evidence_paths',
  'expected_changed_files',
  'allowed_files',
  'target_paths',
  'referenced_paths',
  'future_allowed_scope_recommendation',
  'future_forbidden_scope_recommendation',
]);

export const CANONICAL_PROTECTED_PATHS = Object.freeze([
  'tasks/',
  'runs/',
  'validation/',
  'review/',
  'handoffs/',
  '.agent/overnight/',
  '.agent/runtime/sandbox/',
  'src/',
  'supabase/',
  'package.json',
  'package-lock.json',
  '.env',
  '.env.',
  'secrets/',
  'credentials/',
  '.git/',
  'node_modules/',
  'SSOK.md',
  'AGENTS.md',
  'VERIFY.md',
  '.governance/',
]);

const NON_AUTHORIZATION_STATEMENT =
  'This sandbox promotion proposal is read-only, stdout-only, non-authoritative advisory output. It does not authorize canonical promotion, canonical queue admission, queue execution, worker execution, task execution, lifecycle execution, runtime mutation, evidence mutation, review acceptance, validation authority, task completion, commit readiness, staging, commit, push, deploy, dependency install, network access, product work, or protected-file mutation.';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(Object(object), key);
}

function finding(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function normalizePath(value) {
  return String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function deterministicProposalId(sourceSummary) {
  const identity = sourceSummary.task_id || sourceSummary.queue_entry_id || 'unknown-source';
  return `proposal-${
    String(identity)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown-source'
  }`;
}

function scanValueForProtectedPath(value, field, findings) {
  if (typeof value !== 'string') return;
  const normalized = normalizePath(value);
  for (const protectedPath of CANONICAL_PROTECTED_PATHS) {
    if (normalized.includes(protectedPath)) {
      findings.push(
        finding(
          'critical',
          'canonical_or_protected_scope_reference',
          'Canonical or protected source/target reference blocks promotion proposal generation',
          { field, value, protected_path: protectedPath },
        ),
      );
      return;
    }
  }
}

function scanForProtectedReferences(input, findings, prefix = '') {
  if (!isPlainObject(input)) return;
  for (const field of SCOPE_SCAN_FIELDS) {
    if (!hasOwn(input, field)) continue;
    const value = input[field];
    const fieldName = prefix ? `${prefix}.${field}` : field;
    if (typeof value === 'string') scanValueForProtectedPath(value, fieldName, findings);
    else if (Array.isArray(value))
      value.forEach((entry, index) =>
        scanValueForProtectedPath(entry, `${fieldName}[${index}]`, findings),
      );
  }
}

function checkForbiddenAuthorityClaims(input, findings, prefix = '') {
  if (!isPlainObject(input)) return;
  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    if (
      hasOwn(input, field) &&
      input[field] !== false &&
      input[field] !== null &&
      input[field] !== undefined
    ) {
      findings.push(
        finding(
          'critical',
          'forbidden_authority_claim',
          'Forbidden authority claim blocks promotion proposal generation',
          { field: prefix ? `${prefix}.${field}` : field, value: input[field] },
        ),
      );
    }
  }
}

function checkAuthorityFlags(eligibility, findings) {
  const flags = isPlainObject(eligibility.authority_flags) ? eligibility.authority_flags : null;
  if (!flags) {
    findings.push(
      finding(
        'critical',
        'authority_flags_missing',
        'Eligibility result must include authority_flags',
      ),
    );
    return;
  }
  for (const [key, value] of Object.entries(flags)) {
    if (value !== false) {
      findings.push(
        finding(
          'critical',
          'upstream_authority_flag_not_false',
          'All upstream authority flags must be false',
          { flag: key, value },
        ),
      );
    }
  }
}

function validateEligibilityResult(eligibility) {
  const findings = [];
  if (!isPlainObject(eligibility)) {
    findings.push(
      finding('critical', 'eligibility_input_not_object', 'Eligibility input must be an object'),
    );
    return findings;
  }

  if (eligibility.decision !== ELIGIBILITY_DECISIONS.ELIGIBLE_FOR_HUMAN_CONSIDERATION) {
    findings.push(
      finding(
        'critical',
        'eligibility_decision_not_eligible',
        'Source eligibility decision must be exactly eligible_for_human_consideration',
        { decision: eligibility.decision ?? null },
      ),
    );
  }
  if (eligibility.eligible_for_human_consideration !== true) {
    findings.push(
      finding(
        'critical',
        'eligible_flag_not_true',
        'eligible_for_human_consideration must be true',
        { eligible_for_human_consideration: eligibility.eligible_for_human_consideration },
      ),
    );
  }
  if (eligibility.blocked === true) {
    findings.push(
      finding(
        'critical',
        'source_eligibility_blocked',
        'Blocked eligibility results cannot produce promotion proposals',
      ),
    );
  }

  const summary = isPlainObject(eligibility.artifact_summary) ? eligibility.artifact_summary : null;
  if (!summary) {
    findings.push(
      finding(
        'critical',
        'artifact_summary_missing',
        'Eligibility result must include artifact_summary',
      ),
    );
  } else {
    if (summary.sandbox !== true)
      findings.push(
        finding(
          'critical',
          'sandbox_marker_missing',
          'Source artifact summary must be sandbox: true',
          { sandbox: summary.sandbox },
        ),
      );
    if (summary.non_authoritative !== true)
      findings.push(
        finding(
          'critical',
          'non_authoritative_marker_missing',
          'Source artifact summary must be non_authoritative: true',
          { non_authoritative: summary.non_authoritative },
        ),
      );
    if (!summary.task_id && !summary.queue_entry_id)
      findings.push(
        finding(
          'critical',
          'source_identity_missing',
          'Source artifact summary must include task_id or queue_entry_id',
        ),
      );
  }

  if (eligibility.writes_performed !== false)
    findings.push(
      finding(
        'critical',
        'upstream_writes_performed_not_false',
        'Upstream writes_performed must be false',
        { writes_performed: eligibility.writes_performed },
      ),
    );
  if (eligibility.stdout_only !== true)
    findings.push(
      finding('critical', 'upstream_stdout_only_not_true', 'Upstream stdout_only must be true', {
        stdout_only: eligibility.stdout_only,
      }),
    );

  checkAuthorityFlags(eligibility, findings);
  checkForbiddenAuthorityClaims(eligibility, findings, 'eligibility');
  checkForbiddenAuthorityClaims(
    eligibility.authority_flags,
    findings,
    'eligibility.authority_flags',
  );
  scanForProtectedReferences(eligibility, findings, 'eligibility');
  scanForProtectedReferences(summary || {}, findings, 'eligibility.artifact_summary');

  return findings;
}

function buildAuthorityFlags() {
  return {
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
    task_completion: false,
    commit_readiness: false,
    staging: false,
    commit: false,
    push: false,
    deploy: false,
    dependency_install: false,
    network: false,
    product_work: false,
  };
}

function buildSourceSummary(eligibility) {
  const artifact = isPlainObject(eligibility?.artifact_summary) ? eligibility.artifact_summary : {};
  return {
    evaluator: eligibility?.evaluator || null,
    eligibility_mode: eligibility?.mode || null,
    task_id: artifact.task_id || null,
    queue_entry_id: artifact.queue_entry_id || null,
    sandbox: artifact.sandbox === true,
    non_authoritative: artifact.non_authoritative === true,
    evidence_bundled: artifact.evidence_bundled === true,
    lifecycle_state: eligibility?.lifecycle_summary?.state || null,
  };
}

export function buildSandboxPromotionProposal(eligibilityInput, options = {}) {
  const eligibility = eligibilityInput;
  const validationFindings = validateEligibilityResult(eligibility);
  const sourceSummary = buildSourceSummary(eligibility);
  const proposalCreated = validationFindings.length === 0;
  const result = {
    schema_version: SCHEMA_VERSION,
    generator: GENERATOR_ID,
    mode: MODE,
    proposal_id: deterministicProposalId(sourceSummary),
    proposal_created: proposalCreated,
    promotion_proposal_type: PROMOTION_PROPOSAL_TYPE,
    source_summary: sourceSummary,
    source_eligibility_decision: eligibility?.decision || null,
    future_task_recommendation: proposalCreated
      ? 'Register a future separately authorized canonical promotion planning or writer task after human review.'
      : 'Resolve blocking findings before any future canonical promotion task is considered.',
    required_human_approvals: proposalCreated
      ? [
          'Human approval is required before any future canonical promotion writer is implemented or executed.',
        ]
      : [],
    required_governance_references: [
      'ROADMAP.md',
      'VERIFY.md',
      'AGENTS.md',
      'SSOK.md',
      '.governance/SAFETY.md',
      '.governance/RULES.md',
    ],
    future_allowed_scope_recommendation: [
      'A future task must define an explicit create-only canonical target boundary before any canonical write is allowed.',
    ],
    future_forbidden_scope_recommendation: [
      'tasks/**',
      'runs/**',
      'validation/**',
      'review/**',
      'handoffs/**',
      '.agent/overnight/**',
      '.agent/runtime/sandbox/**',
      'src/**',
      'supabase/**',
      'package.json',
      'package-lock.json',
      '.env*',
      '.governance/**',
    ],
    required_verification_category: 'focused_agent_tooling_with_git_readbacks',
    required_review_gate: 'human_review_required_before_future_canonical_promotion',
    stop_conditions: [
      'Stop if source eligibility is not eligible_for_human_consideration.',
      'Stop if any canonical/protected scope reference is present.',
      'Stop if any authority flag or write flag is true.',
      'Stop if human approval for future canonical promotion is absent.',
    ],
    findings: validationFindings,
    reason_codes: unique(validationFindings.map((entry) => entry.code)),
    authority_flags: buildAuthorityFlags(),
    writes_performed: false,
    stdout_only: true,
    non_authorization_statement: NON_AUTHORIZATION_STATEMENT,
  };
  return result;
}

export function buildSandboxPromotionProposalFromArtifact(artifactInput, options = {}) {
  const eligibility = evaluateSandboxLifecycleEligibility(artifactInput, options);
  return buildSandboxPromotionProposal(eligibility, options);
}

export function parsePromotionJson(value) {
  return parseEligibilityJson(value);
}

export function isSafeRelativePromotionInputFile(inputPath) {
  return isSafeRelativeEligibilityFile(inputPath);
}

export async function readPromotionInputFile(inputPath, options = {}) {
  return readEligibilityInputFile(inputPath, options);
}

export function readPromotionInputFileSync(inputPath, options = {}) {
  if (!isSafeRelativePromotionInputFile(inputPath))
    throw new Error(`Unsafe file path rejected: ${inputPath}`);
  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const absolute = path.resolve(projectRoot, normalizePath(inputPath));
  const rootWithSep = `${path.resolve(projectRoot)}${path.sep}`;
  if (!absolute.startsWith(rootWithSep))
    throw new Error('Unsafe file path resolved outside project root');
  return parsePromotionJson(fs.readFileSync(absolute, 'utf8'));
}

export function formatSandboxPromotionProposalMarkdown(proposal) {
  const lines = [];
  lines.push('# Sandbox Promotion Proposal');
  lines.push('');
  lines.push(`- Generator: ${proposal.generator}`);
  lines.push(`- Mode: ${proposal.mode}`);
  lines.push(`- Proposal ID: ${proposal.proposal_id}`);
  lines.push(`- Proposal created: ${proposal.proposal_created}`);
  lines.push(
    `- Source eligibility decision: ${proposal.source_eligibility_decision || '(missing)'}`,
  );
  lines.push('');
  lines.push('## Source Summary');
  lines.push('');
  lines.push(`- Task ID: ${proposal.source_summary.task_id || '(none)'}`);
  lines.push(`- Queue Entry ID: ${proposal.source_summary.queue_entry_id || '(none)'}`);
  lines.push(`- Sandbox: ${proposal.source_summary.sandbox}`);
  lines.push(`- Non-authoritative: ${proposal.source_summary.non_authoritative}`);
  lines.push(`- Lifecycle state: ${proposal.source_summary.lifecycle_state || '(none)'}`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (proposal.findings.length === 0) lines.push('- none');
  for (const entry of proposal.findings)
    lines.push(`- ${entry.severity}: ${entry.code} — ${entry.message}`);
  lines.push('');
  lines.push('## Future Task Recommendation');
  lines.push('');
  lines.push(proposal.future_task_recommendation);
  lines.push('');
  lines.push('## Authority Flags');
  lines.push('');
  for (const [key, value] of Object.entries(proposal.authority_flags))
    lines.push(`- ${key}: ${value}`);
  lines.push('');
  lines.push('## Non-Authorization');
  lines.push('');
  lines.push(proposal.non_authorization_statement);
  return lines.join('\n');
}
