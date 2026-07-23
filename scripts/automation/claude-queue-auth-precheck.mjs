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
 * `authModeFallback` (optional) is a second mode, backed by its own secret, that this repo can
 * fall back to when the primary mode becomes unusable — e.g. an oauth (Pro/Max plan) usage limit
 * being hit. There are two distinct fallback paths:
 *
 * - Config-time fallback: the primary mode's own secret isn't present at all. `effectiveMode`
 *   becomes the fallback mode for the whole run and `usedFallback` is true. No further runtime
 *   fallback is offered, since the fallback mode is already the one in use.
 * - Runtime fallback: the primary mode's secret IS present (so it's used as `effectiveMode`),
 *   but the caller also wants to know whether a distinct fallback mode is available to retry
 *   with if the primary mode's Claude Code Action step itself fails during execution (e.g. a
 *   usage-limit error, which this action does not expose as a distinct, detectable signal — see
 *   `runtimeFallbackMode`/`runtimeFallbackModel`). That retry is safe against duplicating a queue
 *   transition because every invocation is required to reconcile actual GitHub state before
 *   acting (see docs/automation/CLAUDE_QUEUE_CONTRACT.md) — it can only continue or no-op, never
 *   redo completed work.
 *
 * `modelFallback` (optional) is the model to use only when actually running in the fallback
 * mode (config-time or runtime); it defaults to `model` when unset.
 */
export function resolveAuthDecision({
  authMode,
  model,
  hasOauthToken,
  hasApiKey,
  authModeFallback,
  modelFallback,
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
  const resolvedFallbackModel = (modelFallback || '').trim() || model;

  if (hasSecretFor(authMode)) {
    const runtimeFallbackAvailable = Boolean(fallback) && hasSecretFor(fallback);
    return {
      ok: true,
      effectiveMode: authMode,
      usedFallback: false,
      runtimeFallbackMode: runtimeFallbackAvailable ? fallback : '',
      runtimeFallbackModel: runtimeFallbackAvailable ? resolvedFallbackModel : '',
      message:
        `Auth precheck passed for mode "${authMode}".` +
        (runtimeFallbackAvailable
          ? ` Runtime fallback to "${fallback}" is configured and will be tried if this run's Claude Code Action step fails.`
          : ''),
    };
  }

  if (fallback && hasSecretFor(fallback)) {
    return {
      ok: true,
      effectiveMode: fallback,
      usedFallback: true,
      runtimeFallbackMode: '',
      runtimeFallbackModel: '',
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
  const modelFallback = (process.env.CLAUDE_QUEUE_MODEL_FALLBACK || '').trim();
  const hasOauthToken = Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN);
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  const decision = resolveAuthDecision({
    authMode,
    model,
    hasOauthToken,
    hasApiKey,
    authModeFallback,
    modelFallback,
  });
  console.log(decision.message);

  const outPath = process.env.GITHUB_OUTPUT;
  if (outPath) {
    appendFileSync(outPath, `auth_ok=${decision.ok}\n`);
    appendFileSync(outPath, `effective_mode=${decision.ok ? decision.effectiveMode : ''}\n`);
    appendFileSync(outPath, `used_fallback=${decision.ok ? decision.usedFallback : false}\n`);
    appendFileSync(
      outPath,
      `runtime_fallback_mode=${decision.ok ? decision.runtimeFallbackMode : ''}\n`,
    );
    appendFileSync(
      outPath,
      `runtime_fallback_model=${decision.ok ? decision.runtimeFallbackModel : ''}\n`,
    );
  }

  if (!decision.ok) {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
