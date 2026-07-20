import { test } from '@jest/globals';
import { createResolverV3LiveEvidenceBudgetGate } from './LiveProviderBudgetGate';
import { runResolverV3VariantBBenchmark } from './runResolverV3VariantBBenchmark';
import { runResolverV3VariantCBenchmark } from './runResolverV3VariantCBenchmark';

/**
 * Explicit RESOLVER-V3-013 paid-run entry point. It is not matched by the regular Jest suite;
 * only the dedicated CLI invokes it. Both variants receive exactly the same gate instance.
 */
test('RESOLVER-V3-013 — controlled shared-gate B/C live evidence', async () => {
  const budgetGate = createResolverV3LiveEvidenceBudgetGate();
  const variantB = await runResolverV3VariantBBenchmark({ mode: 'live', budgetGate });
  const variantC = await runResolverV3VariantCBenchmark({ mode: 'live', budgetGate });
  const usage = budgetGate.snapshot();

  // eslint-disable-next-line no-console
  console.log(
    `RESOLVER-V3-013 controlled live evidence complete: B=${variantB.report.metrics.caseCount} ` +
      `C=${variantC.report.metrics.caseCount} calls=${usage.calls} inputTokens=${usage.inputTokens} ` +
      `outputTokens=${usage.outputTokens} reservedUsd=${usage.reservedCost}`,
  );
}, 300_000);
