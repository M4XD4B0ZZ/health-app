// Provider adapters for the AI re-ranking benchmark (RESOLVER-V2-007-B).
// Deliberately raw fetch() calls, not provider SDKs -- avoids adding new npm
// dependencies (openai, @google/generative-ai, ...) just for a one-off benchmark
// script. Model IDs are env-var-overridable because they change often; the
// defaults here are a best-effort snapshot and should be checked against each
// provider's current docs before trusting a benchmark run.

const RERANK_SCHEMA = {
  type: 'object',
  properties: {
    reorderedCandidateIds: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
  },
  required: ['reorderedCandidateIds', 'explanation'],
  additionalProperties: false,
};

function buildPrompt(testCase) {
  const candidateLines = testCase.candidates
    .map((c) => `- id="${c.id}" source=${c.source} name="${c.name}" priorScore=${c.score}`)
    .join('\n');
  return (
    `A food-lookup resolver has these low-confidence candidates for the query "${testCase.query}" ` +
    `(locale=${testCase.locale}):\n${candidateLines}\n\n` +
    `Re-rank these candidates by how well they match what a native speaker most likely meant. ` +
    `Do not invent a candidate that isn't listed. Return every input id exactly once, most-likely-match first.`
  );
}

/** Anthropic Claude (e.g. Haiku 4.5) via the Messages API with structured outputs. */
export async function callAnthropic(testCase, { apiKey, model }) {
  const start = performance.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      output_config: {
        format: { type: 'json_schema', schema: RERANK_SCHEMA },
      },
      messages: [{ role: 'user', content: buildPrompt(testCase) }],
    }),
  });
  const latencyMs = performance.now() - start;
  const data = await res.json();
  if (!res.ok) {
    return {
      rawText: null,
      usage: null,
      latencyMs,
      httpError: data?.error?.message || res.statusText,
    };
  }
  const textBlock = data.content?.find((b) => b.type === 'text');
  return {
    rawText: textBlock?.text ?? null,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
    latencyMs,
    httpError: null,
  };
}

/** OpenAI (e.g. GPT-5 Nano / Mini) via Chat Completions with structured outputs. */
export async function callOpenAi(testCase, { apiKey, model }) {
  const start = performance.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(testCase) }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'rerank_result', schema: RERANK_SCHEMA, strict: true },
      },
    }),
  });
  const latencyMs = performance.now() - start;
  const data = await res.json();
  if (!res.ok) {
    return {
      rawText: null,
      usage: null,
      latencyMs,
      httpError: data?.error?.message || res.statusText,
    };
  }
  return {
    rawText: data.choices?.[0]?.message?.content ?? null,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
    latencyMs,
    httpError: null,
  };
}

/** Google Gemini (e.g. Flash Lite) via generateContent with a response schema. */
export async function callGemini(testCase, { apiKey, model }) {
  const start = performance.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(testCase) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RERANK_SCHEMA,
      },
    }),
  });
  const latencyMs = performance.now() - start;
  const data = await res.json();
  if (!res.ok) {
    return {
      rawText: null,
      usage: null,
      latencyMs,
      httpError: data?.error?.message || res.statusText,
    };
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? null;
  return {
    rawText: text,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
    latencyMs,
    httpError: null,
  };
}

/**
 * Provider registry: env var for the API key, env var for an overridable model ID
 * (defaults are a best-effort snapshot -- verify against current provider docs),
 * the call function, and the $/1M-token price table entry used for cost estimates
 * (see reports/AI_RERANKING_PROVIDER_PRICING_2026-07-*.md for where these came from).
 */
export const PROVIDERS = [
  {
    key: 'anthropic-haiku',
    label: 'Claude Haiku 4.5',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_RERANK_MODEL',
    defaultModel: 'claude-haiku-4-5',
    call: callAnthropic,
    price: { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  },
  {
    key: 'openai-gpt5-nano',
    label: 'GPT-5 Nano',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_NANO_RERANK_MODEL',
    defaultModel: 'gpt-5-nano',
    call: callOpenAi,
    price: { inputPerMTok: 0.05, outputPerMTok: 0.4 },
  },
  {
    key: 'openai-gpt5-mini',
    label: 'GPT-5 Mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MINI_RERANK_MODEL',
    defaultModel: 'gpt-5-mini',
    call: callOpenAi,
    price: { inputPerMTok: 0.25, outputPerMTok: 2.0 },
  },
  {
    key: 'gemini-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    apiKeyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_RERANK_MODEL',
    defaultModel: 'gemini-3.1-flash-lite-preview',
    call: callGemini,
    price: { inputPerMTok: 0.25, outputPerMTok: 1.5 },
  },
];
