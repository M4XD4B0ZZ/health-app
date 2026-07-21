import { ResolverKnowledgeShadowCorpusRegistry } from '../application/shadow/ResolverKnowledgeShadowCorpusRegistry';
import { RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION } from '../domain/models/ResolverKnowledgeShadowCorpusRegistry';

const manifest = () => ({
  registryVersion: RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
  entries: [
    { caseId: 'case-dev-1', partition: 'development' as const },
    { caseId: 'case-holdout-1', partition: 'holdout' as const },
  ],
});

describe('ResolverKnowledgeShadowCorpusRegistry', () => {
  it('keeps a development case registered as development across separate registry instances', () => {
    const registryA = new ResolverKnowledgeShadowCorpusRegistry(manifest());
    const registryB = new ResolverKnowledgeShadowCorpusRegistry(manifest());
    expect(registryA.partitionFor('case-dev-1')).toBe('development');
    expect(registryB.partitionFor('case-dev-1')).toBe('development');
  });

  it('keeps a holdout case registered as holdout across separate registry instances', () => {
    const registryA = new ResolverKnowledgeShadowCorpusRegistry(manifest());
    const registryB = new ResolverKnowledgeShadowCorpusRegistry(manifest());
    expect(registryA.partitionFor('case-holdout-1')).toBe('holdout');
    expect(registryB.partitionFor('case-holdout-1')).toBe('holdout');
  });

  it('fails closed when a manifest lists the same case ID in both partitions', () => {
    const invalid = {
      registryVersion: RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
      entries: [
        { caseId: 'dup', partition: 'development' as const },
        { caseId: 'dup', partition: 'holdout' as const },
      ],
    };
    expect(() => new ResolverKnowledgeShadowCorpusRegistry(invalid)).toThrow(
      'SHADOW_REGISTRY_CASE_IN_MULTIPLE_PARTITIONS',
    );
  });

  it('fails closed when a manifest lists the same case ID twice in the same partition', () => {
    const invalid = {
      registryVersion: RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION,
      entries: [
        { caseId: 'dup', partition: 'development' as const },
        { caseId: 'dup', partition: 'development' as const },
      ],
    };
    expect(() => new ResolverKnowledgeShadowCorpusRegistry(invalid)).toThrow(
      'SHADOW_REGISTRY_CASE_IN_MULTIPLE_PARTITIONS',
    );
  });

  it('fails closed on an unknown registry version', () => {
    expect(
      () =>
        new ResolverKnowledgeShadowCorpusRegistry({
          registryVersion: 'resolver-knowledge-shadow-corpus-registry-v99' as any,
          entries: [],
        }),
    ).toThrow('SHADOW_REGISTRY_UNKNOWN_VERSION');
  });

  it('is deterministic across recreated instances built from the same immutable manifest', () => {
    const sharedManifest = manifest();
    const registryA = new ResolverKnowledgeShadowCorpusRegistry(sharedManifest);
    const registryB = new ResolverKnowledgeShadowCorpusRegistry(sharedManifest);
    for (const entry of sharedManifest.entries) {
      expect(registryA.partitionFor(entry.caseId)).toBe(registryB.partitionFor(entry.caseId));
    }
  });

  it('reports unregistered case IDs as undefined rather than guessing a partition', () => {
    const registry = new ResolverKnowledgeShadowCorpusRegistry(manifest());
    expect(registry.partitionFor('never-registered')).toBeUndefined();
    expect(registry.has('never-registered')).toBe(false);
  });

  it('exposes the registry version used', () => {
    const registry = new ResolverKnowledgeShadowCorpusRegistry(manifest());
    expect(registry.version).toBe(RESOLVER_KNOWLEDGE_SHADOW_CORPUS_REGISTRY_VERSION);
  });

  it('never mutates the manifest it was constructed from', () => {
    const sharedManifest = manifest();
    const before = JSON.parse(JSON.stringify(sharedManifest));
    // eslint-disable-next-line no-new
    new ResolverKnowledgeShadowCorpusRegistry(sharedManifest);
    expect(sharedManifest).toEqual(before);
  });
});
