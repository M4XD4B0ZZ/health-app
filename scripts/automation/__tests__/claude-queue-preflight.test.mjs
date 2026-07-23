import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  decidePreflight,
  classifyChecks,
  parseQueueIssueBody,
  REASON_CODES,
} from '../claude-queue-preflight.mjs';
import { resolveAuthDecision } from '../claude-queue-auth-precheck.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PREFLIGHT_SOURCE = readFileSync(
  path.join(REPO_ROOT, 'scripts/automation/claude-queue-preflight.mjs'),
  'utf8',
);
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github/workflows/claude-queue-wake.yml');
const WORKFLOW_SOURCE = readFileSync(WORKFLOW_PATH, 'utf8');

/** Build a minimal, valid queue issue fixture; override fields as needed per test. */
function issue(overrides = {}) {
  return {
    number: 100,
    state: 'open',
    labels: [],
    taskId: 'QUEUE-100',
    dependencies: [],
    malformed: false,
    autoMergeAuthorized: false,
    hasStateComment: true,
    branchExists: true,
    pr: null,
    checkRuns: [],
    duplicatePr: false,
    ...overrides,
  };
}

describe('decidePreflight — idle task selection', () => {
  test('1) no approved task anywhere -> IDLE_NO_APPROVED_TASK', () => {
    const issues = [issue({ number: 1, labels: [] })];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'IDLE_NO_APPROVED_TASK');
    assert.equal(d.should_invoke, false);
  });

  test('2) one eligible approved safe-autonomous task -> ACTION_NEW_TASK', () => {
    const issues = [
      issue({ number: 2, taskId: 'QUEUE-002', labels: ['queue:approved', 'risk:safe-autonomous'] }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_NEW_TASK');
    assert.equal(d.should_invoke, true);
    assert.equal(d.issue_number, '2');
    assert.equal(d.task_id, 'QUEUE-002');
    assert.equal(d.phase, 'claim');
  });

  test('3) approved task with incomplete dependency -> IDLE_DEPENDENCY_BLOCKED', () => {
    const issues = [
      issue({
        number: 3,
        taskId: 'QUEUE-003B',
        labels: ['queue:approved', 'risk:safe-autonomous'],
        dependencies: ['QUEUE-003A'],
      }),
      issue({ number: 2, taskId: 'QUEUE-003A', labels: [] }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'IDLE_DEPENDENCY_BLOCKED');
    assert.equal(d.should_invoke, false);
  });

  test('4) dependency marked queue:done -> ACTION_NEW_TASK', () => {
    const issues = [
      issue({
        number: 3,
        taskId: 'QUEUE-003B',
        labels: ['queue:approved', 'risk:safe-autonomous'],
        dependencies: ['QUEUE-003A'],
      }),
      issue({ number: 2, taskId: 'QUEUE-003A', labels: ['queue:done'], state: 'closed' }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_NEW_TASK');
    assert.equal(d.issue_number, '3');
  });

  test('5) risk:human-only issue is ignored -> IDLE_NO_APPROVED_TASK', () => {
    const issues = [issue({ number: 5, labels: ['queue:approved', 'risk:human-only'] })];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'IDLE_NO_APPROVED_TASK');
  });

  test('6) queue:blocked issue is ignored -> IDLE_NO_APPROVED_TASK', () => {
    const issues = [issue({ number: 6, labels: ['queue:approved', 'queue:blocked'] })];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'IDLE_NO_APPROVED_TASK');
  });

  test('7) queue:needs-human issue is ignored -> IDLE_NO_APPROVED_TASK', () => {
    const issues = [issue({ number: 7, labels: ['queue:approved', 'queue:needs-human'] })];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'IDLE_NO_APPROVED_TASK');
  });

  test('lowest issue number wins among multiple eligible candidates', () => {
    const issues = [
      issue({ number: 20, labels: ['queue:approved'], taskId: 'QUEUE-020' }),
      issue({ number: 9, labels: ['queue:approved'], taskId: 'QUEUE-009' }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.issue_number, '9');
    assert.equal(d.task_id, 'QUEUE-009');
  });
});

describe('decidePreflight — active-task reconciliation', () => {
  test('8) exactly one active implementation issue (no PR yet) -> ACTION_RESUME_IMPLEMENTATION', () => {
    const issues = [
      issue({ number: 8, labels: ['queue:running'], hasStateComment: true, pr: null }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_RESUME_IMPLEMENTATION');
    assert.equal(d.phase, 'implement');
    assert.equal(d.should_invoke, true);
  });

  test('9) multiple active tasks -> BLOCKED_MULTIPLE_ACTIVE_TASKS, reports both numbers', () => {
    const issues = [
      issue({ number: 11, labels: ['queue:running'] }),
      issue({ number: 12, labels: ['queue:waiting-ci'] }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'BLOCKED_MULTIPLE_ACTIVE_TASKS');
    assert.equal(d.should_invoke, false);
    assert.equal(d.issue_number, '11,12');
  });

  test('10) waiting CI, check queued -> IDLE_WAITING_CI', () => {
    const issues = [
      issue({
        number: 13,
        labels: ['queue:waiting-ci'],
        pr: { number: 200, state: 'open', merged: false, headSha: 'sha-queued' },
        checkRuns: [{ status: 'queued', conclusion: null }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'IDLE_WAITING_CI');
    assert.equal(d.should_invoke, false);
    assert.equal(d.pr_number, '200');
  });

  test('11) waiting CI, check in-progress -> IDLE_WAITING_CI', () => {
    const issues = [
      issue({
        number: 14,
        labels: ['queue:waiting-ci'],
        pr: { number: 201, state: 'open', merged: false, headSha: 'sha-inprog' },
        checkRuns: [{ status: 'in_progress', conclusion: null }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'IDLE_WAITING_CI');
  });

  test('12) failed Verify check -> ACTION_CI_FAILED', () => {
    const issues = [
      issue({
        number: 15,
        labels: ['queue:waiting-ci'],
        pr: { number: 202, state: 'open', merged: false, headSha: 'sha-failed' },
        checkRuns: [{ status: 'completed', conclusion: 'failure' }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_CI_FAILED');
    assert.equal(d.should_invoke, true);
    assert.equal(d.phase, 'fix');
  });

  test('13) cancelled check -> ACTION_CI_FAILED', () => {
    const issues = [
      issue({
        number: 16,
        labels: ['queue:waiting-ci'],
        pr: { number: 203, state: 'open', merged: false, headSha: 'sha-cancel' },
        checkRuns: [{ status: 'completed', conclusion: 'cancelled' }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_CI_FAILED');
  });

  test('14) green Verify check + safe auto-merge authorized -> ACTION_CI_GREEN', () => {
    const issues = [
      issue({
        number: 17,
        labels: ['queue:waiting-ci', 'risk:safe-autonomous'],
        autoMergeAuthorized: true,
        pr: { number: 204, state: 'open', merged: false, headSha: 'sha-green' },
        checkRuns: [{ status: 'completed', conclusion: 'success' }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_CI_GREEN');
    assert.equal(d.should_invoke, true);
    assert.equal(d.phase, 'resolve');
  });

  test('15) green Verify check + review-required (no auto-merge) -> IDLE_WAITING_HUMAN_MERGE', () => {
    const issues = [
      issue({
        number: 18,
        labels: ['queue:waiting-ci', 'risk:review-required'],
        autoMergeAuthorized: false,
        pr: { number: 205, state: 'open', merged: false, headSha: 'sha-green-human' },
        checkRuns: [{ status: 'completed', conclusion: 'success' }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'IDLE_WAITING_HUMAN_MERGE');
    assert.equal(d.should_invoke, false);
  });

  test('16) merged PR + unfinished issue -> ACTION_POST_MERGE', () => {
    const issues = [
      issue({
        number: 19,
        labels: ['queue:waiting-ci'],
        pr: { number: 206, state: 'closed', merged: true, headSha: 'sha-merged' },
        checkRuns: [{ status: 'completed', conclusion: 'success' }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_POST_MERGE');
    assert.equal(d.phase, 'post-merge');
    assert.equal(d.pr_number, '206');
  });

  test('17) malformed task body (no Task ID) among idle candidates -> BLOCKED_INVALID_QUEUE_ISSUE', () => {
    const parsed = parseQueueIssueBody('This issue has no recognizable Task ID field at all.');
    assert.equal(parsed.malformed, true);
    const issues = [
      issue({ number: 21, labels: ['queue:approved'], malformed: true, taskId: null }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'BLOCKED_INVALID_QUEUE_ISSUE');
    assert.equal(d.should_invoke, false);
  });

  test('18) missing state comment with active labels and no branch/PR evidence -> BLOCKED_AMBIGUOUS_STATE', () => {
    const issues = [
      issue({
        number: 22,
        labels: ['queue:running'],
        hasStateComment: false,
        branchExists: false,
        pr: null,
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'BLOCKED_AMBIGUOUS_STATE');
    assert.equal(d.should_invoke, false);
  });

  test('19) stale state-comment text disagrees with actual PR state -> actual PR state wins', () => {
    // The fixture intentionally carries no "comment says X" field at all: decidePreflight
    // only ever reads real branch/PR/check-run evidence, so a stale comment cannot influence
    // the result even if one existed. Here the comment nominally says "implementing" but the
    // real PR is open with a green, auto-merge-authorized check run.
    const issues = [
      issue({
        number: 23,
        labels: ['queue:waiting-ci', 'risk:safe-autonomous'],
        hasStateComment: true, // e.g. comment text still says "phase: implementing"
        autoMergeAuthorized: true,
        pr: { number: 207, state: 'open', merged: false, headSha: 'sha-actual' },
        checkRuns: [{ status: 'completed', conclusion: 'success' }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_CI_GREEN');
    assert.equal(d.head_sha, 'sha-actual');
  });

  test('20) legacy combined status disagrees with check-runs -> check-runs win', () => {
    const issues = [
      issue({
        number: 24,
        labels: ['queue:waiting-ci', 'risk:safe-autonomous'],
        autoMergeAuthorized: true,
        pr: { number: 208, state: 'open', merged: false, headSha: 'sha-legacy' },
        // Legacy combined-status API says "pending" (simulated via an extra, unread field);
        // decidePreflight must derive its answer solely from checkRuns.
        legacyCombinedStatus: 'pending',
        checkRuns: [{ status: 'completed', conclusion: 'success' }],
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'ACTION_CI_GREEN');
  });

  test('21) duplicate branch/PR ambiguity -> BLOCKED_AMBIGUOUS_STATE', () => {
    const issues = [
      issue({
        number: 25,
        labels: ['queue:waiting-ci'],
        pr: { number: 209, state: 'open', merged: false, headSha: 'sha-dup' },
        checkRuns: [{ status: 'completed', conclusion: 'success' }],
        duplicatePr: true,
      }),
    ];
    const d = decidePreflight(issues);
    assert.equal(d.reason_code, 'BLOCKED_AMBIGUOUS_STATE');
  });
});

describe('decidePreflight — stable outputs and purity', () => {
  test('22) idle result writes all 7 stable output fields, actionable ones empty', () => {
    const d = decidePreflight([]);
    assert.equal(d.should_invoke, false);
    assert.ok(REASON_CODES.includes(d.reason_code));
    assert.equal(d.issue_number, '');
    assert.equal(d.task_id, '');
    assert.equal(d.phase, '');
    assert.equal(d.pr_number, '');
    assert.equal(d.head_sha, '');
  });

  test('23) actionable result writes all 7 stable output fields populated as applicable', () => {
    const issues = [issue({ number: 30, taskId: 'QUEUE-030', labels: ['queue:approved'] })];
    const d = decidePreflight(issues);
    assert.equal(d.should_invoke, true);
    assert.equal(d.reason_code, 'ACTION_NEW_TASK');
    assert.equal(d.issue_number, '30');
    assert.equal(d.task_id, 'QUEUE-030');
    assert.equal(d.phase, 'claim');
    // No PR exists yet for a brand-new task.
    assert.equal(d.pr_number, '');
    assert.equal(d.head_sha, '');
  });

  test('24) preflight source never issues a mutating GitHub API call', () => {
    assert.doesNotMatch(PREFLIGHT_SOURCE, /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/i);
    assert.match(PREFLIGHT_SOURCE, /method:\s*['"]GET['"]/);
    // Every fetch() call in the file must be inside githubGet(), which hardcodes GET.
    const fetchCallSites = PREFLIGHT_SOURCE.match(/\bfetch\(/g) ?? [];
    assert.equal(
      fetchCallSites.length,
      1,
      'expected exactly one fetch() call site (inside githubGet)',
    );
  });

  test('decidePreflight does not mutate its input array/objects', () => {
    const original = [issue({ number: 40, labels: ['queue:approved'] })];
    const snapshotBefore = JSON.parse(JSON.stringify(original));
    decidePreflight(original);
    assert.deepEqual(original, snapshotBefore);
  });
});

describe('parseQueueIssueBody', () => {
  test('parses the bold-label paragraph style used by existing queue issues', () => {
    const body = [
      '**Task ID:** QUEUE-050',
      '',
      '**Dependencies:** QUEUE-049',
      '',
      '**Merge authorization:** Yes — auto-merge when green',
    ].join('\n');
    const parsed = parseQueueIssueBody(body);
    assert.equal(parsed.malformed, false);
    assert.equal(parsed.taskId, 'QUEUE-050');
    assert.deepEqual(parsed.dependencies, ['QUEUE-049']);
    assert.equal(parsed.autoMergeAuthorized, true);
  });

  test('parses the GitHub issue-form header rendering style', () => {
    const body = ['### Task ID', '', 'QUEUE-051', '', '### Dependencies', '', 'none'].join('\n');
    const parsed = parseQueueIssueBody(body);
    assert.equal(parsed.malformed, false);
    assert.equal(parsed.taskId, 'QUEUE-051');
    assert.deepEqual(parsed.dependencies, []);
  });

  test('missing Task ID -> malformed', () => {
    const parsed = parseQueueIssueBody('Just some prose with no recognizable fields.');
    assert.equal(parsed.malformed, true);
  });

  test('unparseable Dependencies value -> malformed', () => {
    const body = '**Task ID:** QUEUE-052\n\n**Dependencies:** whatever the last task was';
    const parsed = parseQueueIssueBody(body);
    assert.equal(parsed.malformed, true);
  });

  test('empty body -> malformed', () => {
    assert.equal(parseQueueIssueBody('').malformed, true);
    assert.equal(parseQueueIssueBody(null).malformed, true);
  });
});

describe('classifyChecks', () => {
  test('no check runs -> none', () => {
    assert.equal(classifyChecks([]), 'none');
    assert.equal(classifyChecks(undefined), 'none');
  });

  test('mixed success/neutral completed conclusions -> mixed (ambiguous, not guessed)', () => {
    assert.equal(
      classifyChecks([
        { status: 'completed', conclusion: 'success' },
        { status: 'completed', conclusion: 'neutral' },
      ]),
      'mixed',
    );
  });

  test('failure takes priority over a simultaneous cancelled run', () => {
    assert.equal(
      classifyChecks([
        { status: 'completed', conclusion: 'failure' },
        { status: 'completed', conclusion: 'cancelled' },
      ]),
      'failure',
    );
  });
});

describe('auth precheck — resolveAuthDecision (26-30)', () => {
  test('26) invalid CLAUDE_QUEUE_AUTH_MODE -> not ok, secret-free message', () => {
    const d = resolveAuthDecision({
      authMode: 'bogus',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: true,
    });
    assert.equal(d.ok, false);
    assert.match(d.message, /CLAUDE_QUEUE_AUTH_MODE/);
  });

  test('27) oauth mode without CLAUDE_CODE_OAUTH_TOKEN -> not ok', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: false,
      hasApiKey: false,
    });
    assert.equal(d.ok, false);
    assert.match(d.message, /CLAUDE_CODE_OAUTH_TOKEN/);
  });

  test('28) api mode without ANTHROPIC_API_KEY -> not ok', () => {
    const d = resolveAuthDecision({
      authMode: 'api',
      model: 'claude-sonnet-5',
      hasOauthToken: false,
      hasApiKey: false,
    });
    assert.equal(d.ok, false);
    assert.match(d.message, /ANTHROPIC_API_KEY/);
  });

  test('29) missing CLAUDE_QUEUE_MODEL -> not ok', () => {
    const d = resolveAuthDecision({
      authMode: 'api',
      model: '',
      hasOauthToken: false,
      hasApiKey: true,
    });
    assert.equal(d.ok, false);
    assert.match(d.message, /CLAUDE_QUEUE_MODEL/);
  });

  test('30) secret values are structurally impossible to leak via diagnostics', () => {
    // resolveAuthDecision's signature only accepts booleans for secret presence — a fake
    // "secret value" cannot even be passed in, let alone echoed back.
    const fakeSecretMarker = 'sk-ant-super-secret-marker-should-never-appear';
    const d = resolveAuthDecision({
      authMode: 'api',
      model: 'claude-sonnet-5',
      hasOauthToken: false,
      hasApiKey: true,
    });
    assert.equal(d.message.includes(fakeSecretMarker), false);
    // The function has no parameter that could carry a raw secret value.
    assert.equal(resolveAuthDecision.length, 1);
  });

  test('valid oauth mode with token and model -> ok', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: false,
    });
    assert.equal(d.ok, true);
  });

  test('valid api mode with key and model -> ok', () => {
    const d = resolveAuthDecision({
      authMode: 'api',
      model: 'claude-sonnet-5',
      hasOauthToken: false,
      hasApiKey: true,
    });
    assert.equal(d.ok, true);
  });

  test('primary mode secret present, fallback secret also present -> primary is effective, runtime fallback offered', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: true,
      authModeFallback: 'api',
    });
    assert.equal(d.ok, true);
    assert.equal(d.effectiveMode, 'oauth');
    assert.equal(d.usedFallback, false);
    assert.equal(d.runtimeFallbackMode, 'api');
    assert.equal(d.runtimeFallbackModel, 'claude-sonnet-5');
  });

  test('runtime fallback model falls back to the primary model when CLAUDE_QUEUE_MODEL_FALLBACK is unset', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: true,
      authModeFallback: 'api',
      modelFallback: '',
    });
    assert.equal(d.runtimeFallbackModel, 'claude-sonnet-5');
  });

  test('runtime fallback model uses CLAUDE_QUEUE_MODEL_FALLBACK when set', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: true,
      authModeFallback: 'api',
      modelFallback: 'claude-haiku-4-5-20251001',
    });
    assert.equal(d.runtimeFallbackModel, 'claude-haiku-4-5-20251001');
  });

  test('primary secret present but no fallback mode configured -> no runtime fallback offered', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: true,
    });
    assert.equal(d.ok, true);
    assert.equal(d.runtimeFallbackMode, '');
    assert.equal(d.runtimeFallbackModel, '');
  });

  test('primary secret present but fallback mode has no matching secret -> no runtime fallback offered', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: false,
      authModeFallback: 'api',
    });
    assert.equal(d.ok, true);
    assert.equal(d.runtimeFallbackMode, '');
    assert.equal(d.runtimeFallbackModel, '');
  });

  test('config-time fallback used -> no further runtime fallback offered', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: false,
      hasApiKey: true,
      authModeFallback: 'api',
    });
    assert.equal(d.ok, true);
    assert.equal(d.usedFallback, true);
    assert.equal(d.runtimeFallbackMode, '');
    assert.equal(d.runtimeFallbackModel, '');
  });

  test('primary secret missing, fallback secret present -> falls back deterministically', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: false,
      hasApiKey: true,
      authModeFallback: 'api',
    });
    assert.equal(d.ok, true);
    assert.equal(d.effectiveMode, 'api');
    assert.equal(d.usedFallback, true);
    assert.match(d.message, /falling back to mode "api"/);
  });

  test('primary and fallback both missing their secrets -> not ok, message names both', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: false,
      hasApiKey: false,
      authModeFallback: 'api',
    });
    assert.equal(d.ok, false);
    assert.match(d.message, /CLAUDE_CODE_OAUTH_TOKEN/);
    assert.match(d.message, /ANTHROPIC_API_KEY/);
  });

  test('fallback mode equal to primary mode -> not ok', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: true,
      authModeFallback: 'oauth',
    });
    assert.equal(d.ok, false);
    assert.match(d.message, /must differ/);
  });

  test('invalid fallback mode value -> not ok', () => {
    const d = resolveAuthDecision({
      authMode: 'oauth',
      model: 'claude-sonnet-5',
      hasOauthToken: true,
      hasApiKey: true,
      authModeFallback: 'bogus',
    });
    assert.equal(d.ok, false);
    assert.match(d.message, /CLAUDE_QUEUE_AUTH_MODE_FALLBACK/);
  });

  test('no fallback configured, primary secret missing -> not ok, no fallback hint in message', () => {
    const d = resolveAuthDecision({
      authMode: 'api',
      model: 'claude-sonnet-5',
      hasOauthToken: false,
      hasApiKey: false,
    });
    assert.equal(d.ok, false);
    assert.doesNotMatch(d.message, /fallback/i);
  });
});

describe('workflow structure — .github/workflows/claude-queue-wake.yml', () => {
  test('declares workflow_dispatch and a 15-minute cron schedule', () => {
    assert.match(WORKFLOW_SOURCE, /workflow_dispatch:/);
    assert.match(WORKFLOW_SOURCE, /cron:\s*['"]\*\/15 \* \* \* \*['"]/);
  });

  test('declares event-driven wake triggers so the queue does not depend on cron punctuality', () => {
    // GitHub's schedule trigger is best-effort; during the QUEUE-006 Phase-B smoke no */15
    // tick fired for over an hour while a green queue PR waited. The two prompt-relevant
    // state changes must each have a native event wake: task approval (issues labeled) and
    // CI completion (workflow_run on the Verify workflow). The cron stays as heartbeat only.
    assert.match(WORKFLOW_SOURCE, /issues:\n\s*types: \[labeled\]/);
    assert.match(
      WORKFLOW_SOURCE,
      /workflow_run:\n\s*workflows: \['Verify'\]\n\s*types: \[completed\]/,
    );
  });

  test('preflight job skips labeled events for any label other than queue:approved', () => {
    const preflightJobMatch = WORKFLOW_SOURCE.match(/\n {2}preflight:\n([\s\S]*?)\n {2}claude:/);
    assert.ok(preflightJobMatch, 'preflight job not found');
    assert.match(
      preflightJobMatch[1],
      /if:\s*github\.event_name != 'issues' \|\| github\.event\.label\.name == 'queue:approved'/,
    );
  });

  test('all four transition steps allow the claude bot actor, scoped (not wildcard)', () => {
    // Every queue PR is authored by claude[bot], so the workflow_run wake (CI completing on
    // that PR) always has a Bot actor in its event chain. Without allowed_bots, the action's
    // own anti-abuse check refuses to run at all ("non-human actor: claude (type: Bot)") —
    // exactly what the QUEUE-007/008 multi-task smoke test caught: every CI-completion wake
    // failed in ~1s. Must be scoped to 'claude', never '*' (the action's own docs warn '*' lets
    // any external App on the repo invoke it with attacker-controlled prompts).
    const occurrences = (WORKFLOW_SOURCE.match(/allowed_bots: 'claude'/g) ?? []).length;
    assert.equal(occurrences, 4, 'expected allowed_bots on all four transition steps');
    assert.doesNotMatch(WORKFLOW_SOURCE, /allowed_bots: '\*'/);
  });

  test('25) claude job is conditional on preflight should_invoke -> idle path cannot reach it', () => {
    const claudeJobMatch = WORKFLOW_SOURCE.match(/\n {2}claude:\n([\s\S]*)/);
    assert.ok(claudeJobMatch, 'claude job not found');
    const claudeJobBlock = claudeJobMatch[1];
    assert.match(claudeJobBlock, /if:\s*needs\.preflight\.outputs\.should_invoke == 'true'/);
    assert.match(claudeJobBlock, /needs:\s*preflight/);
  });

  test('repository-wide single concurrency group, never cancels an in-progress run', () => {
    assert.match(
      WORKFLOW_SOURCE,
      /concurrency:\n\s*group:\s*[^\n]+\n\s*cancel-in-progress:\s*false/,
    );
  });

  test('preflight job has only read permissions and no Claude secret reference', () => {
    const preflightJobMatch = WORKFLOW_SOURCE.match(/\n {2}preflight:\n([\s\S]*?)\n {2}claude:/);
    assert.ok(preflightJobMatch, 'preflight job not found');
    const block = preflightJobMatch[1];
    assert.doesNotMatch(block, /contents:\s*write/);
    assert.doesNotMatch(block, /issues:\s*write/);
    assert.doesNotMatch(block, /pull-requests:\s*write/);
    assert.doesNotMatch(block, /id-token:\s*write/);
    assert.doesNotMatch(block, /ANTHROPIC_API_KEY/);
    assert.doesNotMatch(block, /CLAUDE_CODE_OAUTH_TOKEN/);
  });

  test('claude job requests only the documented permissions (no admin/secrets/workflows/deployments/packages)', () => {
    const claudeJobMatch = WORKFLOW_SOURCE.match(/\n {2}claude:\n([\s\S]*)/);
    const block = claudeJobMatch[1];
    assert.doesNotMatch(block, /administration:/);
    assert.doesNotMatch(block, /secrets:\s*write/);
    assert.doesNotMatch(block, /workflows:\s*write/);
    assert.doesNotMatch(block, /deployments:\s*write/);
    assert.doesNotMatch(block, /packages:\s*write/);
  });

  test('third-party actions are pinned to a full immutable commit SHA with a release comment', () => {
    const usesLines = WORKFLOW_SOURCE.match(/uses:\s*[^\n]+/g) ?? [];
    assert.ok(usesLines.length >= 2, 'expected at least checkout + claude-code-action');
    for (const line of usesLines) {
      assert.match(
        line,
        /uses:\s*[\w.-]+\/[\w.-]+@[0-9a-f]{40}\s+#\s+v\S+/,
        `action not pinned to a full commit SHA with a version comment: ${line}`,
      );
    }
  });

  test('has finite job timeout and bounded max-turns on the claude job', () => {
    assert.match(WORKFLOW_SOURCE, /timeout-minutes:\s*45/);
    // 50, not 24: the QUEUE-006 smoke test showed 24 was tight enough that a worker could
    // complete its transition and still die on the turn limit, reporting a spurious failure.
    assert.match(WORKFLOW_SOURCE, /--max-turns\s+50/);
    assert.doesNotMatch(WORKFLOW_SOURCE, /--max-turns\s+(?!50\b)\d+/);
  });

  test('does not grant unrestricted Bash', () => {
    assert.doesNotMatch(WORKFLOW_SOURCE, /--allowedTools\s+["']?Bash["']?\s*$/m);
    assert.doesNotMatch(WORKFLOW_SOURCE, /allowedTools\s+Bash(?!\()/);
  });

  test('auth precheck step runs before the Claude Code Action step in the claude job', () => {
    const authIdx = WORKFLOW_SOURCE.indexOf('claude-queue-auth-precheck.mjs');
    const actionIdx = WORKFLOW_SOURCE.indexOf('anthropics/claude-code-action@');
    assert.ok(authIdx > -1 && actionIdx > -1);
    assert.ok(authIdx < actionIdx, 'auth precheck must run before the Claude Code Action step');
  });

  test('primary transition steps gate on the resolved effective_mode output, never directly on the raw auth-mode variable', () => {
    // Gating on steps.auth.outputs.effective_mode (computed once, pre-invocation) rather than
    // vars.CLAUDE_QUEUE_AUTH_MODE is what makes config-time fallback selection safe: it can
    // never cause both the oauth and api PRIMARY transition steps to run in the same job.
    assert.match(WORKFLOW_SOURCE, /if:\s*steps\.auth\.outputs\.effective_mode == 'oauth'/);
    assert.match(WORKFLOW_SOURCE, /if:\s*steps\.auth\.outputs\.effective_mode == 'api'/);
    assert.doesNotMatch(WORKFLOW_SOURCE, /if:\s*vars\.CLAUDE_QUEUE_AUTH_MODE ==/);
  });

  test('auth precheck step reads the optional fallback variables', () => {
    assert.match(
      WORKFLOW_SOURCE,
      /CLAUDE_QUEUE_AUTH_MODE_FALLBACK:\s*\$\{\{\s*vars\.CLAUDE_QUEUE_AUTH_MODE_FALLBACK\s*\}\}/,
    );
    assert.match(
      WORKFLOW_SOURCE,
      /CLAUDE_QUEUE_MODEL_FALLBACK:\s*\$\{\{\s*vars\.CLAUDE_QUEUE_MODEL_FALLBACK\s*\}\}/,
    );
  });

  test('runtime fallback steps only gate on the primary step of the SAME mode having failed, plus a configured fallback', () => {
    // Each runtime fallback step must reference the outcome of its own primary step (not the
    // other one) — otherwise a failure on one mode could spuriously trigger the wrong fallback.
    assert.match(
      WORKFLOW_SOURCE,
      /if:\s*always\(\) && steps\.run-oauth\.outcome == 'failure' && steps\.auth\.outputs\.runtime_fallback_mode == 'api' && steps\.recheck-oauth\.outputs\.should_invoke == 'true'/,
    );
    assert.match(
      WORKFLOW_SOURCE,
      /if:\s*always\(\) && steps\.run-api\.outcome == 'failure' && steps\.auth\.outputs\.runtime_fallback_mode == 'oauth' && steps\.recheck-api\.outputs\.should_invoke == 'true'/,
    );
  });

  test('runtime fallback and recheck conditions call always() so GitHub Actions does not implicitly AND success() onto them', () => {
    // A bare custom `if:` (no failure()/always()/cancelled()) gets an implicit success() ANDed
    // on by GitHub Actions, which would silently skip these steps forever once the primary step
    // they're meant to react to has already failed. This is the exact bug the QUEUE-006 smoke
    // test caught in production: job summary showed run-oauth: failure and
    // runtime_fallback_configured: api, but fallback-oauth-to-api: skipped.
    const fallbackIfLines = WORKFLOW_SOURCE.match(/if:\s*[^\n]*runtime_fallback_mode[^\n]*/g) ?? [];
    assert.equal(
      fallbackIfLines.length,
      4,
      'expected exactly four post-failure if: conditions (two rechecks, two fallbacks)',
    );
    for (const line of fallbackIfLines) {
      assert.match(line, /always\(\)/, `post-failure condition missing always(): ${line}`);
    }
  });

  test('every transition prompt instructs the worker to end immediately after the durable transition', () => {
    // Companion mitigation to the recheck gate: 24 turns proved tight enough that a worker
    // finished its transition and then burned the rest on tidying, ending as a spurious
    // failure. All four prompts (two primaries, two fallbacks) must carry the wrap-up rule.
    const occurrences = WORKFLOW_SOURCE.match(/end this run immediately/g) ?? [];
    assert.equal(occurrences.length, 4, 'expected the wrap-up instruction in all four prompts');
  });

  test('a deterministic recheck gates each runtime fallback, so a completed-then-failed primary run never triggers a redundant Claude retry', () => {
    // The QUEUE-006 smoke run proved a primary attempt can durably complete its transition and
    // STILL report failure (max-turns exhaustion after the work was done). The recheck re-runs
    // the same read-only preflight decision script against live GitHub state; the fallback only
    // fires if it still says should_invoke=true. No log parsing, no error-text matching.
    const recheckMatches =
      WORKFLOW_SOURCE.match(
        /id: recheck-(oauth|api)\n[\s\S]*?run: node scripts\/automation\/claude-queue-preflight\.mjs/g,
      ) ?? [];
    assert.equal(
      recheckMatches.length,
      2,
      'expected recheck-oauth and recheck-api to run the preflight script',
    );
    // Rechecks are read-only: they must use the workflow GITHUB_TOKEN, never a Claude secret.
    for (const block of recheckMatches) {
      assert.doesNotMatch(block, /ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN/);
    }
    // Ordering: each recheck sits between its primary step and its fallback step.
    const idx = (s) => WORKFLOW_SOURCE.indexOf(s);
    assert.ok(
      idx('id: run-oauth') < idx('id: recheck-oauth') &&
        idx('id: recheck-oauth') < idx('id: fallback-oauth-to-api'),
      'recheck-oauth must sit between run-oauth and fallback-oauth-to-api',
    );
    assert.ok(
      idx('id: run-api') < idx('id: recheck-api') &&
        idx('id: recheck-api') < idx('id: fallback-api-to-oauth'),
      'recheck-api must sit between run-api and fallback-api-to-oauth',
    );
  });

  test("claude job grants id-token: write for the Claude Code Action's own OIDC GitHub token exchange", () => {
    const claudeJobMatch = WORKFLOW_SOURCE.match(/\n {2}claude:\n([\s\S]*)/);
    assert.ok(claudeJobMatch, 'claude job not found');
    assert.match(claudeJobMatch[1], /id-token:\s*write/);
  });

  test('runtime fallback steps use the resolved fallback model, not the primary CLAUDE_QUEUE_MODEL', () => {
    const fallbackModelUses = (
      WORKFLOW_SOURCE.match(/--model \$\{\{ steps\.auth\.outputs\.runtime_fallback_model \}\}/g) ??
      []
    ).length;
    assert.equal(
      fallbackModelUses,
      2,
      'expected exactly the two runtime fallback steps to use the fallback model',
    );
  });

  test('the oauth->api runtime fallback step authenticates with the api key, and the api->oauth one with the oauth token', () => {
    const oauthFallbackMatch = WORKFLOW_SOURCE.match(
      /id: fallback-oauth-to-api\n([\s\S]*?)\n {6}- name:/,
    );
    assert.ok(oauthFallbackMatch, 'fallback-oauth-to-api step not found');
    assert.match(
      oauthFallbackMatch[1],
      /anthropic_api_key: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/,
    );
    assert.doesNotMatch(oauthFallbackMatch[1], /claude_code_oauth_token:/);

    const apiFallbackMatch = WORKFLOW_SOURCE.match(
      /id: fallback-api-to-oauth\n([\s\S]*?)\n {6}- name: Write job summary/,
    );
    assert.ok(apiFallbackMatch, 'fallback-api-to-oauth step not found');
    assert.match(
      apiFallbackMatch[1],
      /claude_code_oauth_token: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}/,
    );
    assert.doesNotMatch(apiFallbackMatch[1], /anthropic_api_key:/);
  });

  test('job summary reports both primary and both fallback step outcomes', () => {
    assert.match(WORKFLOW_SOURCE, /steps\.run-oauth\.outcome/);
    assert.match(WORKFLOW_SOURCE, /steps\.run-api\.outcome/);
    assert.match(WORKFLOW_SOURCE, /steps\.fallback-oauth-to-api\.outcome/);
    assert.match(WORKFLOW_SOURCE, /steps\.fallback-api-to-oauth\.outcome/);
  });
});
