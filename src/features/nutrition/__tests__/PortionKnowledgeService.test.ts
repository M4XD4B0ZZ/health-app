import { PortionHint } from '../domain/portion/PortionHint';
import {
  InMemoryPortionHintRepository,
  PortionKnowledgeService,
} from '../domain/portion/PortionKnowledgeService';
import { SEED_PORTION_HINTS } from '../domain/portion/seedPortionHints';
import { resolveFoodIdentityKey } from '../domain/portion/foodIdentity';

describe('PortionKnowledgeService', () => {
  it('resolves carrot aliases to the same food identity key', () => {
    expect(resolveFoodIdentityKey('karotte')).toBe('canonical:carrot');
    expect(resolveFoodIdentityKey('karotten')).toBe('canonical:carrot');
    expect(resolveFoodIdentityKey('möhren')).toBe('canonical:carrot');
    expect(resolveFoodIdentityKey('möhren')).toBe(resolveFoodIdentityKey('karotte'));
  });

  it('uses the same seed hint for carrot aliases through identity + unit lookup', async () => {
    const service = new PortionKnowledgeService(
      new InMemoryPortionHintRepository(SEED_PORTION_HINTS),
    );

    for (const alias of ['karotte', 'karotten', 'möhre', 'möhren']) {
      const foodIdentityKey = resolveFoodIdentityKey(alias);
      expect(foodIdentityKey).toBe('canonical:carrot');

      const hint = await service.lookup({ foodIdentityKey: foodIdentityKey!, unit: 'piece' });
      expect(hint).toMatchObject({
        foodIdentityKey: 'canonical:carrot',
        unit: 'piece',
        gramsPerUnit: 60,
        source: 'seed',
      });
    }
  });

  it('lets a user-private confirmed hint outrank the seed hint without promoting it globally', async () => {
    const service = new PortionKnowledgeService(
      new InMemoryPortionHintRepository(SEED_PORTION_HINTS),
    );

    const savedHint = await service.confirmUserPrivateHint({
      foodIdentityKey: 'canonical:carrot',
      unit: 'piece',
      gramsPerUnit: 80,
      userId: 'user-1',
    });

    expect(savedHint).toMatchObject({
      foodIdentityKey: 'canonical:carrot',
      unit: 'piece',
      gramsPerUnit: 80,
      source: 'user_confirmed',
      visibility: 'user_private',
      reviewStatus: 'pending',
    });
    expect(savedHint.visibility).not.toBe('global_verified');

    expect(
      await service.lookup({
        foodIdentityKey: 'canonical:carrot',
        unit: 'piece',
        userId: 'user-1',
      }),
    ).toMatchObject({ gramsPerUnit: 80, visibility: 'user_private' });
    expect(
      await service.lookup({ foodIdentityKey: 'canonical:carrot', unit: 'piece' }),
    ).toMatchObject({
      gramsPerUnit: 60,
      source: 'seed',
    });
  });

  it('enforces lookup priority across user-private, global verified, trusted source, and seed hints', async () => {
    const hints: PortionHint[] = [
      ...SEED_PORTION_HINTS,
      {
        foodIdentityKey: 'canonical:banana',
        unit: 'piece',
        gramsPerUnit: 125,
        source: 'bls',
        visibility: 'global_candidate',
        reviewStatus: 'none',
        confidence: 0.85,
        evidenceCount: 3,
      },
      {
        foodIdentityKey: 'canonical:banana',
        unit: 'piece',
        gramsPerUnit: 130,
        source: 'research',
        visibility: 'global_verified',
        reviewStatus: 'approved',
        confidence: 0.9,
        evidenceCount: 5,
      },
    ];
    const service = new PortionKnowledgeService(new InMemoryPortionHintRepository(hints));

    expect(
      await service.lookup({ foodIdentityKey: 'canonical:banana', unit: 'piece' }),
    ).toMatchObject({
      gramsPerUnit: 130,
      visibility: 'global_verified',
    });

    await service.confirmUserPrivateHint({
      foodIdentityKey: 'canonical:banana',
      unit: 'piece',
      gramsPerUnit: 140,
      userId: 'user-1',
      reviewStatus: 'none',
    });

    expect(
      await service.lookup({
        foodIdentityKey: 'canonical:banana',
        unit: 'piece',
        userId: 'user-1',
      }),
    ).toMatchObject({
      gramsPerUnit: 140,
      visibility: 'user_private',
      reviewStatus: 'none',
    });
  });
});
