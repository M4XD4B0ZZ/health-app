import { Dispatcher, ProxyAgent } from 'undici';

type BenchmarkEnvironment = Partial<Record<string, string | undefined>>;

type DispatcherRequestInit = RequestInit & { dispatcher?: Dispatcher };

/**
 * Benchmark-local HTTP transport for Anthropic Messages calls.
 *
 * Node's fetch does not automatically honor proxy environment variables. This factory keeps the
 * proxy decision scoped to the B/C benchmark adapters and passes a dispatcher per request rather
 * than mutating Node's global dispatcher. Proxy values are intentionally never logged or exposed.
 */
export class AnthropicBenchmarkTransport {
  readonly usesProxy: boolean;

  constructor(private readonly dispatcher?: Dispatcher) {
    this.usesProxy = dispatcher !== undefined;
  }

  fetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    const requestInit: DispatcherRequestInit = this.dispatcher
      ? { ...init, dispatcher: this.dispatcher }
      : init;
    return fetch(input, requestInit);
  }
}

/**
 * Uses the conventional HTTPS proxy first, then HTTP and ALL proxy fallbacks for the HTTPS
 * Anthropic endpoint. Only the presence of a non-empty value influences this decision; values
 * may contain credentials and must never be emitted in diagnostics.
 */
export function createAnthropicBenchmarkTransport(
  env: BenchmarkEnvironment = process.env,
): AnthropicBenchmarkTransport {
  const proxyUrl = selectProxyUrl(env);
  if (!proxyUrl) return new AnthropicBenchmarkTransport();

  try {
    return new AnthropicBenchmarkTransport(new ProxyAgent(proxyUrl));
  } catch {
    throw new Error('Anthropic benchmark proxy configuration is invalid.');
  }
}

function selectProxyUrl(env: BenchmarkEnvironment): string | undefined {
  return [
    env.HTTPS_PROXY,
    env.https_proxy,
    env.HTTP_PROXY,
    env.http_proxy,
    env.ALL_PROXY,
    env.all_proxy,
  ].find((value) => Boolean(value?.trim()));
}
