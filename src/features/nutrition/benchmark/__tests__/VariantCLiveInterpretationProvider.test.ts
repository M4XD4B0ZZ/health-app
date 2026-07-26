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

it('sends an explicit deterministic sampling payload through the injected transport', async () => {
  const fetch = jest.fn(
    async (_url: string, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ outcome: 'not_interpretable', reason: 'fixture' }),
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200 },
      ),
  );
  const interpreter = createLiveVariantCInterpreter(
    { ANTHROPIC_API_KEY: 'test-key-not-real' },
    budgetGate(),
    { fetch, usesProxy: false },
  );

  await interpreter.interpret({ rawInput: '  APFEL  ', normalizedInput: 'apfel', locale: 'de' });

  expect(fetch).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(String(fetch.mock.calls[0][1]?.body));
  expect(payload.temperature).toBe(0);
  expect(payload.messages[0].content).toContain('"apfel"');
  expect(payload.messages[0].content).not.toContain('"  APFEL  "');
});
