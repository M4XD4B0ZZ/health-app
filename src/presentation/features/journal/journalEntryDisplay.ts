import type { FoodEntry } from '../../../features/nutrition';
import type { PortionHintUnit } from '../../../features/nutrition/domain/portion/PortionHint';
import { detectCanonicalEntity } from '../../../features/nutrition/domain/detectCanonicalEntity';

type DisplayUnit = 'g' | 'piece' | 'slice' | 'count';

interface ParsedDisplayQuantity {
  count?: number;
  grams?: number;
  unit?: DisplayUnit;
}

export interface FoodEntryDisplay {
  title: string;
  subtitle?: string;
}

/**
 * J-010: a resolved known-count portion (e.g. "1 egg = 60g") for the entry's food identity,
 * looked up ahead of time by the caller (portion knowledge is an async, identity-keyed
 * lookup — this module stays pure/sync, per the plan's "thread it in" design).
 * J-011: only ever used to *derive grams from a count*, never the reverse — see
 * `buildSubtitle`'s explicit-grams guard.
 */
export interface KnownCountPortion {
  unit: PortionHintUnit;
  gramsPerUnit: number;
}

const GERMAN_UNIT_LABELS: Record<
  Exclude<DisplayUnit, 'g'>,
  { singular: string; plural: string }
> = {
  piece: { singular: 'Stück', plural: 'Stück' },
  count: { singular: 'Stück', plural: 'Stück' },
  slice: { singular: 'Scheibe', plural: 'Scheiben' },
};

const NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

const UNIT_ALIASES: Record<string, DisplayUnit> = {
  stück: 'piece',
  stueck: 'piece',
  piece: 'piece',
  pieces: 'piece',
  scheibe: 'slice',
  scheiben: 'slice',
  slice: 'slice',
  slices: 'slice',
};

function formatTitle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  return trimmed.charAt(0).toLocaleUpperCase('de-DE') + trimmed.slice(1);
}

/** Exported for reuse by journalLastSubmitConfirmation.ts (J-008) — same German 1-decimal-comma rounding. */
export function formatNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
}

function formatUnitLabel(unit: Exclude<DisplayUnit, 'g'>, count: number) {
  const labels = GERMAN_UNIT_LABELS[unit];
  return count === 1 ? labels.singular : labels.plural;
}

/** Exported for reuse by journalLastSubmitConfirmation.ts (J-008) — same raw-text count parsing. */
export function parseDisplayQuantity(rawInput: string): ParsedDisplayQuantity {
  const normalized = rawInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return {};

  const gramsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gramm)\b/);
  if (gramsMatch) {
    return {
      grams: Number.parseFloat(gramsMatch[1].replace(',', '.')),
      unit: 'g',
    };
  }

  const numericUnitMatch = normalized.match(
    /^(\d+(?:[.,]\d+)?)\s*(stück|stueck|piece|pieces|scheibe|scheiben|slice|slices)\b/,
  );
  if (numericUnitMatch) {
    return {
      count: Number.parseFloat(numericUnitMatch[1].replace(',', '.')),
      unit: UNIT_ALIASES[numericUnitMatch[2]],
    };
  }

  const numberWordUnitMatch = normalized.match(
    /^(\S+)\s+(stück|stueck|piece|pieces|scheibe|scheiben|slice|slices)\b/,
  );
  if (numberWordUnitMatch && NUMBER_WORDS[numberWordUnitMatch[1]] !== undefined) {
    return {
      count: NUMBER_WORDS[numberWordUnitMatch[1]],
      unit: UNIT_ALIASES[numberWordUnitMatch[2]],
    };
  }

  const countMatch = normalized.match(/^(\d+(?:[.,]\d+)?)\s*x?\s+/);
  if (countMatch) {
    return {
      count: Number.parseFloat(countMatch[1].replace(',', '.')),
      unit: 'count',
    };
  }

  const numberWordMatch = normalized.match(/^(\S+)\s+/);
  if (numberWordMatch && NUMBER_WORDS[numberWordMatch[1]] !== undefined) {
    return {
      count: NUMBER_WORDS[numberWordMatch[1]],
      unit: 'count',
    };
  }

  return {};
}

