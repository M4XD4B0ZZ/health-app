import { describe, it, expect, jest } from '@jest/globals';
import {
  createLiveVariantBProvider,
  VariantBLiveProviderConfigError,
} from '../VariantBLiveProvider';

/**
 * RESOLVER-V3-004: live-mode credential-guard tests only. No network call is exercised here --
 * these tests assert `createLiveVariantBProvider()` fails clearly and secret-free when
 * `ANTHROPIC_API_KEY` is missing, and never falls back to a fixture provider.
 */

describe('createLiveVariantBProvider', () => {
  it('throws a precise, secret-free error when ANTHROPIC_API_KEY is not set', () => {
    expect(() => createLiveVariantBProvider({})).toThrow(VariantBLiveProviderConfigError);
    try {
      createLiveVariantBProvider({});
      fail('expected createLiveVariantBProvider to throw');
    } catch (e) {
      expect((e as Error).message).toMatch(/ANTHROPIC_API_KEY/);
      expect((e as Error).message).not.toMatch(/sk-/); // no leaked key material
    }
  });

  it('constructs a live provider when ANTHROPIC_API_KEY is set, without making a network call', () => {
    const provider = createLiveVariantBProvider({ ANTHROPIC_API_KEY: 'test-key-not-real' });
    expect(provider.runMode).toBe('live');
    expect(provider.providerId).toBe('anthropic');
  });

  it('honors an overridden model id from the environment', () => {
    const provider = createLiveVariantBProvider({
      ANTHROPIC_API_KEY: 'test-key-not-real',
      ANTHROPIC_VARIANT_B_MODEL: 'claude-custom-model',
    });
    expect(provider.modelId).toBe('claude-custom-model');
  });

  it('reports pricing as "unknown" (never a stale/guessed rate) for an overridden model', () => {
    const provider = createLiveVariantBProvider({
      ANTHROPIC_API_KEY: 'test-key-not-real',
      ANTHROPIC_VARIANT_B_MODEL: 'claude-custom-model',
    });
    const { costUsd, pricingStatus } = provider.computeCostUsd({
      inputTokens: 100,
      outputTokens: 50,
    });
    expect(pricingStatus).toBe('unknown');
    expect(costUsd).toBeNull();
  });

  it('reports pricing as "estimated" (never silently 0) for the default pinned model', () => {
    const provider = createLiveVariantBProvider({ ANTHROPIC_API_KEY: 'test-key-not-real' });
    const { costUsd, pricingStatus } = provider.computeCostUsd({
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(pricingStatus).toBe('estimated');
    expect(costUsd).toBeGreaterThan(0);
  });

  it('reports pricing as "unknown" when no usage is available at all', () => {
    const provider = createLiveVariantBProvider({ ANTHROPIC_API_KEY: 'test-key-not-real' });
    const { costUsd, pricingStatus } = provider.computeCostUsd(null);
    expect(pricingStatus).toBe('unknown');
    expect(costUsd).toBeNull();
  });
});

// Ensure this suite genuinely never calls the network -- if `fetch` were invoked here, it would
// fail hard against a real endpoint under test isolation, which is exactly what we want to
// prevent silently.
describe('no accidental network calls from this suite', () => {
  it('never touches global.fetch during construction or cost computation', () => {
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    // @ts-expect-error -- test double
    global.fetch = fetchSpy;
    try {
      const provider = createLiveVariantBProvider({ ANTHROPIC_API_KEY: 'test-key-not-real' });
      provider.computeCostUsd({ inputTokens: 10, outputTokens: 10 });
    } finally {
      global.fetch = originalFetch;
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
