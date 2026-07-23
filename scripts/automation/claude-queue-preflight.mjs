#!/usr/bin/env node
// Deterministic, read-only queue preflight for the QUEUE-005 external wake controller.
//
// This script never mutates GitHub state (no POST/PATCH/PUT/DELETE calls) and never reads
// a Claude secret. It decides whether the Claude queue job should run this tick, and why,
// per docs/automation/CLAUDE_QUEUE_CONTRACT.md. See reports/QUEUE_005_MINIMAL_EXTERNAL_WAKE_CONTROLLER.md
// for the decision table this implements.

import { appendFileSync } from 'node:fs';

export const REASON_CODES = Object.freeze([
  'IDLE_NO_APPROVED_TASK',
  'IDLE_DEPENDENCY_BLOCKED',
  'IDLE_WAITING_CI',
  'IDLE_WAITING_HUMAN_MERGE',
  'ACTION_NEW_TASK',
  'ACTION_RESUME_IMPLEMENTATION',
  'ACTION_CI_FAILED',
  'ACTION_CI_GREEN',
  'ACTION_POST_MERGE',
  'BLOCKED_MULTIPLE_ACTIVE_TASKS',
  'BLOCKED_AMBIGUOUS_STATE',
  'BLOCKED_INVALID_QUEUE_ISSUE',
]);

const ACTIONABLE_CODES = new Set([
  'ACTION_NEW_TASK',
  'ACTION_RESUME_IMPLEMENTATION',
  'ACTION_CI_FAILED',
  'ACTION_CI_GREEN',
  'ACTION_POST_MERGE',
]);

const PHASE_BY_CODE = {
  ACTION_NEW_TASK: 'claim',
  ACTION_RESUME_IMPLEMENTATION: 'implement',
  ACTION_CI_FAILED: 'fix',
  ACTION_CI_GREEN: 'resolve',
  ACTION_POST_MERGE: 'post-merge',
};

const TERMINAL_FAILURE_CONCLUSIONS = ['failure', 'timed_out', 'cancelled', 'action_required'];
const TASK_ID_PATTERN = /^[A-Z][A-Z0-9]*-\d+[A-Z]?$/;

function result(code, { issue = null, issueNumbers = null } = {}) {
  const numbers = issueNumbers ?? (issue ? [issue.number] : []);
  return {
    should_invoke: ACTIONABLE_CODES.has(code),
    reason_code: code,
    issue_number: numbers.join(','),
    task_id: issue?.taskId ?? '',
    phase: PHASE_BY_CODE[code] ?? '',
    pr_number: issue?.pr?.number != null ? String(issue.pr.number) : '',
    head_sha: issue?.pr?.headSha ?? '',
  };
}

/**
 * Summarize a PR's check-runs (current check-runs API, not the legacy combined-status API —
 * see the Claude Queue Contract's "Operational Lessons" on why check-runs are authoritative)
 * into a single state. Returns one of: 'none' | 'queued' | 'in_progress' | 'success' |
 * 'failure' | 'timed_out' | 'cancelled' | 'action_required' | 'mixed'.
 */
