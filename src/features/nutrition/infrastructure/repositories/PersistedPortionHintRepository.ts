import { KeyValueStore } from '../../application/ports/KeyValueStore';
import { PortionHint, PortionHintLookup } from '../../domain/portion/PortionHint';
import { PortionHintRepository } from '../../domain/portion/PortionKnowledgeService';

interface PersistedPortionHintsPayloadV1 {
  version: 1;
  hints: PortionHint[];
}

export class PersistedPortionHintRepository implements PortionHintRepository {
  private static readonly STORAGE_KEY = 'nutrition:portionHints:userPrivate:v1';

  private hints: PortionHint[] = [];
  private isLoaded = false;

  constructor(
    private readonly keyValueStore: KeyValueStore,
    private readonly seedHints: PortionHint[] = [],
  ) {}

  async findByFoodIdentityAndUnit(lookup: PortionHintLookup): Promise<PortionHint[]> {
    await this.ensureLoaded();

    return [...this.seedHints, ...this.hints].filter(
      (hint) => hint.foodIdentityKey === lookup.foodIdentityKey && hint.unit === lookup.unit,
    );
  }

  async saveUserPrivateHint(hint: PortionHint): Promise<PortionHint> {
    await this.ensureLoaded();

    const privateHint: PortionHint = {
      ...hint,
      source: 'user_confirmed',
      visibility: 'user_private',
      reviewStatus: hint.reviewStatus === 'approved' ? 'pending' : hint.reviewStatus,
      confidence: hint.confidence,
      evidenceCount: hint.evidenceCount,
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

    await this.persist();
    return privateHint;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    const raw = await this.keyValueStore.get(PersistedPortionHintRepository.STORAGE_KEY);
    if (!raw) {
      this.isLoaded = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedPortionHintsPayloadV1> | PortionHint[];
      const rawHints = Array.isArray(parsed) ? parsed : parsed.version === 1 ? parsed.hints : [];
      this.hints = Array.isArray(rawHints)
        ? rawHints.filter((hint): hint is PortionHint => this.isPortionHint(hint))
        : [];
    } catch (error) {
      console.error('Failed to parse persisted portion hints:', error);
      this.hints = [];
    }

    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    const payload: PersistedPortionHintsPayloadV1 = {
      version: 1,
      hints: this.hints,
    };
    await this.keyValueStore.set(
      PersistedPortionHintRepository.STORAGE_KEY,
      JSON.stringify(payload),
    );
  }

  private isPortionHint(value: unknown): value is PortionHint {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const hint = value as Partial<PortionHint>;
    return (
      typeof hint.foodIdentityKey === 'string' &&
      (hint.unit === 'piece' || hint.unit === 'slice') &&
      typeof hint.gramsPerUnit === 'number' &&
      Number.isFinite(hint.gramsPerUnit) &&
      hint.gramsPerUnit > 0 &&
      typeof hint.source === 'string' &&
      typeof hint.visibility === 'string' &&
      typeof hint.reviewStatus === 'string' &&
      typeof hint.confidence === 'number' &&
      typeof hint.evidenceCount === 'number'
    );
  }
}
