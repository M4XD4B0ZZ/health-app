import { createHash } from 'node:crypto';
import type { ResolverKnowledgeFingerprintHasher } from '../../application/ports/ResolverKnowledgeFingerprintHasher';

/**
 * Concrete SHA-256-capable adapter for `ResolverKnowledgeFingerprintHasher` (RESOLVER-V3-031 §7).
 *
 * Uses Node's built-in `crypto` module rather than `expo-crypto`. This is a deliberate placement
 * decision, not an oversight: `expo-crypto`'s `digestStringAsync` is a client-side/Expo-native
 * API, but the V2 fingerprint's actual execution boundary — per the accepted operational-boundary
 * design (`docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md`
 * §16/§17/§19) — is the future server-only aggregation worker (RESOLVER-V3-033/034), which will
 * run under Node, never inside the Expo app. Depending on `expo-crypto` here would make that
 * future server-only worker depend on an Expo-only contract, which the binding requirements for
 * this task explicitly forbid. `node:crypto` is never imported by domain or application code —
 * only by this isolated, currently-unwired infrastructure adapter, matching the injected
 * hasher-port pattern (`ResolverKnowledgeFingerprintHasher`) so the app could still supply a
 * different (e.g. Expo-based) adapter later without changing the application layer.
 *
 * Not registered in the DI container and not called by any production code path.
 */
export class NodeCryptoResolverKnowledgeFingerprintHasher implements ResolverKnowledgeFingerprintHasher {
  async sha256Hex(input: string): Promise<string> {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }
}