const KNOWN_COUNT_TOLERANCE = 0.01;

/**
 * J-010: only ever derives a count when grams divides cleanly by the known portion's
 * gramsPerUnit (within floating-point tolerance) — never a fractional "Stück", and never
 * invented when the ratio doesn't land on a whole unit.
 */
function deriveKnownCount(grams: number, gramsPerUnit: number): number | null {
  if (gramsPerUnit <= 0) return null;

  const raw = grams / gramsPerUnit;
  const rounded = Math.round(raw);

  return rounded > 0 && Math.abs(raw - rounded) <= KNOWN_COUNT_TOLERANCE ? rounded : null;
}

/**
 * J-009: a single entry's quantity, classified the same way `buildSubtitle` formats it, but
 * as structured data instead of a string — shared by the single-entry subtitle and the
 * group-header quantity aggregator (`buildGroupQuantitySubtitle`) so both apply the exact
 * same J-010/J-011 rules (count only when semantically present, explicit grams never
 * reverse-derives a count).
 */
type ResolvedEntryQuantity =
  | { kind: 'count'; count: number; unit: Exclude<DisplayUnit, 'g'>; grams: number }
  | { kind: 'grams'; grams: number }
  | { kind: 'none' };

function resolveEntryQuantity(
  rawInput: string,
  grams: number | null | undefined,
  knownCountPortion?: KnownCountPortion,
): ResolvedEntryQuantity {
  if (!grams || grams <= 0) return { kind: 'none' };

  const parsed = parseDisplayQuantity(rawInput);

  // J-011 (correcting J-010): explicit grams is the user's own stated intent — a known count
  // portion is a calculation aid (count -> grams), never license to run that arithmetic in
  // reverse and assert a count nobody stated or observed. Real per-item weights vary too much
  // (carrots, bananas, bread rolls, slices) for a coincidentally clean division to prove a
  // specific count was eaten, so explicit grams always resolves as grams-only, full stop.
  if (parsed.unit === 'g') {
    return { kind: 'grams', grams };
  }

  // A known count portion still applies here — decision 11's consistency goal — but only
  // because a count is genuinely present: either the raw text itself carries no explicit
  // grams (a bare "Ei" resolves through a real count-based default/hint, e.g. count=1 x 60g),
  // or the persisted grams were themselves computed from a count via portion knowledge. That
  // makes recovering the count via division a reconstruction, not an invention.
  if (knownCountPortion) {
    const count = deriveKnownCount(grams, knownCountPortion.gramsPerUnit);
    if (count !== null) {
      return { kind: 'count', count, unit: knownCountPortion.unit, grams };
    }
  }

  if (parsed.count && parsed.count > 0 && parsed.unit) {
    return { kind: 'count', count: parsed.count, unit: parsed.unit, grams };
  }

  return { kind: 'grams', grams };
}

function formatResolvedQuantity(resolved: ResolvedEntryQuantity): string | undefined {
  if (resolved.kind === 'none') return undefined;

  const gramsText = `${formatNumber(resolved.grams)} g`;
  if (resolved.kind === 'grams') return gramsText;

  return `${formatNumber(resolved.count)} ${formatUnitLabel(resolved.unit, resolved.count)} (${gramsText})`;
}

function buildSubtitle(
  rawInput: string,
  grams: number | null | undefined,
  knownCountPortion?: KnownCountPortion,
) {
  return formatResolvedQuantity(resolveEntryQuantity(rawInput, grams, knownCountPortion));
}

/**
 * J-009: aggregates a canonical group's header quantity from its children, applying the same
 * "never invent a count" rule at the group level (decision 11/J-011, requirement 13): shows a
 * combined count only when *every* child resolves to a semantically-present count and all of
 * them share the same unit (e.g. all "piece"); otherwise falls back to summed grams only —
 * never mixes incompatible units into a misleading count, and an explicit-grams child in the
 * mix always forces the grams-only fallback for the whole group.
 */
