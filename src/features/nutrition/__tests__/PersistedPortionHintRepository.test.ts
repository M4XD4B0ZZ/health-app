import { FakeKeyValueStore } from '../infrastructure/storage/FakeKeyValueStore';
import { PersistedPortionHintRepository } from '../infrastructure/repositories/PersistedPortionHintRepository';
import { PortionKnowledgeService } from '../domain/portion/PortionKnowledgeService';
import { SEED_PORTION_HINTS } from '../domain/portion/seedPortionHints';

describe('PersistedPortionHintRepository', () => {
  it('persists and reloads user-private hints', async () => {
    const store = new FakeKeyValueStore();
    const service = new PortionKnowledgeService(
      new PersistedPortionHintRepository(store, SEED_PORTION_HINTS),
    );

    const saved = await service.confirmUserPrivateHint({
      foodIdentityKey: 'canonical:radish',
      unit: 'piece',
      gramsPerUnit: 12,
      userId: 'local-user',
      now: '2026-06-25T12:00:00.000Z',
    });

    expect(saved).toMatchObject({
      foodIdentityKey: 'canonical:radish',
      unit: 'piece',
      gramsPerUnit: 12,
      source: 'user_confirmed',
      visibility: 'user_private',
      reviewStatus: 'pending',
      confidence: 0.6,
      evidenceCount: 1,
      userId: 'local-user',
    });

    const reloadedService = new PortionKnowledgeService(
      new PersistedPortionHintRepository(store, SEED_PORTION_HINTS),
    );

    await expect(
      reloadedService.lookup({
        foodIdentityKey: 'canonical:radish',
        unit: 'piece',
        userId: 'local-user',
      }),
    ).resolves.toMatchObject({ gramsPerUnit: 12, visibility: 'user_private' });
  });

  it('keeps user-private hints scoped to the matching user and preserves seed fallback', async () => {
    const store = new FakeKeyValueStore();
    const service = new PortionKnowledgeService(
      new PersistedPortionHintRepository(store, SEED_PORTION_HINTS),
    );

    await service.confirmUserPrivateHint({
      foodIdentityKey: 'canonical:carrot',
      unit: 'piece',
      gramsPerUnit: 80,
      userId: 'user-1',
    });

    await expect(
      service.lookup({ foodIdentityKey: 'canonical:carrot', unit: 'piece', userId: 'user-1' }),
    ).resolves.toMatchObject({ gramsPerUnit: 80, visibility: 'user_private' });

    await expect(
      service.lookup({ foodIdentityKey: 'canonical:carrot', unit: 'piece', userId: 'user-2' }),
    ).resolves.toMatchObject({ gramsPerUnit: 60, source: 'seed' });

    await expect(
      service.lookup({ foodIdentityKey: 'canonical:carrot', unit: 'piece' }),
    ).resolves.toMatchObject({ gramsPerUnit: 60, source: 'seed' });
  });

  it('upserts a user-private hint for the same food unit and user', async () => {
    const store = new FakeKeyValueStore();
    const service = new PortionKnowledgeService(
      new PersistedPortionHintRepository(store, SEED_PORTION_HINTS),
    );

    await service.confirmUserPrivateHint({
      foodIdentityKey: 'canonical:radish',
      unit: 'piece',
      gramsPerUnit: 10,
      userId: 'local-user',
    });

    await service.confirmUserPrivateHint({
      foodIdentityKey: 'canonical:radish',
      unit: 'piece',
      gramsPerUnit: 14,
      userId: 'local-user',
    });

    await expect(
      service.lookup({
        foodIdentityKey: 'canonical:radish',
        unit: 'piece',
        userId: 'local-user',
      }),
    ).resolves.toMatchObject({ gramsPerUnit: 14, visibility: 'user_private' });
  });
});