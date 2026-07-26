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

const interpretWith = async (
  fetch: (input: RequestInfo | URL, init: RequestInit) => Promise<Response>,
) =>
  createLiveVariantCInterpreter({ ANTHROPIC_API_KEY: 'test-key-not-real' }, budgetGate(), {
    fetch,
    usesProxy: false,
  }).interpret({ rawInput: 'Apfel', normalizedInput: 'Apfel', locale: 'de' });

describe('RESOLVER-V3-046 provider failure taxonomy', () => {
  it.each([
    ['transport_error', new TypeError('fetch failed')],
    ['timeout_abort', Object.assign(new Error('aborted'), { name: 'AbortError' })],
  ])('classifies %s before an HTTP response', async (failureKind, error) => {
    const call = await interpretWith(
      jest.fn(async () => {
        throw error;
      }),
    );
    expect(call).toMatchObject({
      result: { outcome: 'error' },
      runMeta: { httpStatus: null, failureKind, retryable: true },
    });
  });

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
  ])('classifies HTTP %i with retryable=%s', async (status, retryable) => {
    const call = await interpretWith(
      jest.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'provider rejected request' } }), {
            status,
          }),
      ),
    );
    expect(call.runMeta).toMatchObject({
      httpStatus: status,
      failureKind: 'http_error',
      retryable,
    });
  });

  it('distinguishes invalid HTTP-envelope JSON on HTTP 200', async () => {
    const call = await interpretWith(
      jest.fn(async () => new Response('not-json', { status: 200 })),
    );
    expect(call.runMeta).toMatchObject({
      httpStatus: 200,
      failureKind: 'http_envelope_json_error',
      retryable: false,
    });
  });

  it.each([
    ['missing_text_block', { content: [], usage: { input_tokens: 2, output_tokens: 1 } }],
    [
      'text_block_json_error',
      { content: [{ type: 'text', text: '{' }], usage: { input_tokens: 2, output_tokens: 1 } },
    ],
    [
      'schema_contract_error',
      {
        content: [
          { type: 'text', text: JSON.stringify({ outcome: 'interpreted', components: 'bad' }) },
        ],
        usage: { input_tokens: 2, output_tokens: 1 },
      },
    ],
  ])(
    'classifies HTTP 200 response failure %s and retains reported usage/cost',
    async (failureKind, body) => {
      const call = await interpretWith(
        jest.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
      );
      expect(call).toMatchObject({
        result: { outcome: 'error' },
        runMeta: {
          httpStatus: 200,
          failureKind,
          retryable: false,
          inputTokens: 2,
          outputTokens: 1,
        },
      });
      expect(call.runMeta.costUsd).not.toBeNull();
    },
  );
});
