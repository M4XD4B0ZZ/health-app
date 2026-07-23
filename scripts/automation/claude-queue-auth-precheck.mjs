#!/usr/bin/env node
// Auth precheck for the QUEUE-005 Claude job — runs in the (secret-bearing) claude job,
// before the Claude Code Action step, and fails closed on any missing/invalid configuration.
//
// Security note: resolveAuthDecision() below never receives raw secret values — only
// booleans indicating whether a secret is present — so it cannot print a value, length,
// prefix, or hash even by accident. main() below reads real secrets from the environment
// only to compute those booleans; it never logs process.env or the secret values themselves.

import { appendFileSync } from 'node:fs';

const VALID_AUTH_MODES = new Set(['oauth', 'api']);

/**
 * Pure decision function. `hasOauthToken` / `hasApiKey` must be booleans (presence only),
 * never the secret values themselves.
 */
export function resolveAuthDecision({ authMode, model, hasOauthToken, hasApiKey }) {
  if (!authMode || !VALID_AUTH_MODES.has(authMode)) {
    return {
      ok: false,
      message:
        'CLAUDE_QUEUE_AUTH_MODE is missing or invalid (expected repository variable value "oauth" or "api"). Stopping before the Claude Code Action step.',
    };
  }

  if (!model || model.trim() === '') {
    return {
      ok: false,
      message:
        'CLAUDE_QUEUE_MODEL repository variable is not set. Stopping before the Claude Code Action step.',
    };
  }

  if (authMode === 'oauth' && !hasOauthToken) {
    return {
      ok: false,
      message:
        'CLAUDE_QUEUE_AUTH_MODE=oauth but the CLAUDE_CODE_OAUTH_TOKEN repository secret is not set. Stopping before the Claude Code Action step.',
    };
  }

  if (authMode === 'api' && !hasApiKey) {
    return {
      ok: false,
      message:
        'CLAUDE_QUEUE_AUTH_MODE=api but the ANTHROPIC_API_KEY repository secret is not set. Stopping before the Claude Code Action step.',
    };
  }

  return { ok: true, message: `Auth precheck passed for mode "${authMode}".` };
}

function main() {
  const authMode = (process.env.CLAUDE_QUEUE_AUTH_MODE || '').trim();
  const model = process.env.CLAUDE_QUEUE_MODEL || '';
  const hasOauthToken = Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN);
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  const decision = resolveAuthDecision({ authMode, model, hasOauthToken, hasApiKey });
  console.log(decision.message);

  const outPath = process.env.GITHUB_OUTPUT;
  if (outPath) {
    appendFileSync(outPath, `auth_ok=${decision.ok}\n`);
  }

  if (!decision.ok) {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
