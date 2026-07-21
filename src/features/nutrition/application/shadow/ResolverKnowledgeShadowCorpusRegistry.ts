import {
  RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
  type ResolverKnowledgeShadowCorpusRegistryManifest,
} from '../../domain/models/ResolverKnowledgeShadowCorpusRegistry';
import type { ResolverKnowledgeShadowCorpusPartition } from '../../domain/models/ResolverKnowledgeShadowEvaluation';

/**
 * Reproducible, versioned corpus registry (RESOLVER-V3-029 §9). Built from an immutable manifest —
 * plain, source-controlled data, not mutable module-global state — so reconstructing the registry
 * from the same manifest in a separate call, a separate test, or a separate process run always
 * produces identical partition assignments. Construction itself performs no I/O and mutates no
 * production state; it only validates and indexes the manifest it was given.
 */
export class ResolverKnowledgeShadowCorpusRegistry {
  readonly version: typeof RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION;
  private readonly partitionByCaseId: ReadonlyMap<string, ResolverKnowledgeShadowCorpusPartition>;

  constructor(manifest: ResolverKnowledgeShadowCorpusRegistryManifest) {
    if (manifest.registryVersion !== RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION) {
      throw new Error('SHADOW_REGISTRY_UNKNOWN_VERSION');
    }
    const index = new Map<string, ResolverKnowledgeShadowCorpusPartition>();
    for (const entry of manifest.entries) {
      if (index.has(entry.caseId)) {
        throw new Error('SHADOW_REGISTRY_CASE_IN_MULTIPLE_PARTITIONS');
      }
      index.set(entry.caseId, entry.partition);
    }
    this.version = manifest.registryVersion;
    this.partitionByCaseId = index;
  }

  /** Returns the case's registered partition, or `undefined` if it is not registered at all. */
  partitionFor(caseId: string): ResolverKnowledgeShadowCorpusPartition | undefined {
    return this.partitionByCaseId.get(caseId);
  }

  has(caseId: string): boolean {
    return this.partitionByCaseId.has(caseId);
  }
}
