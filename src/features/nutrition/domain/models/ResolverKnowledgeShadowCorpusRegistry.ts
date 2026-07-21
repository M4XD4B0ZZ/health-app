import type { ResolverKnowledgeShadowCorpusPartition } from './ResolverKnowledgeShadowEvaluation';

/**
 * Reproducible corpus-registry manifest contract (RESOLVER-V3-029 §9). Replaces the one-call-only
 * `Set` as the sole partition protection: a manifest is a plain, immutable, versioned data value that
 * deterministically binds each stable case ID to exactly one partition. Reconstructing a registry from
 * the same source-controlled manifest in a fresh process always yields identical partition
 * assignments — reproducibility comes from the manifest being durable repository data, not from any
 * runtime cache, database, or module-global mutable state.
 */
export const RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION =
  'resolver-knowledge-shadow-corpus-registry-v1' as const;

export interface ResolverKnowledgeShadowCorpusRegistryEntry {
  caseId: string;
  partition: ResolverKnowledgeShadowCorpusPartition;
}

export interface ResolverKnowledgeShadowCorpusRegistryManifest {
  registryVersion: typeof RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION;
  entries: readonly ResolverKnowledgeShadowCorpusRegistryEntry[];
}
