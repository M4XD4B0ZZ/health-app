/**
 * Injected SHA-256-class digest port for the V2 candidate fingerprint (RESOLVER-V3-031 §7). The
 * application layer depends only on this interface, never on a concrete Expo/Node digest API
 * directly — that keeps the fingerprint computation usable from both the app and a future
 * server-only worker (RESOLVER-V3-033/034) without either depending on the other's runtime.
 */
export interface ResolverKnowledgeFingerprintHasher {
  /** Returns the lowercase hex-encoded SHA-256 digest of `input`. */
  sha256Hex(input: string): Promise<string>;
}
