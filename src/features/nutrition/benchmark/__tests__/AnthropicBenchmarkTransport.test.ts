import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { getGlobalDispatcher } from 'undici';
import {
  AnthropicBenchmarkTransport,
  createAnthropicBenchmarkTransport,
} from '../AnthropicBenchmarkTransport';
import { createLiveVariantBProvider } from '../VariantBLiveProvider';
import { createLiveVariantCInterpreter } from '../VariantCLiveInterpretationProvider';
import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';

describe('AnthropicBenchmarkTransport', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses direct transport when no standard proxy variable is configured', async () => {
    const fetchSpy = jest
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response('{}'));
    global.fetch = fetchSpy;

    const transport = createAnthropicBenchmarkTransport({});
    await transport.fetch('https://api.anthropic.com/v1/messages', { method: 'POST' });

    expect(transport.usesProxy).toBe(false);
    expect(fetchSpy.mock.calls[0]![1]).not.toHaveProperty('dispatcher');
  });

  it('uses a per-request proxy dispatcher when a standard proxy variable is configured', async () => {
    const fetchSpy = jest
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response('{}'));
    global.fetch = fetchSpy;

    const transport = createAnthropicBenchmarkTransport({ HTTPS_PROXY: 'http://127.0.0.1:8080' });
    await transport.fetch('https://api.anthropic.com/v1/messages', { method: 'POST' });

    expect(transport.usesProxy).toBe(true);
    expect(fetchSpy.mock.calls[0]![1]).toHaveProperty('dispatcher');
  });

  it('does not leak proxy URLs or credentials through configuration errors or logs', () => {
    const proxyUrl = 'not a proxy url user:password@example.invalid';
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => createAnthropicBenchmarkTransport({ HTTPS_PROXY: proxyUrl })).toThrow(
      'Anthropic benchmark proxy configuration is invalid.',
    );
    try {
      createAnthropicBenchmarkTransport({ HTTPS_PROXY: proxyUrl });
    } catch (error) {
      expect((error as Error).message).not.toContain(proxyUrl);
      expect((error as Error).message).not.toContain('password');
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('never mutates Undici global dispatcher state', () => {
    const dispatcherBefore = getGlobalDispatcher();
    createAnthropicBenchmarkTransport({ HTTPS_PROXY: 'http://127.0.0.1:8080' });
    createAnthropicBenchmarkTransport({});
    expect(getGlobalDispatcher()).toBe(dispatcherBefore);
  });

  it('keeps the transport contract benchmark-local', () => {
    expect(new AnthropicBenchmarkTransport()).toBeInstanceOf(AnthropicBenchmarkTransport);
  });

  it('routes both live adapters through the shared factory after reserving the budget', async () => {
    const fetchSpy = jest
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'dummy response' } }), { status: 401 }),
      );
    global.fetch = fetchSpy;
    const gate = new LiveProviderBudgetGate(
      {
        currency: 'USD',
        maxCalls: 2,
        maxInputTokens: 20_000,
        maxOutputTokens: 20_000,
        maxCost: 1,
        maxInFlight: 1,
      },
      [{ modelId: 'claude-haiku-4-5', currency: 'USD', inputPerMillion: 1, outputPerMillion: 5 }],
    );
    const env = {
      ANTHROPIC_API_KEY: 'test-key-not-real',
      HTTPS_PROXY: 'http://127.0.0.1:8080',
    };

    const providerB = createLiveVariantBProvider(env, gate);
    const interpreterC = createLiveVariantCInterpreter(env, gate);
    await providerB.call({
      caseId: 'transport-test',
      rawInput: '1 Apfel',
      locale: 'de',
      runIndex: 0,
      traceId: 'transport-test-b',
      promptVersion: 'test',
      schemaVersion: 'test',
    });
    await interpreterC.interpret({
      rawInput: '1 Apfel',
      locale: 'de',
      traceId: 'transport-test-c',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]![1]).toHaveProperty('dispatcher');
    expect(fetchSpy.mock.calls[1]![1]).toHaveProperty('dispatcher');
    expect(gate.snapshot()).toMatchObject({ calls: 2, inFlight: 0 });
  });
});
