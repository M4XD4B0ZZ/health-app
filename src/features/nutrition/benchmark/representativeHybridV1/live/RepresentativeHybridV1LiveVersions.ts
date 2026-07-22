import {
  VARIANT_B_ESTIMATOR_VERSION,
  VARIANT_B_PROMPT_VERSION,
  VARIANT_B_SCHEMA_VERSION,
} from '../../variantBPrompt';
import { VARIANT_B_CONTRACT_VERSION } from '../../VariantBTypes';
import {
  VARIANT_C_INTERPRETER_VERSION,
  VARIANT_C_PROMPT_VERSION,
  VARIANT_C_SCHEMA_VERSION,
} from '../../variantCPrompt';
import { AI_INTERPRETATION_CONTRACT_VERSION } from '../../../application/ports/AiInterpretationProvider';
import {
  VARIANT_B_MAX_INPUT_TOKENS,
  VARIANT_B_MAX_OUTPUT_TOKENS,
} from '../../VariantBLiveProvider';
import {
  VARIANT_C_MAX_INPUT_TOKENS,
  VARIANT_C_MAX_OUTPUT_TOKENS,
} from '../../VariantCLiveInterpretationProvider';

/**
 * RESOLVER-V3-039: closed version identifiers for the additive live-evidence layer. Distinct from
 * every RESOLVER-V3-038 fixture-report axis (`RepresentativeHybridV1Types.ts`) and every
 * RESOLVER-V3-013 constant (`LiveProviderBudgetGate.ts`) -- this task defines its own protocol and
 * report versions rather than reusing either.
 */
export const REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION =
  'resolver-representative-hybrid-live-protocol-v1';
export const REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_PLAN_VERSION =
  'resolver-representative-hybrid-live-execution-plan-v1';
export const REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION =
  'resolver-representative-hybrid-live-evidence-report-v1';

/** Re-exported so the protocol/report can pin the exact prompt/schema/contract/interpreter
 * versions without a second, drift-prone copy of these literals. */
export const REPRESENTATIVE_HYBRID_V1_LIVE_PINNED_VERSIONS = {
  variantBPromptVersion: VARIANT_B_PROMPT_VERSION,
  variantBSchemaVersion: VARIANT_B_SCHEMA_VERSION,
  variantBEstimatorVersion: VARIANT_B_ESTIMATOR_VERSION,
  variantBContractVersion: VARIANT_B_CONTRACT_VERSION,
  variantCPromptVersion: VARIANT_C_PROMPT_VERSION,
  variantCSchemaVersion: VARIANT_C_SCHEMA_VERSION,
  variantCInterpreterVersion: VARIANT_C_INTERPRETER_VERSION,
  variantCContractVersion: AI_INTERPRETATION_CONTRACT_VERSION,
} as const;

/**
 * Official Anthropic pricing verification (task requirement: verify from an official source only,
 * record source/date, fail closed if unconfirmed). Retrieved 2026-07-22 from
 * https://platform.claude.com/docs/en/about-claude/pricing (redirected from
 * https://docs.claude.com/en/docs/about-claude/pricing) -- "Claude Haiku 4.5" row: Base Input
 * Tokens $1 / MTok, Output Tokens $5 / MTok. This matches the repository's existing
 * `ANTHROPIC_MESSAGES_PRICING`/`ANTHROPIC_HAIKU_PRICE_PER_M_TOKENS` constants exactly -- no drift
 * detected, so those existing constants remain usable unchanged.
 *
 * Model ID verification, same source plus
 * https://platform.claude.com/docs/en/about-claude/models/overview (retrieved 2026-07-22): the
 * repository's `claude-haiku-4-5` literal is the current, available Claude API *alias* for Haiku
 * 4.5, resolving to the pinned snapshot `claude-haiku-4-5-20251001`. Not silently substituted.
 */
export const REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT = {
  providerId: 'anthropic',
  modelId: 'claude-haiku-4-5',
  modelSnapshotId: 'claude-haiku-4-5-20251001',
  currency: 'USD' as const,
  inputPerMillion: 1,
  outputPerMillion: 5,
  sourceUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
  modelIdSourceUrl: 'https://platform.claude.com/docs/en/about-claude/models/overview',
  retrievedAtUtc: '2026-07-22',
} as const;

/** Per-request reservation ceilings for the live protocol. Reuses the exact conservative token
 * ceilings already pinned for B/C live requests (`VariantBLiveProvider.ts`,
 * `VariantCLiveInterpretationProvider.ts`) rather than inventing new ones -- one shared truth for
 * both the existing per-request budget reservation and this task's aggregate plan arithmetic. */
export const REPRESENTATIVE_HYBRID_V1_LIVE_REQUEST_RESERVATION = {
  variantBMaxInputTokens: VARIANT_B_MAX_INPUT_TOKENS,
  variantBMaxOutputTokens: VARIANT_B_MAX_OUTPUT_TOKENS,
  variantCMaxInputTokens: VARIANT_C_MAX_INPUT_TOKENS,
  variantCMaxOutputTokens: VARIANT_C_MAX_OUTPUT_TOKENS,
} as const;

/** V3-040 §4 timeout/retry policy, applied exactly (task explicitly requires 0 automatic
 * retries -- valid because V3-040 allows *at most* one retry, it does not require one). */
export const REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY = {
  perRequestTimeoutMs: 15_000,
  wallClockCeilingMs: 20_000,
  automaticRetries: 0,
} as const;

/** Consistency-protocol minimum observations per overlay scenario (task requirement: "at least
 * three total observations"). */
export const REPRESENTATIVE_HYBRID_V1_LIVE_MIN_OVERLAY_OBSERVATIONS = 3;

/** V3-040 §10 minimum-sample rule. */
export const REPRESENTATIVE_HYBRID_V1_LIVE_MIN_SAMPLE_SIZE = 30;

/** Hard aggregate budget ceiling authorized for RESOLVER-V3-039 (task instruction: "no more than
 * USD 5.00 total provider currency"). */
export const REPRESENTATIVE_HYBRID_V1_LIVE_MAX_AUTHORIZED_COST_USD = 5;
