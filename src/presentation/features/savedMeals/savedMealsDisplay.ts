import {
  SavedMealTemplate,
  SavedMealItem,
} from '../../../features/nutrition/domain/models/SavedMealTypes';
import type { FoodEntry } from '../../../features/nutrition';
import {
  buildGroupQuantitySubtitle,
  formatNumber,
  KnownCountPortion,
} from '../journal/journalEntryDisplay';

/**
 * SM-005: approximate total calories for a template, computed from the frozen per100g
 * snapshots (SM-002) of its items. Purely factual (no evaluation) — items without a
 * snapshot are skipped rather than treated as zero. Returns null if no item has one.
 */
export function templateTotalCalories(template: SavedMealTemplate): number | null {
  const known = template.items.filter((item) => item.per100g);
  if (known.length === 0) {
    return null;
  }
  return known.reduce((sum, item) => sum + (item.per100g!.calories * item.quantityGrams) / 100, 0);
}

/**
 * SM-008: one presentation group of a Saved Meal — a distinct **food identity**, not a stored
 * journal-event record. Several stored items sharing a valid canonical identity are aggregated
 * here for display only; the persisted template items are never merged or rewritten.
 */
export interface SavedMealPresentationGroup {
  /** Canonical identity key (`source:sourceId`) or a per-item key when no valid identity exists. */
  key: string;
  /** User-friendly food name (from the item's parsedName, never a raw catalog string). */
  name: string;
  /** Aggregated grams across the group's stored items. */
  grams: number;
  /**
   * „7 Stück (420 g)" when a known count portion divides cleanly, otherwise „420 g" — reuses the
   * exact J-009/J-010/J-011 rules (never reverse-infers a count from explicit grams).
   */
  quantityLabel: string;
  /** Aggregated calories from the group's frozen per100g snapshots; null if none carry one. */
  calories: number | null;
}

export interface SavedMealComposition {
  /** Number of distinct food identities (Product decision: „Lebensmittel", not event records). */
  uniqueFoodCount: number;
  /** Sum of all groups' calories (== templateTotalCalories). */
  totalCalories: number | null;
  /** Presentation groups, in the order of each group's first stored member (stable). */
  groups: SavedMealPresentationGroup[];
}

/**
 * SM-008 / decision 8 (same trustworthy identity principle as J-009): group only stored items
 * that share a valid `foodCatalogRef` identity. Items without one stay their own group — never a
 * name-based fallback merge, and different `foodCatalogRef`s are never merged even if their names
 * look similar.
 */
function savedMealItemIdentityKey(item: SavedMealItem, index: number): string {
  const ref = item.foodCatalogRef;
  if (ref && ref.source && ref.sourceId) return `${ref.source}:${ref.sourceId}`;
  return `item:${index}`;
}

function capitalize(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase('de-DE') + trimmed.slice(1);
}

// buildGroupQuantitySubtitle only reads `rawInput` + `grams`/`quantityGrams`. Saved Meal items
// carry no rawInput, so an empty one lets the known-count-portion path apply (a count is
// reconstructed only when it divides cleanly — J-010/J-011), without an explicit-grams override.
function toQuantityAdapter(item: SavedMealItem): FoodEntry {
  return {
    rawInput: '',
    grams: item.quantityGrams,
    quantityGrams: item.quantityGrams,
  } as unknown as FoodEntry;
}

/**
 * SM-008: derive the composition-aware presentation of a Saved Meal from its stored items,
 * grouping by canonical identity and aggregating quantities/calories deterministically. Pure and
 * read-only — it never mutates the template. `resolveKnownCountPortion` is supplied by the screen
 * (it looks up portion knowledge asynchronously, like the Journal's Stück display).
 */
export function buildSavedMealComposition(
  template: SavedMealTemplate,
  resolveKnownCountPortion: (item: SavedMealItem) => KnownCountPortion | undefined,
): SavedMealComposition {
  const order: string[] = [];
  const byKey = new Map<string, SavedMealItem[]>();

  template.items.forEach((item, index) => {
    const key = savedMealItemIdentityKey(item, index);
    const existing = byKey.get(key);
    if (existing) {
      existing.push(item);
    } else {
      byKey.set(key, [item]);
      order.push(key);
    }
  });

  const groups: SavedMealPresentationGroup[] = order.map((key) => {
    const items = byKey.get(key)!;
    const grams = items.reduce((sum, item) => sum + item.quantityGrams, 0);
    const knownCountPortion = resolveKnownCountPortion(items[0]);
    const quantityLabel =
      buildGroupQuantitySubtitle(items.map(toQuantityAdapter), () => knownCountPortion) ??
      `${formatNumber(grams)} g`;

    const withSnapshot = items.filter((item) => item.per100g);
    const calories =
      withSnapshot.length === 0
        ? null
        : Math.round(
            withSnapshot.reduce(
              (sum, item) => sum + (item.per100g!.calories * item.quantityGrams) / 100,
              0,
            ),
          );

    return { key, name: capitalize(items[0].parsedName), grams, quantityLabel, calories };
  });

  return {
    uniqueFoodCount: groups.length,
    totalCalories: templateTotalCalories(template),
    groups,
  };
}

/**
 * SM-008: the compact one-line preview shown on the card (foods + aggregated quantities), e.g.
 * „Ei · 7 Stück (420 g)" or „Ei · 2 Stück (120 g), Magerquark · 200 g". Kept short — the full
 * per-group breakdown (with calories) is the expandable detail.
 */
export function formatSavedMealPreview(composition: SavedMealComposition): string {
  return composition.groups.map((group) => `${group.name} · ${group.quantityLabel}`).join(', ');
}

/**
 * SM-008: the card summary line — distinct-food count + approximate total, e.g.
 * „1 Lebensmittel · ~575 kcal". „Lebensmittel" is invariant in German (no inflection engine).
 */
export function formatSavedMealSummary(composition: SavedMealComposition): string {
  const foods = `${composition.uniqueFoodCount} Lebensmittel`;
  return composition.totalCalories !== null
    ? `${foods} · ~${Math.round(composition.totalCalories)} kcal`
    : foods;
}
