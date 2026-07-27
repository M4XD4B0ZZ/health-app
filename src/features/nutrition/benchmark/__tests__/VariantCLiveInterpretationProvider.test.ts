import { describe, it, expect, afterEach, jest } from '@jest/globals';
import {
  createLiveVariantCInterpreter,
  VariantCLiveProviderConfigError,
} from '../VariantCLiveInterpretationProvider';
import { LiveProviderBudgetGate } from '../LiveProviderBudgetGate';
import { resolverV3047Candidate } from '../ResolverV3047Candidates';

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
    [
      {
        pricingVersion: 'test-pricing-v1',
        modelId: 'claude-haiku-4-5',
        currency: 'USD',
        inputPerMillion: 1,
        outputPerMillion: 5,
      },
      {
        modelId: 'claude-haiku-4-5-20251001',
        pricingVersion: 'test-pricing-v1',
        currency: 'USD',
        inputPerMillion: 1,
        outputPerMillion: 5,
      },
    ],
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

it.each(['H0', 'H1', 'H2'] as const)('uses the closed %s request and parser path', async (id) => {
  const candidate = resolverV3047Candidate(id);
  const fetch = jest.fn(
    async (_url: string, _init?: RequestInit) =>
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
  const call = await createLiveVariantCInterpreter(
    { ANTHROPIC_API_KEY: 'test-key-not-real' },
    budgetGate(),
    { fetch, usesProxy: false },
    candidate,
  ).interpret({ rawInput: 'Food', locale: 'de' });
  const payload = JSON.parse(String(fetch.mock.calls[0][1]?.body));
  expect(payload).toMatchObject({
    model: candidate.modelSnapshot,
    system: candidate.prompt,
    temperature: 0,
  });
  expect(payload.output_config.format.schema).toStrictEqual(candidate.schema);
  expect(call.runMeta.runIdentity).toStrictEqual({
    candidateId: candidate.id,
    candidateVersion: candidate.version,
    promptVersion: candidate.promptVersion,
    schemaVersion: candidate.schemaVersion,
    routingVersion: candidate.routingVersion,
    modelId: candidate.modelSnapshot,
    pricingVersion: 'test-pricing-v1',
  });
  expect(call.result.outcome).toBe('not_interpretable');
});

const interpretWith = async (
  fetch: (input: RequestInfo | URL, init: RequestInit) => Promise<Response>,
) =>
  createLiveVariantCInterpreter({ ANTHROPIC_API_KEY: 'test-key-not-real' }, budgetGate(), {
    fetch,
    usesProxy: false,
  }).interpret({ rawInput: 'Apfel', normalizedInput: 'Apfel', locale: 'de' });

describe('RESOLVER-V3-046 provider failure taxonomy', () => {
  it('retains the complete immutable identity on transport failure', async () => {
    const candidate = resolverV3047Candidate('H2');
    const interpreter = createLiveVariantCInterpreter(
      { ANTHROPIC_API_KEY: 'test-key-not-real' },
      budgetGate(),
      {
        fetch: jest.fn(async () => {
          throw new TypeError('offline');
        }),
        usesProxy: false,
      },
      candidate,
    );
    expect(Object.isFrozen(interpreter.runIdentity)).toBe(true);
    const call = await interpreter.interpret({ rawInput: 'Apfel', locale: 'de' });
    expect(call.runMeta.runIdentity).toBe(interpreter.runIdentity);
    expect(call.runMeta.runIdentity).toMatchObject({
      candidateId: 'H2',
      modelId: candidate.modelSnapshot,
      pricingVersion: 'test-pricing-v1',
    });
  });

  it('computes known snapshot cost from the same exact pricing entry used by reservation', async () => {
    const call = await createLiveVariantCInterpreter(
      { ANTHROPIC_API_KEY: 'test-key-not-real' },
      budgetGate(),
      {
        fetch: jest.fn(
          async () =>
            new Response(
              JSON.stringify({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ outcome: 'not_interpretable', reason: 'fixture' }),
                  },
                ],
                usage: { input_tokens: 2, output_tokens: 3 },
              }),
              { status: 200 },
            ),
        ),
        usesProxy: false,
      },
      resolverV3047Candidate('H1'),
    ).interpret({ rawInput: 'Apfel', locale: 'de' });
    expect(call.runMeta).toMatchObject({ costUsd: 0.000017, pricingStatus: 'estimated' });
  });

  it('blocks an unknown exact model before dispatch', () => {
    const fetch = jest.fn(async () => new Response('{}'));
    expect(() =>
      createLiveVariantCInterpreter(
        { ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_VARIANT_C_MODEL: 'unknown-model' },
        budgetGate(),
        { fetch, usesProxy: false },
      ),
    ).toThrow('exact model pricing');
    expect(fetch).not.toHaveBeenCalled();
  });
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
    ['null envelope', null],
    ['array envelope', []],
    ['missing content', { usage: { input_tokens: 2, output_tokens: 1 } }],
    ['object content', { content: {}, usage: { input_tokens: 2, output_tokens: 1 } }],
    ['null content block', { content: [null], usage: { input_tokens: 2, output_tokens: 1 } }],
    [
      'non-string block type',
      { content: [{ type: 7, text: '{}' }], usage: { input_tokens: 2, output_tokens: 1 } },
    ],
    [
      'non-string text',
      { content: [{ type: 'text', text: {} }], usage: { input_tokens: 2, output_tokens: 1 } },
    ],
    [
      'missing usage',
      { content: [{ type: 'text', text: JSON.stringify({ outcome: 'not_interpretable' }) }] },
    ],
    [
      'null usage',
      {
        content: [{ type: 'text', text: JSON.stringify({ outcome: 'not_interpretable' }) }],
        usage: null,
      },
    ],
  ])('fails closed for a structurally invalid HTTP 200 %s', async (_name, body) => {
    const call = await interpretWith(
      jest.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    );
    expect(call).toMatchObject({
      result: { outcome: 'error' },
      runMeta: {
        failureKind: 'http_envelope_contract_error',
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
      },
    });
  });

  it.each([
    ['string input', { input_tokens: '2', output_tokens: 1 }],
    ['negative input', { input_tokens: -1, output_tokens: 1 }],
    ['fractional output', { input_tokens: 2, output_tokens: 1.5 }],
    ['array output', { input_tokens: 2, output_tokens: [] }],
    [
      'invalid cache token',
      { input_tokens: 2, output_tokens: 1, cache_creation_input_tokens: null },
    ],
  ])('rejects %s usage without producing NaN or zero cost', async (_name, usage) => {
    const call = await interpretWith(
      jest.fn(
        async () =>
          new Response(
            JSON.stringify({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ outcome: 'not_interpretable', reason: 'fixture' }),
                },
              ],
              usage,
            }),
            { status: 200 },
          ),
      ),
    );
    expect(call.runMeta.failureKind).toBe('http_envelope_contract_error');
    expect(call.runMeta.costUsd).toBeNull();
    expect(Number.isNaN(call.runMeta.costUsd)).toBe(false);
  });

  it('accepts finite non-negative integer usage, including a large safe integer', async () => {
    const call = await interpretWith(
      jest.fn(
        async () =>
          new Response(
            JSON.stringify({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ outcome: 'not_interpretable', reason: 'fixture' }),
                },
              ],
              usage: {
                input_tokens: Number.MAX_SAFE_INTEGER,
                output_tokens: 0,
                cache_read_input_tokens: 3,
              },
            }),
            { status: 200 },
          ),
      ),
    );
    expect(call.runMeta).toMatchObject({
      failureKind: null,
      inputTokens: Number.MAX_SAFE_INTEGER,
      outputTokens: 0,
      cacheReadTokens: 3,
    });
    expect(Number.isFinite(call.runMeta.costUsd)).toBe(true);
  });

  it.each([
    ['fetch exception', async () => Promise.reject(new TypeError('fetch failed'))],
    ['envelope JSON error', async () => new Response('{', { status: 200 })],
    ['HTTP error', async () => new Response('{}', { status: 500 })],
    ['envelope contract error', async () => new Response('null', { status: 200 })],
    [
      'valid response',
      async () =>
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
    ],
  ])('releases a reservation exactly once after %s', async (_name, fetch) => {
    const release = jest.fn();
    const gate = { reserve: jest.fn(() => ({ release })) } as unknown as LiveProviderBudgetGate;
    const interpreter = createLiveVariantCInterpreter(
      { ANTHROPIC_API_KEY: 'test-key-not-real' },
      gate,
      { fetch: jest.fn(fetch), usesProxy: false },
    );
    await interpreter.interpret({ rawInput: 'Apfel', locale: 'de' });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases exactly once when envelope processing throws unexpectedly', async () => {
    const release = jest.fn();
    const envelope = Object.defineProperty({}, 'content', {
      get: () => {
        throw new Error('unexpected getter failure');
      },
    });
    const interpreter = createLiveVariantCInterpreter(
      { ANTHROPIC_API_KEY: 'test-key-not-real' },
      { reserve: () => ({ release }) } as unknown as LiveProviderBudgetGate,
      {
        fetch: jest.fn(
          async () => ({ ok: true, status: 200, json: async () => envelope }) as Response,
        ),
        usesProxy: false,
      },
    );
    await expect(interpreter.interpret({ rawInput: 'Apfel', locale: 'de' })).rejects.toThrow(
      'unexpected getter failure',
    );
    expect(release).toHaveBeenCalledTimes(1);
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
