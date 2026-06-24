import { PortionHint, PortionHintLookup, PortionHintUnit } from './PortionHint';

export interface PortionHintRepository {
  findByFoodIdentityAndUnit(lookup: PortionHintLookup): PortionHint[];
  saveUserPrivateHint(hint: PortionHint): PortionHint;
}

export class InMemoryPortionHintRepository implements PortionHintRepository {
  private hints: PortionHint[];

  constructor(seedHints: PortionHint[] = []) {
    this.hints = [...seedHints];
  }

  findByFoodIdentityAndUnit(lookup: PortionHintLookup): PortionHint[] {
    return this.hints.filter(
      (hint) => hint.foodIdentityKey === lookup.foodIdentityKey && hint.unit === lookup.unit,
    );
  }

  saveUserPrivateHint(hint: PortionHint): PortionHint {
    const privateHint: PortionHint = {
      ...hint,
      source: 'user_confirmed',
      visibility: 'user_private',
      reviewStatus: hint.reviewStatus === 'approved' ? 'pending' : hint.reviewStatus,
    };

    this.hints = [
      privateHint,
      ...this.hints.filter(
        (existing) =>
          !(
            existing.foodIdentityKey === privateHint.foodIdentityKey &&
            existing.unit === privateHint.unit &&
            existing.visibility === 'user_private' &&
            existing.userId === privateHint.userId
          ),
      ),
    ];

    return privateHint;
  }
}

export class PortionKnowledgeService {
  constructor(private readonly repository: PortionHintRepository) {}

  lookup(lookup: PortionHintLookup): PortionHint | null {
    const hints = this.repository.findByFoodIdentityAndUnit(lookup);

    return (
      this.findUserPrivateHint(hints, lookup.userId) ??
      this.findGlobalVerifiedHint(hints) ??
      this.findTrustedSourceHint(hints) ??
      this.findSeedHint(hints) ??
      null
    );
  }

  confirmUserPrivateHint(args: {
    foodIdentityKey: string;
    unit: PortionHintUnit;
    gramsPerUnit: number;
    userId: string;
    confidence?: number;
    reviewStatus?: PortionHint['reviewStatus'];
    now?: string;
  }): PortionHint {
    return this.repository.saveUserPrivateHint({
      foodIdentityKey: args.foodIdentityKey,
      unit: args.unit,
      gramsPerUnit: args.gramsPerUnit,
      source: 'user_confirmed',
      visibility: 'user_private',
      reviewStatus: args.reviewStatus ?? 'pending',
      confidence: args.confidence ?? 1,
      evidenceCount: 1,
      userId: args.userId,
      createdAt: args.now,
      updatedAt: args.now,
    });
  }

  private findUserPrivateHint(hints: PortionHint[], userId?: string): PortionHint | null {
    if (!userId) {
      return null;
    }

    return (
      hints.find(
        (hint) =>
          hint.visibility === 'user_private' &&
          hint.source === 'user_confirmed' &&
          hint.userId === userId,
      ) ?? null
    );
  }

  private findGlobalVerifiedHint(hints: PortionHint[]): PortionHint | null {
    return hints.find((hint) => hint.visibility === 'global_verified') ?? null;
  }

  private findTrustedSourceHint(hints: PortionHint[]): PortionHint | null {
    return (
      hints.find(
        (hint) =>
          hint.visibility !== 'user_private' &&
          (hint.source === 'bls' || hint.source === 'off' || hint.source === 'usda'),
      ) ?? null
    );
  }

  private findSeedHint(hints: PortionHint[]): PortionHint | null {
    return hints.find((hint) => hint.source === 'seed') ?? null;
  }
}
