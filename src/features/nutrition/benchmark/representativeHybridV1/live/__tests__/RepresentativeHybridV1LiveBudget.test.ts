import {
  LiveProviderBudgetGate,
  LiveProviderBudgetGateError,
} from '../../../LiveProviderBudgetGate';
import {
  buildRepresentativeHybridV1LiveBudgetLimits,
  createRepresentativeHybridV1LiveBudgetGate,
} from '../RepresentativeHybridV1LiveBudget';
import { REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT } from '../RepresentativeHybridV1LiveVersions';

describe('RESOLVER-V3-039 task-specific budget gate', () => {
  it('computes limits from the execution plan, not from the RESOLVER-V3-013 constants', async () => {
    const limits = await buildRepresentativeHybridV1LiveBudgetLimits();
    // RESOLVER-V3-013's frozen ceiling was exactly 29 calls / USD 5 flat -- this task's corpus is
    // much larger, so its call count must differ (never silently reused).
    expect(limits.maxCalls).not.toBe(29);
    expect(limits.maxInFlight).toBe(1);
    expect(limits.currency).toBe('USD');
    expect(limits.maxCost).toBeLessThanOrEqual(5);
  });

  it('the gate enforces the exact call plan and overflows deterministically', async () => {
    const gate = await createRepresentativeHybridV1LiveBudgetGate();
    const limits = gate.snapshot().limits;
    // maxInFlight=1 -- release each reservation before the next, simulating this protocol's
    // sequential (never concurrent) request pattern.
    for (let i = 0; i < limits.maxCalls; i += 1) {
      let reservation: ReturnType<typeof gate.reserve> | undefined;
      expect(() => {
        reservation = gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1);
      }).not.toThrow();
      reservation?.release();
    }
    expect(() =>
      gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1),
    ).toThrow(LiveProviderBudgetGateError);
  });

  it('token overflow and USD overflow are both blocked pre-request', async () => {
    const gate = new LiveProviderBudgetGate(
      {
        currency: 'USD',
        maxCalls: 100,
        maxInputTokens: 100,
        maxOutputTokens: 100,
        maxCost: 5,
        maxInFlight: 1,
      },
      [{ modelId: 'claude-haiku-4-5', currency: 'USD', inputPerMillion: 1, outputPerMillion: 5 }],
    );
    expect(() => gate.reserve('claude-haiku-4-5', 200, 0)).toThrow(LiveProviderBudgetGateError);

    const costGate = new LiveProviderBudgetGate(
      {
        currency: 'USD',
        maxCalls: 100,
        maxInputTokens: 10_000_000,
        maxOutputTokens: 10_000_000,
        maxCost: 0.001,
        maxInFlight: 1,
      },
      [{ modelId: 'claude-haiku-4-5', currency: 'USD', inputPerMillion: 1, outputPerMillion: 5 }],
    );
    expect(() => costGate.reserve('claude-haiku-4-5', 8_192, 1_536)).toThrow(
      LiveProviderBudgetGateError,
    );
  });

  it('maxInFlight remains 1 -- a second concurrent reservation is blocked until the first releases', async () => {
    const gate = await createRepresentativeHybridV1LiveBudgetGate();
    const reservation = gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1);
    expect(() =>
      gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1),
    ).toThrow(LiveProviderBudgetGateError);
    reservation.release();
    expect(() =>
      gate.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1),
    ).not.toThrow();
  });

  it('a failed request keeps its call/token/cost reservation (no rollback on failure)', async () => {
    const gate = await createRepresentativeHybridV1LiveBudgetGate();
    const before = gate.snapshot();
    const reservation = gate.reserve(
      REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
      100,
      100,
    );
    reservation.release(); // simulates a failed attempt releasing only in-flight slot
    const after = gate.snapshot();
    expect(after.calls).toBe(before.calls + 1);
    expect(after.inputTokens).toBe(before.inputTokens + 100);
    expect(after.reservedCost).toBeGreaterThan(before.reservedCost);
  });

  it('there is no second, hidden budget gate: two independently created gates track separate state', async () => {
    const gateA = await createRepresentativeHybridV1LiveBudgetGate();
    const gateB = await createRepresentativeHybridV1LiveBudgetGate();
    gateA.reserve(REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId, 1, 1);
    expect(gateB.snapshot().calls).toBe(0);
  });
});