export function buildGroupQuantitySubtitle(
  children: FoodEntry[],
  resolveKnownCountPortion: (entry: FoodEntry) => KnownCountPortion | undefined,
): string | undefined {
  const resolved = children.map((child) =>
    resolveEntryQuantity(
      child.rawInput,
      child.grams ?? child.quantityGrams,
      resolveKnownCountPortion(child),
    ),
  );

  const totalGrams = resolved.reduce(
    (sum, item) => sum + (item.kind === 'none' ? 0 : item.grams),
    0,
  );
  if (totalGrams <= 0) return undefined;

  const first = resolved[0];
  const allSameCountUnit =
    first?.kind === 'count' &&
    resolved.every((item) => item.kind === 'count' && item.unit === first.unit);

  if (allSameCountUnit && first?.kind === 'count') {
    const totalCount = resolved.reduce(
      (sum, item) => sum + (item.kind === 'count' ? item.count : 0),
      0,
    );
    return `${formatNumber(totalCount)} ${formatUnitLabel(first.unit, totalCount)} (${formatNumber(totalGrams)} g)`;
  }

  return `${formatNumber(totalGrams)} g`;
}

/**
 * J-012: the canonical group header's single accessible announcement — title, aggregate
 * quantity, calorie total, expanded/collapsed state, and the available action, e.g.
 * "Eier, 5 Stück (300 g), 411 Kilokalorien, eingeklappt. Zum Öffnen doppeltippen." Kept as one
 * pure string builder (rather than composed ad hoc in the screen) so it's directly unit-tested
 * without a render harness, and so the header's visible chevron glyph can safely be hidden from
 * the accessibility tree (requirement 24) — this is the only announcement for the row.
 */
export function buildCanonicalGroupAccessibilityLabel(
  label: string,
  quantitySubtitle: string | undefined,
  totalCalories: number,
  isExpanded: boolean,
): string {
  const quantityPart = quantitySubtitle ? `${quantitySubtitle}, ` : '';
  const statePart = isExpanded ? 'aufgeklappt' : 'eingeklappt';
  const actionPart = isExpanded ? 'Schließen' : 'Öffnen';

  return `${label}, ${quantityPart}${Math.round(totalCalories)} Kilokalorien, ${statePart}. Zum ${actionPart} doppeltippen.`;
}

export function buildFoodEntryDisplay(
  entry: FoodEntry,
  knownCountPortion?: KnownCountPortion,
): FoodEntryDisplay {
  const titleSource = entry.parsedName || entry.rawInput;
  const grams = entry.grams ?? entry.quantityGrams;

  return {
    title: formatTitle(titleSource),
    subtitle: buildSubtitle(entry.rawInput, grams, knownCountPortion),
  };
}

/**
 * P1-003C composite-dish groups (e.g. "Fruchtsalat mit Bananen, Kirschen") and J-009
 * canonical-identity groups (e.g. repeated "Eier" entries) share this shape. The label
 * itself is never a persisted FoodEntry, so the group total is always exactly the sum of
 * its children's macros (no separate total to keep in sync, and deleting children down to
 * fewer than the grouping threshold makes the group disappear on the next pass for free).
 * `groupKind` lets the screen render them differently: composite groups stay always-expanded
 * (existing, unchanged behavior); canonical groups are collapsed-by-default/tap-to-expand.
 */
