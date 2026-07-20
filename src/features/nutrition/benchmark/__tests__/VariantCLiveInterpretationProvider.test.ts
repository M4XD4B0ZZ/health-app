import { describe, it, expect, afterEach, jest } from '@jest/globals';
import {
  createLiveVariantCInterpreter,
  VariantCLiveProviderConfigError,
} from '../VariantCLiveInterpretationProvider';
import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';

const budgetGate = () =>
  new LiveProviderBudgetGate(
    {
      currency: 'USD',
      maxCalls: 10,
      maxInputTokens: 100_000,
      maxOutputTokens: 100_000,
      maxCost: 1,
      maxInFlight: 1,
    },
    [{ modelId: 'claude-haiku-4-5', currency: 'USD', inputPerMillion: 1, outputPerMillion: 5 }],
  );

describe('createLiveVariantCInterpreter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws a precise, secret-free config error when ANTHROPIC_API_KEY is not set', () => {
    expect(() => createLiveVariantCInterpreter({})).toThrow(VariantCLiveProviderConfigError);
    try {
      createLiveVariantCInterpreter({});
    } catch (e) {
      expect((e as Error).message).not.toMatch(/sk-ant|api[_-]?key\s*[:=]\s*\S+/i);
      expect((e as Error).message).toContain('ANTHROPIC_API_KEY');
    }
  });

  it('never touches global.fetch when credentials are missing', () => {
    const fetchSpy = jest.fn();
    // @ts-expect-error -- test double, not a full fetch implementation
    global.fetch = fetchSpy;

    expect(() => createLiveVariantCInterpreter({})).toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('constructs successfully when ANTHROPIC_API_KEY is present, without making a network call', () => {
    const fetchSpy = jest.fn();
    // @ts-expect-error -- test double
    global.fetch = fetchSpy;

    const interpreter = createLiveVariantCInterpreter(
      { ANTHROPIC_API_KEY: 'test-key-not-real' },
      budgetGate(),
    );
    expect(interpreter).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires the aggregate gate before a live C interpreter can be constructed', () => {
    expect(() => createLiveVariantCInterpreter({ ANTHROPIC_API_KEY: 'test-key-not-real' })).toThrow(
      'required shared aggregate budget gate',
    );
  });
});
