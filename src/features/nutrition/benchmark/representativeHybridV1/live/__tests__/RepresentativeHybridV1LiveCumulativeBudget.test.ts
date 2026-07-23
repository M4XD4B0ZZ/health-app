import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LiveProviderBudgetGateError } from '../../../LiveProviderBudgetGate';
import { RepresentativeHybridV1LiveCallLedger } from '../RepresentativeHybridV1LiveCallLedger';
import {
  buildCallIdVariantIndex,
  reconstructRepresentativeHybridV1LiveCumulativeBudgetGate,
  RepresentativeHybridV1LiveCumulativeBudgetError,
} from '../RepresentativeHybridV1LiveCumulativeBudget';
import { computeRepresentativeHybridV1LiveCallId } from '../RepresentativeHybridV1LiveCallId';
import type {
  RepresentativeHybridV1LiveExecutionPlan,
  RepresentativeHybridV1LivePlannedObservation,
} from '../RepresentativeHybridV1LiveExecutionPlan';
import { REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT } from '../RepresentativeHybridV1LiveVersions';

function tmpLedgerPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3039-cumbudget-'));
  return path.join(dir, 'ledger.jsonl');
}

function planWith(
  observations: RepresentativeHybridV1LivePlannedObservation[],
): RepresentativeHybridV1LiveExecutionPlan {
  return {
    planVersion: '1',
    observations,
    routeClassification: [],
    counts: {
      variantBCalls: 0,
      variantBCallsByPartition: { development: 0, holdout: 0 },
      variantCPrimaryAttempts: 0,
      variantCMaxAiRoutedCalls: 0,
      variantCMaxAiRoutedCallsByPartition: { development: 0, holdout: 0 },
      variantCFastPathAttempts: 0,
      sampleFloorSupplementCount: 0,
    },
    budget: {
      currency: 'USD',
      maxCalls: 0,
      maxInputTokens: 0,
      maxOutputTokens: 0,
      worstCaseReservedCostUsd: 0,
      perRequestCostUsd: 0,
    },
    planHash: 'plan-hash-test',
  };
}

function devB(scenarioId: string, runIndex = 0): RepresentativeHybridV1LivePlannedObservation {
  return {
    scenarioId,
    partition: 'development',
    variant: 'B',
    kind: runIndex === 0 ? 'variant_b_primary' : 'variant_b_consistency',
    runIndex,
    expectedRoute: null,
    isSampleFloorSupplement: false,
  };
}

function holdoutC(scenarioId: string): RepresentativeHybridV1LivePlannedObservation {
  return {
    scenarioId,
    partition: 'holdout',
    variant: 'C',
    kind: 'variant_c_primary',
    runIndex: 0,
    expectedRoute: 'ai_routed',
    isSampleFloorSupplement: false,
  };
}

const smallLimits = {
  currency: 'USD' as const,
  maxCalls: 3,
  maxInputTokens: 3 * 8192,
  maxOutputTokens: 3 * 1536,
  maxCost: 3 * 0.015872,
  maxInFlight: 1,
};

