import { createHash } from 'node:crypto';
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION } from './RepresentativeHybridV1Types';

/**
 * RESOLVER-V3-038 frozen source-snapshot manifest (requirement 12). Every non-BLS external
 * ground-truth/retrieval-catalog fixture used by the successor corpus is declared here, once, with
 * its retrieval date, content hash, and covered case IDs -- the benchmark never fetches external
 * data at runtime (requirement 20/§9 leakage-freeze). BLS itself is not listed here: it is the
 * existing, separately-committed `src/features/nutrition/infrastructure/catalog/sources/bls/
 * generated/bls-runtime-compact.v1.json` artifact, read unmodified via the real `BlsStaticSource`.
 *
 * Honesty note (residual limitation, carried into the readiness report): the manufacturer-label and
 * official-restaurant-data snapshots below are reconstructed from general, widely-published
 * nutrition-label knowledge current as of authoring (2026-07-22), not re-verified against a live
 * fetch during this task (the task forbids runtime network access). They are committed, versioned,
 * structured, minimal factual snapshots (nutrient values + identity), never full copyrighted
 * webpages, and are clearly labeled as such rather than presented as independently re-scraped.
 */

export type RepresentativeHybridV1SourceSnapshotKind =
  | 'ground_truth'
  | 'retrieval_catalog'
  | 'both';

export interface RepresentativeHybridV1SourceSnapshot {
  snapshotId: string;
  sourceType: 'manufacturer_label' | 'official_restaurant_data';
  /** Human-readable description of the reference, not a URL fetched at runtime. */
  externalReference: string;
  retrievalDate: string;
  contentHash: string;
  localeRegion: string;
  coveredCaseIds: readonly string[];
  licenseNote: string;
  kind: RepresentativeHybridV1SourceSnapshotKind;
  nutrientsPer100g: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    sugar_g?: number;
    salt_g?: number;
  };
  productName: string;
  brand?: string;
}

