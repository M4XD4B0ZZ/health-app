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

const SECRET_NAME_BY_MODE = { oauth: 'CLAUDE_CODE_OAUTH_TOKEN', api: 'ANTHROPIC_API_KEY' };

/**
 * Pure decision function. `hasOauthToken` / `hasApiKey` must be booleans (presence only),
 * never the secret values themselves.
 *
 * `authModeFallback` (optional) is a second mode to use, deterministically, when the primary
 * mode's own secret is absent — decided here, before any Claude turn starts. This is a
 * config-level fallback only: it never re-runs a Claude turn that already started, so it cannot
 * cause the same queue transition to be attempted twice in one invocation.
 */
export function resolveAuthDecision({
  authMode,
  model,
  hasOauthToken,
  hasApiKey,
  authModeFallback,
}) {
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

  const fallback = (authModeFallback || '').trim();
  if (fallback) {
    if (!VALID_AUTH_MODES.has(fallback)) {
      return {
        ok: false,
        message:
          'CLAUDE_QUEUE_AUTH_MODE_FALLBACK is set but is not a valid value (expected "oauth" or "api"). Stopping before the Claude Code Action step.',
      };
    }
    if (fallback === authMode) {
      return {
        ok: false,
        message:
          'CLAUDE_QUEUE_AUTH_MODE_FALLBACK must differ from CLAUDE_QUEUE_AUTH_MODE. Stopping before the Claude Code Action step.',
      };
    }
  }

  const hasSecretFor = (mode) => (mode === 'oauth' ? hasOauthToken : hasApiKey);

  if (hasSecretFor(authMode)) {
    return {
      ok: true,
      effectiveMode: authMode,
      usedFallback: false,
      message: `Auth precheck passed for mode "${authMode}".`,
    };
  }

  if (fallback && hasSecretFor(fallback)) {
    return {
      ok: true,
      effectiveMode: fallback,
      usedFallback: true,
      message: `CLAUDE_QUEUE_AUTH_MODE=${authMode} but ${SECRET_NAME_BY_MODE[authMode]} is not set; falling back to mode "${fallback}" (CLAUDE_QUEUE_AUTH_MODE_FALLBACK), whose secret is present.`,
    };
  }

  const fallbackHint = fallback
    ? ` A fallback mode "${fallback}" is configured via CLAUDE_QUEUE_AUTH_MODE_FALLBACK, but ${SECRET_NAME_BY_MODE[fallback]} is not set either.`
    : '';
  return {
    ok: false,
    message: `CLAUDE_QUEUE_AUTH_MODE=${authMode} but the ${SECRET_NAME_BY_MODE[authMode]} repository secret is not set.${fallbackHint} Stopping before the Claude Code Action step.`,
  };
}

function main() {
  const authMode = (process.env.CLAUDE_QUEUE_AUTH_MODE || '').trim();
  const authModeFallback = (process.env.CLAUDE_QUEUE_AUTH_MODE_FALLBACK || '').trim();
  const model = process.env.CLAUDE_QUEUE_MODEL || '';
  const hasOauthToken = Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN);
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  const decision = resolveAuthDecision({
    authMode,
    model,
    hasOauthToken,
    hasApiKey,
    authModeFallback,
  });
  console.log(decision.message);

  const outPath = process.env.GITHUB_OUTPUT;
  if (outPath) {
    appendFileSync(outPath, `auth_ok=${decision.ok}\n`);
    appendFileSync(outPath, `effective_mode=${decision.ok ? decision.effectiveMode : ''}\n`);
    appendFileSync(outPath, `used_fallback=${decision.ok ? decision.usedFallback : false}\n`);
  }

  if (!decision.ok) {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