export function classifyChecks(checkRuns) {
  if (!Array.isArray(checkRuns) || checkRuns.length === 0) return 'none';
  const incomplete = checkRuns.filter((c) => c.status !== 'completed');
  if (incomplete.length > 0) {
    return incomplete.some((c) => c.status === 'in_progress') ? 'in_progress' : 'queued';
  }
  const conclusions = checkRuns.map((c) => c.conclusion);
  if (conclusions.every((c) => c === 'success')) return 'success';
  for (const failureKind of TERMINAL_FAILURE_CONCLUSIONS) {
    if (conclusions.includes(failureKind)) return failureKind;
  }
  return 'mixed';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractField(body, label) {
  const boldRe = new RegExp(`\\*\\*${escapeRegExp(label)}:?\\*\\*\\s*:?\\s*(.+)`, 'i');
  const boldMatch = body.match(boldRe);
  if (boldMatch) return boldMatch[1].split('\n')[0].trim();

  const headerRe = new RegExp(`###\\s*${escapeRegExp(label)}\\s*\\n+\\s*([^\\n]+)`, 'i');
  const headerMatch = body.match(headerRe);
  if (headerMatch) return headerMatch[1].trim();

  return null;
}

/**
 * Parse the current queue-task issue body format (see .github/ISSUE_TEMPLATE/queue-task.yml).
 * Supports both the GitHub issue-form rendering ("### Label\n\nvalue") and the bold-label
 * paragraph style used by prior queue issues in this repository ("**Label:** value").
 * Malformed or contradictory data (missing Task ID, or an unparseable Dependencies list)
 * produces { malformed: true } rather than a guess.
 */
export function parseQueueIssueBody(body) {
  if (typeof body !== 'string' || body.trim() === '') {
    return { malformed: true, taskId: null, dependencies: [], autoMergeAuthorized: false };
  }

  const taskId = extractField(body, 'Task ID');
  if (!taskId) {
    return { malformed: true, taskId: null, dependencies: [], autoMergeAuthorized: false };
  }

  const depsRaw = extractField(body, 'Dependencies');
  let dependencies = [];
  if (depsRaw && !/^none$/i.test(depsRaw.trim())) {
    dependencies = depsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (dependencies.length === 0 || dependencies.some((d) => !TASK_ID_PATTERN.test(d))) {
      return { malformed: true, taskId, dependencies: [], autoMergeAuthorized: false };
    }
  }

  const mergeAuthRaw = extractField(body, 'Merge authorization');
  const autoMergeAuthorized = !!mergeAuthRaw && /yes/i.test(mergeAuthRaw);

  return { malformed: false, taskId: taskId.trim(), dependencies, autoMergeAuthorized };
}

function dependenciesSatisfied(issue, allIssues) {
  return issue.dependencies.every((dep) =>
    allIssues.some((other) => other.taskId === dep && other.labels.includes('queue:done')),
  );
}

function decideActiveIssue(issue) {
  if (issue.malformed) {
    return result('BLOCKED_INVALID_QUEUE_ISSUE', { issue });
  }

  const hasEvidence = issue.hasStateComment || issue.branchExists || !!issue.pr;
  if (!hasEvidence) {
    return result('BLOCKED_AMBIGUOUS_STATE', { issue });
  }

  if (issue.duplicatePr) {
    return result('BLOCKED_AMBIGUOUS_STATE', { issue });
  }

  if (!issue.pr) {
    return result('ACTION_RESUME_IMPLEMENTATION', { issue });
  }

  if (issue.pr.merged) {
    return result('ACTION_POST_MERGE', { issue });
  }

  if (issue.pr.state === 'closed') {
    // Closed without merging while the issue still carries an active label: contradictory.
    return result('BLOCKED_AMBIGUOUS_STATE', { issue });
  }

  const checksState = classifyChecks(issue.checkRuns);
  switch (checksState) {
    case 'queued':
    case 'in_progress':
      return result('IDLE_WAITING_CI', { issue });
    case 'failure':
    case 'timed_out':
    case 'cancelled':
    case 'action_required':
      return result('ACTION_CI_FAILED', { issue });
    case 'success':
      return issue.autoMergeAuthorized
        ? result('ACTION_CI_GREEN', { issue })
        : result('IDLE_WAITING_HUMAN_MERGE', { issue });
    default:
      // 'none' (no checks reported yet) or 'mixed' (contradictory conclusions): cannot
      // safely proceed without guessing.
      return result('BLOCKED_AMBIGUOUS_STATE', { issue });
  }
}

function decideIdleSelection(issues) {
  const candidates = issues
    .filter(
      (i) =>
        i.state === 'open' &&
        i.labels.includes('queue:approved') &&
        !i.labels.includes('queue:blocked') &&
        !i.labels.includes('queue:needs-human') &&
        !i.labels.includes('queue:done') &&
        !i.labels.includes('risk:human-only'),
    )
    .sort((a, b) => a.number - b.number);

  if (candidates.length === 0) {
    return result('IDLE_NO_APPROVED_TASK');
  }

  let sawDependencyBlock = false;
  for (const issue of candidates) {
    if (issue.malformed) {
      return result('BLOCKED_INVALID_QUEUE_ISSUE', { issue });
    }
    if (!dependenciesSatisfied(issue, issues)) {
      sawDependencyBlock = true;
      continue;
    }
    return result('ACTION_NEW_TASK', { issue });
  }

  return result(sawDependencyBlock ? 'IDLE_DEPENDENCY_BLOCKED' : 'IDLE_NO_APPROVED_TASK');
}

/**
 * Pure decision function — the entire preflight policy. Takes already-fetched, normalized
 * issue records (see buildContext() below for the shape) and returns the stable output
 * fields defined in reports/QUEUE_005_MINIMAL_EXTERNAL_WAKE_CONTROLLER.md. Never performs
 * I/O and never mutates its input.
 */
export function decidePreflight(issues) {
  const active = issues.filter(
    (i) => i.labels.includes('queue:running') || i.labels.includes('queue:waiting-ci'),
  );

  if (active.length > 1) {
    return result('BLOCKED_MULTIPLE_ACTIVE_TASKS', {
      issueNumbers: active.map((i) => i.number).sort((a, b) => a - b),
    });
  }

  if (active.length === 1) {
    return decideActiveIssue(active[0]);
  }

  return decideIdleSelection(issues);
}

// ---------------------------------------------------------------------------------------
// GitHub REST fetch layer (read-only). Only ever issues GET requests. Not exercised by unit
// tests (which inject fixtures directly into decidePreflight/classifyChecks/parseQueueIssueBody);
// this layer is what the workflow's preflight job actually runs against the live repository.
// ---------------------------------------------------------------------------------------

const GITHUB_API = 'https://api.github.com';

async function githubGet(pathname, token, { allow404 = false } = {}) {
  const res = await fetch(`${GITHUB_API}${pathname}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404 && allow404) return null;
  if (!res.ok) {
    throw new Error(`GitHub API GET ${pathname} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Matches a real GitHub auto-close reference ("Closes #160", "fixes: #160", "Resolved #160",
 * case-insensitive) to the given issue number — not a bare "#160" appearing anywhere in text.
 * A prior version of findLinkedPullRequest() searched PR bodies for bare "#<issueNumber>",
 * which false-matched any PR whose description merely *mentioned* the issue for context (e.g.
 * "QUEUE-007's transition stopped at queue:needs-human (issue #160)" in an unrelated fix PR),
 * producing a spurious BLOCKED_AMBIGUOUS_STATE (duplicate PR) that could never resolve itself.
 * Exported for unit testing without needing to mock the search fetch.
 */
export function matchesClosingKeyword(body, issueNumber) {
  const pattern = new RegExp(
    `\\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s*:?\\s*#${issueNumber}\\b`,
    'i',
  );
  return pattern.test(body ?? '');
}

async function findLinkedPullRequest(owner, repo, issueNumber, token) {
  const query = encodeURIComponent(`repo:${owner}/${repo} type:pr in:body #${issueNumber}`);
  const search = await githubGet(`/search/issues?q=${query}&per_page=10`, token);
  const items = (search?.items ?? []).filter((i) => matchesClosingKeyword(i.body, issueNumber));
  const open = items.filter((i) => i.state === 'open');
  const candidates = open.length > 0 ? open : items;
  return { items: candidates, duplicate: candidates.length > 1 };
}

// Labels that make a CLOSED issue still relevant to the queue: `queue:running`/
// `queue:waiting-ci` mean a task is mid-flight (e.g. a human merged its PR out of band —
// GitHub's "Closes #N" auto-close fires at merge time, before the worker's own post-merge
// review/handoff runs, orphaning the issue from a plain state=open fetch), and `queue:done`
// means it may be another issue's declared dependency. Fetched with three narrow REST calls
// (not state=all) so this never pulls in the repo's full closed-issue history.
const CLOSED_ISSUE_RELEVANT_LABELS = ['queue:running', 'queue:waiting-ci', 'queue:done'];

/**
 * Fetches every open issue plus any closed issue still relevant to the queue (see
 * CLOSED_ISSUE_RELEVANT_LABELS), deduplicated by issue number, with pull requests filtered out.
 * Isolated from buildContext()'s per-issue enrichment loop so it's cheaply testable with a
 * mocked fetch — this exact merge logic is what QUEUE-007 found missing (a human-merged PR's
 * "Closes #N" orphaned its issue from a plain state=open fetch).
 */
export async function fetchRelevantIssues({ owner, repo, token }) {
  const openIssues = await githubGet(
    `/repos/${owner}/${repo}/issues?state=open&per_page=100`,
    token,
  );
  const closedRelevantLists = await Promise.all(
    CLOSED_ISSUE_RELEVANT_LABELS.map((label) =>
      githubGet(
        `/repos/${owner}/${repo}/issues?state=closed&labels=${encodeURIComponent(label)}&per_page=100`,
        token,
      ),
    ),
  );
  const byNumber = new Map();
  for (const issue of openIssues ?? []) byNumber.set(issue.number, issue);
  for (const list of closedRelevantLists) {
    for (const issue of list ?? []) byNumber.set(issue.number, issue);
  }
  return [...byNumber.values()].filter((i) => !i.pull_request);
}

async function buildContext({ owner, repo, token }) {
  const issuesOnly = await fetchRelevantIssues({ owner, repo, token });

  const enriched = [];
  for (const issue of issuesOnly) {
    const labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
    const parsed = parseQueueIssueBody(issue.body ?? '');
    const isRelevant =
      labels.includes('queue:running') ||
      labels.includes('queue:waiting-ci') ||
      labels.includes('queue:approved');

    let pr = null;
    let checkRuns = [];
    let branchExists = false;
    let hasStateComment = false;
    let duplicatePr = false;

    if (isRelevant) {
      const { items, duplicate } = await findLinkedPullRequest(owner, repo, issue.number, token);
      duplicatePr = duplicate;
      if (items.length >= 1) {
        const prDetail = await githubGet(`/repos/${owner}/${repo}/pulls/${items[0].number}`, token);
        if (prDetail) {
          pr = {
            number: prDetail.number,
            state: prDetail.state,
            merged: !!prDetail.merged_at,
            headSha: prDetail.head?.sha ?? '',
          };
          const checks = await githubGet(
            `/repos/${owner}/${repo}/commits/${pr.headSha}/check-runs?per_page=100`,
            token,
            { allow404: true },
          );
          checkRuns = checks?.check_runs ?? [];
        }
      }

      if (parsed.taskId) {
        const branch = await githubGet(
          `/repos/${owner}/${repo}/branches/queue%2F${encodeURIComponent(parsed.taskId.toLowerCase())}`,
          token,
          { allow404: true },
        );
        branchExists = !!branch;
      }

      const comments = await githubGet(
        `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100`,
        token,
      );
      hasStateComment = (comments ?? []).some((c) => /task id/i.test(c.body ?? ''));
    }

    enriched.push({
      number: issue.number,
      state: issue.state,
      labels,
      taskId: parsed.taskId,
      dependencies: parsed.dependencies,
      malformed: parsed.malformed,
      autoMergeAuthorized: parsed.autoMergeAuthorized,
      hasStateComment,
      branchExists,
      pr,
      checkRuns,
      duplicatePr,
    });
  }

  return enriched;
}

function writeOutputs(decision) {
  const lines = [
    `should_invoke=${decision.should_invoke}`,
    `reason_code=${decision.reason_code}`,
    `issue_number=${decision.issue_number}`,
    `task_id=${decision.task_id}`,
    `phase=${decision.phase}`,
    `pr_number=${decision.pr_number}`,
    `head_sha=${decision.head_sha}`,
  ];
  const outPath = process.env.GITHUB_OUTPUT;
  if (outPath) {
    appendFileSync(outPath, lines.join('\n') + '\n');
  }
  for (const line of lines) {
    console.log(line);
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY || '';
  const [owner, repo] = repository.split('/');
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    throw new Error(
      'claude-queue-preflight: GITHUB_REPOSITORY and GITHUB_TOKEN must be set (read-only token).',
    );
  }
  const issues = await buildContext({ owner, repo, token });
  const decision = decidePreflight(issues);
  writeOutputs(decision);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(`claude-queue-preflight: ${err.message}`);
    process.exitCode = 1;
  });
}