function sha256Of(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function snapshot(
  input: Omit<RepresentativeHybridV1SourceSnapshot, 'contentHash'>,
): RepresentativeHybridV1SourceSnapshot {
  const contentHash = sha256Of(
    JSON.stringify({
      snapshotId: input.snapshotId,
      productName: input.productName,
      brand: input.brand ?? null,
      nutrientsPer100g: input.nutrientsPer100g,
    }),
  );
  return { ...input, contentHash };
}

export const REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS: readonly RepresentativeHybridV1SourceSnapshot[] =
  [
    snapshot({
      snapshotId: 'manufacturer-label-nutella-v1',
      sourceType: 'manufacturer_label',
      externalReference:
        'Ferrero Nutella EU nutrition declaration (standard label panel, per 100g).',
      retrievalDate: '2026-07-22',
      localeRegion: 'DE',
      coveredCaseIds: ['RH-RES-BRANDED-DEV-001', 'RH-RES-BRANDED-DEV-003'],
      licenseNote:
        'Minimal structured nutrient facts only, no verbatim label text/imagery reproduced.',
      kind: 'both',
      productName: 'Nutella',
      brand: 'Ferrero',
      nutrientsPer100g: { kcal: 539, protein_g: 6.3, fat_g: 30.9, carbs_g: 57.5, sugar_g: 56.3 },
    }),
    snapshot({
      snapshotId: 'manufacturer-label-coca-cola-v1',
      sourceType: 'manufacturer_label',
      externalReference:
        'Coca-Cola (regular) EU nutrition declaration (standard label panel, per 100ml).',
      retrievalDate: '2026-07-22',
      localeRegion: 'DE',
      coveredCaseIds: ['RH-RES-BRANDED-DEV-002'],
      licenseNote: 'Minimal structured nutrient facts only.',
      kind: 'both',
      productName: 'Coca-Cola',
      brand: 'The Coca-Cola Company',
      nutrientsPer100g: { kcal: 42, protein_g: 0, fat_g: 0, carbs_g: 10.6, sugar_g: 10.6 },
    }),
    snapshot({
      snapshotId: 'manufacturer-label-coca-cola-zero-v1',
      sourceType: 'manufacturer_label',
      externalReference:
        'Coca-Cola Zero Sugar EU nutrition declaration (standard label panel, per 100ml).',
      retrievalDate: '2026-07-22',
      localeRegion: 'DE',
      coveredCaseIds: ['RH-RES-BRANDED-HOLD-001'],
      licenseNote: 'Minimal structured nutrient facts only.',
      kind: 'both',
      productName: 'Coca-Cola Zero Sugar',
      brand: 'The Coca-Cola Company',
      nutrientsPer100g: { kcal: 0.3, protein_g: 0, fat_g: 0, carbs_g: 0.1, sugar_g: 0 },
    }),
    snapshot({
      snapshotId: 'manufacturer-label-milka-alpenmilch-v1',
      sourceType: 'manufacturer_label',
      externalReference:
        'Milka Alpenmilch chocolate EU nutrition declaration (standard label panel, per 100g).',
      retrievalDate: '2026-07-22',
      localeRegion: 'DE',
      coveredCaseIds: ['RH-RES-BRANDED-DEV-004', 'RH-RES-BRANDED-HOLD-002'],
      licenseNote: 'Minimal structured nutrient facts only.',
      kind: 'both',
      productName: 'Milka Alpenmilch',
      brand: 'Mondelez',
      nutrientsPer100g: { kcal: 534, protein_g: 6.5, fat_g: 30, carbs_g: 58, sugar_g: 57 },
    }),
    snapshot({
      snapshotId: 'official-restaurant-mcdonalds-cheeseburger-de-v1',
      sourceType: 'official_restaurant_data',
      externalReference:
        "McDonald's Germany published nutrition table, Cheeseburger (standard menu item, per 100g).",
      retrievalDate: '2026-07-22',
      localeRegion: 'DE',
      coveredCaseIds: ['RH-RES-RESTAURANT-DEV-001', 'RH-RES-RESTAURANT-HOLD-001'],
      licenseNote: 'Minimal structured nutrient facts only, no menu imagery/branding reproduced.',
      kind: 'both',
      productName: 'Cheeseburger',
      brand: "McDonald's",
      nutrientsPer100g: {
        kcal: 261,
        protein_g: 13.6,
        fat_g: 11.6,
        carbs_g: 26.4,
        sugar_g: 5.8,
        salt_g: 1.5,
      },
    }),
    snapshot({
      snapshotId: 'official-restaurant-subway-veggie-delite-de-v1',
      sourceType: 'official_restaurant_data',
      externalReference:
        'Subway Germany published nutrition table, 15cm Veggie Delite on Italian bread (per 100g).',
      retrievalDate: '2026-07-22',
      localeRegion: 'DE',
      coveredCaseIds: ['RH-RES-RESTAURANT-DEV-002'],
      licenseNote: 'Minimal structured nutrient facts only.',
      kind: 'both',
      productName: 'Veggie Delite 15cm (Italian bread)',
      brand: 'Subway',
      nutrientsPer100g: {
        kcal: 190,
        protein_g: 7.2,
        fat_g: 2.8,
        carbs_g: 33.5,
        sugar_g: 4.1,
        salt_g: 1.0,
      },
    }),
  ];

export function representativeHybridV1SourceSnapshotById(
  snapshotId: string,
): RepresentativeHybridV1SourceSnapshot | undefined {
  return REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS.find((s) => s.snapshotId === snapshotId);
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Deterministic, order-independent hash of the whole frozen source-snapshot manifest (requirement
 * 12/26/46) -- sorts snapshots by ID first, then hashes their canonically key-ordered JSON. */
export function computeRepresentativeHybridV1SourceManifestHash(
  snapshots: readonly RepresentativeHybridV1SourceSnapshot[] = REPRESENTATIVE_HYBRID_V1_SOURCE_SNAPSHOTS,
): string {
  const sorted = [...snapshots].sort((a, b) => a.snapshotId.localeCompare(b.snapshotId));
  const canonical = sorted.map((snapshot) => JSON.stringify(sortKeysDeep(snapshot)));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export const REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH =
  computeRepresentativeHybridV1SourceManifestHash();

export { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_VERSION };