export interface JournalEntryGroup {
  kind: 'group';
  groupKind: 'composite' | 'canonical';
  groupId: string;
  label: string;
  children: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface JournalEntryLeaf {
  kind: 'entry';
  entry: FoodEntry;
}

export type JournalListItem = JournalEntryGroup | JournalEntryLeaf;

// Rounds to one decimal — enough precision for these already-≤1-decimal macro values, and
// it eliminates binary floating-point summation noise (e.g. 82.2 + 164.4 -> 246.60000000000002
// in raw JS arithmetic) without changing the mathematically exact total (requirement 12: the
// group total must equal the exact sum of its children, not a re-derived or drifted value).
function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function sumEntries(entries: FoodEntry[]) {
  const raw = entries.reduce(
    (totals, entry) => ({
      totalCalories: totals.totalCalories + entry.calories,
      totalProtein: totals.totalProtein + entry.protein,
      totalCarbs: totals.totalCarbs + entry.carbs,
      totalFat: totals.totalFat + entry.fat,
    }),
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 },
  );

  return {
    totalCalories: roundToOneDecimal(raw.totalCalories),
    totalProtein: roundToOneDecimal(raw.totalProtein),
    totalCarbs: roundToOneDecimal(raw.totalCarbs),
    totalFat: roundToOneDecimal(raw.totalFat),
  };
}

/**
 * J-009 / decision 6: the grouping key is canonical food identity, and *only* that — never
 * raw input text, display label, or name similarity. `null` (no usable identity) means the
 * entry can never join a canonical group and stays an individual leaf (decision 6's safe
 * default: a missed grouping is better than a false one).
 */
function canonicalIdentityKey(entry: FoodEntry): string | null {
  const ref = entry.foodCatalogRef;
  if (!ref || !ref.source || !ref.sourceId) return null;

  return `${ref.source}:${ref.sourceId}`;
}

/**
 * J-012: prefers a stable, user-friendly German display name for a canonical-identity group's
 * header over the raw catalog string (e.g. "Eier" instead of "Huehnerei ganz roh"). Reuses the
 * existing, already-populated alias dictionary (`detectCanonicalEntity`/`domain/canonicalFoods`)
 * — the same trusted source that already powers portion-hint/resolver lookups elsewhere — rather
 * than introducing any new name/alias table.
 *
 * Depends only on the group's shared canonical-food identity, never on any individual child's
 * `rawInput`/which children currently exist, so the title stays stable across add/edit/delete of
 * any member (the same "never derive from the newest/first entry alone" principle J-010/J-011
 * apply to quantities). Precedence:
 *
 * 1. Every child's `parsedName` must resolve, via the existing dictionary, to the exact same
 *    canonical food id — a single dissenting or unresolved child forfeits the friendly name
 *    entirely (never a guess, never a name-similarity fallback).
 * 2. Among that food's existing DE aliases, deterministically prefer the longest one (already-
 *    curated data, e.g. "eier" over "ei") — this selects among strings that already exist in the
 *    dictionary; it does not generate, inflect, or invent a plural.
 * 3. Otherwise, fall back to the existing raw catalog display name unchanged — no speculative
 *    alias is ever created.
 */
function resolveCanonicalGroupTitle(children: FoodEntry[], fallbackDisplayName: string): string {
  const firstEntity = detectCanonicalEntity(children[0]?.parsedName ?? '');
  if (!firstEntity) return formatTitle(fallbackDisplayName);

  const allMatch = children.every(
    (child) => detectCanonicalEntity(child.parsedName)?.id === firstEntity.id,
  );
  if (!allMatch) return formatTitle(fallbackDisplayName);

  const preferredAlias = [...firstEntity.aliases.de].sort((a, b) => b.length - a.length)[0];
  return formatTitle(preferredAlias || fallbackDisplayName);
}

/**
 * J-009: a second pass over the leaves left by the composite-dish pass, grouping entries that
 * share a canonical food identity (requirement 2/3/4). A group forms only when at least two
 * entries share the identity (requirement 5); a lone match stays a leaf. The group is emitted
 * at the position of its *newest* (chronologically last) member, not its first — so a newly
 * logged item is visible where it was just added rather than appearing to vanish into an old
 * position (requirement 11) — while `children` itself stays in original chronological order
 * (requirement 10). Composite-dish members never reach this pass (they were already absorbed
 * into `JournalEntryGroup`s in pass one, so they no longer appear as leaves here) — matching
 * "composite-dish grouping is untouched".
 */
