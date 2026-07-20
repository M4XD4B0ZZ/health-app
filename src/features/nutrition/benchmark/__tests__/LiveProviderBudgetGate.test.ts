import { LiveProviderBudgetGate, LiveProviderBudgetGateError } from '../LiveProviderBudgetGate';

const limits = {
  currency: 'USD' as const,
  maxCalls: 2,
  maxInputTokens: 20,
  maxOutputTokens: 10,
  maxCost: 0.00005,
  maxInFlight: 1,
};
const price = [
  { modelId: 'known', currency: 'USD' as const, inputPerMillion: 1, outputPerMillion: 5 },
];

describe('LiveProviderBudgetGate', () => {
  it('blocks unknown pricing and cost/call/token exhaustion before a request', () => {
    const gate = new LiveProviderBudgetGate(limits, price);
    expect(() => gate.reserve('unknown', 1, 1)).toThrow('unknown model pricing');
    expect(() => gate.reserve('known', 21, 1)).toThrow('input token limit');
    expect(() => gate.reserve('known', 1, 11)).toThrow('output token limit');
    expect(() => gate.reserve('known', 20, 10)).toThrow('reserved worst-case cost');
  });

  it('shares reservations across B and C and counts retries even after failures', () => {
    const gate = new LiveProviderBudgetGate(
      { ...limits, maxCalls: 2, maxInputTokens: 20, maxOutputTokens: 10, maxCost: 1 },
      price,
    );
    gate.reserve('known', 10, 5).release(); // B's failed first attempt still consumes allowance.
    gate.reserve('known', 10, 5).release(); // C (or B retry) consumes the final shared slot.
    expect(() => gate.reserve('known', 1, 1)).toThrow('call limit reached');
    expect(gate.snapshot()).toMatchObject({ calls: 2, inputTokens: 20, outputTokens: 10 });
  });

  it('blocks concurrent request fan-out and refuses a currency conversion it cannot prove', () => {
    const gate = new LiveProviderBudgetGate({ ...limits, maxCost: 1 }, price);
    const reservation = gate.reserve('known', 1, 1);
    expect(() => gate.reserve('known', 1, 1)).toThrow('fan-out limit');
    reservation.release();
    const euroGate = new LiveProviderBudgetGate({ ...limits, currency: 'EUR', maxCost: 5 }, price);
    expect(() => euroGate.reserve('known', 1, 1)).toThrow('currencies differ');
  });

  it('uses secret-free error messages', () => {
    const gate = new LiveProviderBudgetGate(limits, price);
    try {
      gate.reserve('unknown', 1, 1);
    } catch (error) {
      expect(error).toBeInstanceOf(LiveProviderBudgetGateError);
      expect((error as Error).message).not.toMatch(/sk-ant|api[_-]?key/i);
    }
  });
});