describe('RESOLVER-V3-039 protocol-v2 cumulative budget reconstruction', () => {
  it('Development consumption reduces the allowance a later Holdout process sees', () => {
    const plan = planWith([devB('A'), devB('B'), holdoutC('C')]);
    const callA = computeRepresentativeHybridV1LiveCallId(devB('A'), plan.planHash);
    const callB = computeRepresentativeHybridV1LiveCallId(devB('B'), plan.planHash);
    const ledgerPath = tmpLedgerPath();

    // "Development process": reserves 2 of the 3 total calls.
    const devLedger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    devLedger.record(callA, 'reserved');
    devLedger.record(callA, 'dispatched');
    devLedger.record(callA, 'completed');
    devLedger.record(callB, 'reserved');
    devLedger.record(callB, 'dispatched');
    devLedger.record(callB, 'completed');

    // "Holdout process": a brand-new gate reconstructed from the shared ledger must already show
    // 2/3 calls consumed -- never a fresh 3-call ceiling.
    const holdoutLedger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    const gate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      holdoutLedger,
      plan,
    );
    expect(gate.snapshot().calls).toBe(2);
    // Only 1 call of headroom remains.
    const r1 = gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 8192, 1536);
    r1.release();
    expect(() =>
      gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 8192, 1536),
    ).toThrow(LiveProviderBudgetGateError);
  });

  it('Holdout never receives a fresh full budget: reconstructing twice from the same ledger yields the same consumed state', () => {
    const plan = planWith([devB('A')]);
    const callA = computeRepresentativeHybridV1LiveCallId(devB('A'), plan.planHash);
    const ledgerPath = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    ledger.record(callA, 'reserved');
    ledger.record(callA, 'dispatched');
    ledger.record(callA, 'completed');

    const gate1 = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      ledger,
      plan,
    );
    const gate2 = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      ledger,
      plan,
    );
    expect(gate1.snapshot().calls).toBe(gate2.snapshot().calls);
    expect(gate1.snapshot().calls).toBe(1);
  });

  it('cumulative calls can never exceed the frozen plan ceiling, across any number of replayed prior calls', () => {
    const observations = [devB('A'), devB('B'), holdoutC('C')];
    const plan = planWith(observations);
    const ledgerPath = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    for (const obs of observations) {
      const id = computeRepresentativeHybridV1LiveCallId(obs, plan.planHash);
      ledger.record(id, 'reserved');
      ledger.record(id, 'dispatched');
      ledger.record(id, 'completed');
    }
    const gate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      ledger,
      plan,
    );
    expect(gate.snapshot().calls).toBe(3);
    expect(() =>
      gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1),
    ).toThrow(LiveProviderBudgetGateError);
  });

  it('reserved worst-case cost can never exceed the frozen ceiling after reconstruction', () => {
    const plan = planWith([devB('A'), devB('B'), devB('C')]);
    const ledgerPath = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    for (const obs of [devB('A'), devB('B'), devB('C')]) {
      const id = computeRepresentativeHybridV1LiveCallId(obs, plan.planHash);
      ledger.record(id, 'reserved');
    }
    const gate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      ledger,
      plan,
    );
    expect(gate.snapshot().reservedCost).toBeCloseTo(3 * 0.015872, 10);
    expect(gate.snapshot().reservedCost).toBeLessThanOrEqual(smallLimits.maxCost);
  });

  it('maxInFlight remains 1 after reconstruction -- replay never leaves inFlight elevated', () => {
    const plan = planWith([devB('A'), devB('B')]);
    const ledgerPath = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    for (const obs of [devB('A'), devB('B')]) {
      const id = computeRepresentativeHybridV1LiveCallId(obs, plan.planHash);
      ledger.record(id, 'reserved');
    }
    const gate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      ledger,
      plan,
    );
    expect(gate.snapshot().inFlight).toBe(0);
    const r = gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1);
    expect(() =>
      gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1),
    ).toThrow(LiveProviderBudgetGateError);
    r.release();
  });

  it('a failed/indeterminate call retains its reservation in the reconstructed cumulative state', () => {
    const plan = planWith([devB('A')]);
    const id = computeRepresentativeHybridV1LiveCallId(devB('A'), plan.planHash);
    const ledgerPath = tmpLedgerPath();
    RepresentativeHybridV1LiveCallLedger.open(ledgerPath).record(id, 'reserved');
    // Reopen to trigger indeterminate recovery (never lost, never refunded).
    const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    expect(ledger.stateOf(id)).toBe('indeterminate_after_interruption');
    const gate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      ledger,
      plan,
    );
    expect(gate.snapshot().calls).toBe(1);
  });

  it('no hidden second gate: reconstruction always derives from the same durable ledger, never a parallel in-memory count', () => {
    const plan = planWith([devB('A')]);
    const id = computeRepresentativeHybridV1LiveCallId(devB('A'), plan.planHash);
    const ledgerPathOne = tmpLedgerPath();
    const ledgerPathTwo = tmpLedgerPath();
    RepresentativeHybridV1LiveCallLedger.open(ledgerPathOne).record(id, 'reserved');
    const ledgerOne = RepresentativeHybridV1LiveCallLedger.open(ledgerPathOne);
    const ledgerTwo = RepresentativeHybridV1LiveCallLedger.open(ledgerPathTwo);
    const gateOne = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      ledgerOne,
      plan,
    );
    const gateTwo = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      smallLimits,
      ledgerTwo,
      plan,
    );
    expect(gateOne.snapshot().calls).toBe(1);
    expect(gateTwo.snapshot().calls).toBe(0);
  });

  it('refuses to reconstruct when the ledger references a call ID outside the current frozen plan (drift protection)', () => {
    const plan = planWith([devB('A')]);
    const ledgerPath = tmpLedgerPath();
    const ledger = RepresentativeHybridV1LiveCallLedger.open(ledgerPath);
    ledger.record('call_from_a_different_plan', 'reserved');
    expect(() =>
      reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(smallLimits, ledger, plan),
    ).toThrow(RepresentativeHybridV1LiveCumulativeBudgetError);
  });

  it('buildCallIdVariantIndex maps every observation to its variant for replay-sizing purposes', () => {
    const plan = planWith([devB('A'), holdoutC('B')]);
    const index = buildCallIdVariantIndex(plan);
    expect(index.get(computeRepresentativeHybridV1LiveCallId(devB('A'), plan.planHash))).toBe('B');
    expect(index.get(computeRepresentativeHybridV1LiveCallId(holdoutC('B'), plan.planHash))).toBe(
      'C',
    );
  });
});
