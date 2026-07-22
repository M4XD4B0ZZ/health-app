import type {
  CanonicalFood,
  FoodCandidate,
  FoodCatalogSource,
  FoodSearchQuery,
} from '../../domain/catalog/FoodCatalogSource';
import {
  REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS,
  type RepresentativeHybridV1SourceSnapshot,
} from './RepresentativeHybridV1SourceSnapshotManifest';

/**
 * RESOLVER-V3-038 benchmark-local source adapter (requirement 20: "deterministic source adapters",
 * "benchmark-local source adapters implementing the real source interface"). Serves the frozen
 * manufacturer-label/official-restaurant-data snapshots from `RepresentativeHybridV1
 * SourceSnapshotManifest.ts` as a real `FoodCatalogSource` -- zero network, deterministic, and
 * queryable by normalized product name substring, exactly like a real branded/restaurant catalog
 * would be, never keyed by benchmark `caseId` (requirement 13: "a source fixture must behave as a
 * reusable catalog, not a case-ID answer map").
 *
 * This does not touch or extend any production source adapter (`OffProvider`, `MockOffSource`,
 * etc.) -- it exists only inside this benchmark's own directory tree.
 */
export class RepresentativeHybridV1SnapshotCatalogSource implements FoodCatalogSource {
  type: 'off' = 'off';

  constructor(
    private readonly snapshots: readonly RepresentativeHybridV1SourceSnapshot[] = REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS,
  ) {}

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    const needle = query.normalized.trim().toLowerCase();
    if (!needle) return [];
    const matches = this.snapshots.filter((snapshot) => {
      const haystacks = [
        snapshot.productName.toLowerCase(),
        snapshot.brand?.toLowerCase() ?? '',
        `${snapshot.brand ?? ''} ${snapshot.productName}`.toLowerCase().trim(),
      ];
      return haystacks.some((h) => h.length > 0 && (h.includes(needle) || needle.includes(h)));
    });

    return matches.map((snapshot) => this.toCandidate(snapshot));
  }

  private toCandidate(snapshot: RepresentativeHybridV1SourceSnapshot): FoodCandidate {
    const food: CanonicalFood = {
      id: snapshot.snapshotId,
      name: snapshot.brand ? `${snapshot.brand} ${snapshot.productName}` : snapshot.productName,
      normalizedName: (snapshot.brand
        ? `${snapshot.brand} ${snapshot.productName}`
        : snapshot.productName
      ).toLowerCase(),
      macrosPer100g: {
        kcal: snapshot.nutrientsPer100g.kcal,
        protein: snapshot.nutrientsPer100g.protein_g,
        carbs: snapshot.nutrientsPer100g.carbs_g,
        fat: snapshot.nutrientsPer100g.fat_g,
      },
      source: 'off',
      sourceId: snapshot.snapshotId,
    };
    return {
      food,
      match: { exact: true, similarity: 1 },
      confidence: 0.95,
      reasons: [`representative-hybrid-v1 committed snapshot: ${snapshot.externalReference}`],
    };
  }
}

/** Sources available to the successor harness's C-arm retrieval by default: BLS (real, unmodified)
 * plus this benchmark's own zero-network manufacturer/restaurant snapshot catalog. Callers may add
 * further sources (e.g. a live-run's real OFF/USDA adapter, injected by V3-039) without changing
 * this module. */
export function buildRepresentativeHybridV1DefaultSourcesByType(): ReadonlyMap<
  'off',
  FoodCatalogSource
> {
  return new Map([['off', new RepresentativeHybridV1SnapshotCatalogSource()]]);
}