function applyCanonicalGrouping(items: JournalListItem[]): JournalListItem[] {
  const indicesByKey = new Map<string, number[]>();
  items.forEach((item, index) => {
    if (item.kind !== 'entry') return;
    const key = canonicalIdentityKey(item.entry);
    if (!key) return;

    const existing = indicesByKey.get(key);
    if (existing) existing.push(index);
    else indicesByKey.set(key, [index]);
  });

  const groupableEntries = Array.from(indicesByKey.entries()).filter(
    ([, indices]) => indices.length >= 2,
  );
  if (groupableEntries.length === 0) return items;

  const keyByIndex = new Map<number, string>();
  const newestIndexByKey = new Map<string, number>();
  const memberIndicesByKey = new Map<string, number[]>();
  for (const [key, indices] of groupableEntries) {
    for (const index of indices) keyByIndex.set(index, key);
    newestIndexByKey.set(key, indices[indices.length - 1]);
    memberIndicesByKey.set(key, indices);
  }

  const result: JournalListItem[] = [];
  items.forEach((item, index) => {
    const key = keyByIndex.get(index);
    if (key === undefined) {
      result.push(item);
      return;
    }
    if (newestIndexByKey.get(key) !== index) {
      // An older member of this identity — absorbed into the group emitted at the newest
      // member's position below, so it does not also appear as its own leaf.
      return;
    }

    const memberIndices = memberIndicesByKey.get(key) ?? [];
    const children = memberIndices.map((i) => (items[i] as JournalEntryLeaf).entry);
    // Every child shares this identity's foodCatalogRef by construction (canonicalIdentityKey
    // requires it); the first child's displayName is the deterministic fallback if no friendlier
    // name applies (requirement 14's "smallest deterministic fallback" only matters if
    // displayName were ever empty despite a valid identity, which the chain below also covers
    // defensively). J-012: resolveCanonicalGroupTitle prefers a friendly existing German name
    // over this raw catalog string when the whole group's identity supports one.
    const fallbackDisplayName =
      children[0].foodCatalogRef?.displayName || children[0].parsedName || children[0].rawInput;
    const label = resolveCanonicalGroupTitle(children, fallbackDisplayName);

    result.push({
      kind: 'group',
      groupKind: 'canonical',
      groupId: `canonical:${key}`,
      label,
      children,
      ...sumEntries(children),
    });
  });

  return result;
}

/**
 * Groups entries sharing a groupId (set by P1-003B/C composite-dish detection) under a
 * single `groupKind: 'composite'` JournalEntryGroup, in the position of their first-seen
 * child (unchanged from before J-009). Then runs the J-009 canonical-identity pass over the
 * remaining leaves. Entries that end up in neither pass pass through unchanged as
 * JournalEntryLeaf items.
 */
export function groupJournalEntries(entries: FoodEntry[]): JournalListItem[] {
  const result: JournalListItem[] = [];
  const groupIndexByGroupId = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.groupId) {
      result.push({ kind: 'entry', entry });
      continue;
    }

    const existingIndex = groupIndexByGroupId.get(entry.groupId);
    if (existingIndex === undefined) {
      groupIndexByGroupId.set(entry.groupId, result.length);
      result.push({
        kind: 'group',
        groupKind: 'composite',
        groupId: entry.groupId,
        label: formatTitle(entry.groupLabel ?? ''),
        children: [entry],
        totalCalories: entry.calories,
        totalProtein: entry.protein,
        totalCarbs: entry.carbs,
        totalFat: entry.fat,
      });
      continue;
    }

    const group = result[existingIndex] as JournalEntryGroup;
    group.children.push(entry);
    group.totalCalories += entry.calories;
    group.totalProtein += entry.protein;
    group.totalCarbs += entry.carbs;
    group.totalFat += entry.fat;
  }

  return applyCanonicalGrouping(result);
}
