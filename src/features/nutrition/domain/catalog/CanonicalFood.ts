import { isDebugLoggingEnabled } from '../../../../infrastructure/config/appEnv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortionHint {
  unit: string;
  grams: number;
  labelDe: string;
}

export interface CanonicalFoodEntity {
  canonicalId: string;
  /** Lowercase, umlaut-normalized DE aliases (post-normalizeText) */
  deAliases: string[];
  /** Lowercase EN aliases */
  enAliases: string[];
  defaultPortionHints?: PortionHint[];
}

// ---------------------------------------------------------------------------
// Dictionary (~20 high-frequency items)
// ---------------------------------------------------------------------------

export const CANONICAL_FOODS: CanonicalFoodEntity[] = [
  {
    canonicalId: 'egg',
    deAliases: ['ei', 'eier', 'huehnerei', 'huehnereier'],
    enAliases: ['egg', 'eggs'],
    defaultPortionHints: [{ unit: 'piece', grams: 60, labelDe: '1 Ei (≈60 g)' }],
  },
  {
    canonicalId: 'apple',
    deAliases: ['apfel', 'aepfel'],
    enAliases: ['apple', 'apples'],
    defaultPortionHints: [{ unit: 'piece', grams: 180, labelDe: '1 Apfel (≈180 g)' }],
  },
  {
    canonicalId: 'banana',
    deAliases: ['banane', 'bananen'],
    enAliases: ['banana', 'bananas'],
    defaultPortionHints: [{ unit: 'piece', grams: 120, labelDe: '1 Banane (≈120 g)' }],
  },
  {
    canonicalId: 'milk',
    deAliases: ['milch'],
    enAliases: ['milk'],
    defaultPortionHints: [{ unit: 'glass', grams: 250, labelDe: '1 Glas (≈250 ml)' }],
  },
  {
    canonicalId: 'chicken breast',
    deAliases: ['haehnchen', 'haehnchenbrust', 'haehnchenbrustfilet', 'huhn', 'huehnchenbrust'],
    enAliases: ['chicken breast', 'chicken'],
  },
  {
    canonicalId: 'rice',
    deAliases: ['reis'],
    enAliases: ['rice'],
  },
  {
    canonicalId: 'potato',
    deAliases: ['kartoffel', 'kartoffeln'],
    enAliases: ['potato', 'potatoes'],
    defaultPortionHints: [{ unit: 'piece', grams: 150, labelDe: '1 Kartoffel (≈150 g)' }],
  },
  {
    canonicalId: 'bread',
    deAliases: ['brot'],
    enAliases: ['bread'],
    defaultPortionHints: [{ unit: 'slice', grams: 50, labelDe: '1 Scheibe (≈50 g)' }],
  },
  {
    canonicalId: 'bread roll',
    deAliases: ['broetchen'],
    enAliases: ['bread roll', 'roll'],
    defaultPortionHints: [{ unit: 'piece', grams: 60, labelDe: '1 Brötchen (≈60 g)' }],
  },
  {
    canonicalId: 'curd',
    deAliases: ['quark', 'magerquark'],
    enAliases: ['curd', 'quark'],
  },
  {
    canonicalId: 'yogurt',
    deAliases: ['joghurt', 'jogurt'],
    enAliases: ['yogurt', 'yoghurt'],
  },
  {
    canonicalId: 'tomato',
    deAliases: ['tomate', 'tomaten'],
    enAliases: ['tomato', 'tomatoes'],
  },
  {
    canonicalId: 'cucumber',
    deAliases: ['gurke', 'gurken'],
    enAliases: ['cucumber', 'cucumbers'],
  },
  {
    canonicalId: 'cheese',
    deAliases: ['kaese', 'schnittkäse'],
    enAliases: ['cheese'],
  },
  {
    canonicalId: 'pork',
    deAliases: ['schweinefleisch', 'schwein'],
    enAliases: ['pork'],
  },
  {
    canonicalId: 'beef',
    deAliases: ['rindfleisch', 'rind'],
    enAliases: ['beef'],
  },
  {
    canonicalId: 'butter',
    deAliases: ['butter'],
    enAliases: ['butter'],
  },
  {
    canonicalId: 'oats',
    deAliases: ['haferflocken', 'hafer'],
    enAliases: ['oats', 'oatmeal'],
  },
  {
    canonicalId: 'pasta',
    deAliases: ['nudeln', 'nudel', 'spaghetti'],
    enAliases: ['pasta', 'noodles', 'spaghetti'],
  },
  {
    canonicalId: 'strawberry',
    deAliases: ['erdbeere', 'erdbeeren'],
    enAliases: ['strawberry', 'strawberries'],
  },
];

// ---------------------------------------------------------------------------
// Lookup index (built once at import time)
// ---------------------------------------------------------------------------

interface AliasEntry {
  canonicalId: string;
  locale: 'de' | 'en';
}

const ALIAS_INDEX: Map<string, AliasEntry> = new Map();

for (const entity of CANONICAL_FOODS) {
  for (const alias of entity.deAliases) {
    ALIAS_INDEX.set(alias, { canonicalId: entity.canonicalId, locale: 'de' });
  }
  for (const alias of entity.enAliases) {
    // Don't overwrite DE entry if same string exists in both
    if (!ALIAS_INDEX.has(alias)) {
      ALIAS_INDEX.set(alias, { canonicalId: entity.canonicalId, locale: 'en' });
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DetectResult {
  canonicalId: string | null;
  normalizedQuery: string;
}

/**
 * Detects a canonical food entity from a normalized query string.
 * Returns the canonicalId if a match is found, otherwise null.
 * Works with both DE and EN aliases.
 */
export function detectCanonicalEntity(normalizedQuery: string, _locale: string): DetectResult {
  const lowerQuery = normalizedQuery.toLowerCase();
  const entry = ALIAS_INDEX.get(lowerQuery);

  if (entry) {
    return { canonicalId: entry.canonicalId, normalizedQuery: lowerQuery };
  }

  return { canonicalId: null, normalizedQuery: lowerQuery };
}

export interface SourceQueryArgs {
  sourceName: string;
  locale: string;
  normalizedQuery: string;
  canonicalId: string | null;
  traceId?: string;
}

/**
 * Returns the best query string to send to a specific source.
 *
 * - USDA + DE locale + known canonical: use the canonical EN primary term
 * - OFF: always keep the original normalizedQuery (EU-focused, handles DE)
 * - Fallback: return normalizedQuery as-is
 */
export function getSourceQuery({
  sourceName,
  locale,
  normalizedQuery,
  canonicalId,
  traceId,
}: SourceQueryArgs): string {
  // Only translate for USDA when locale is DE and we have a canonical match
  if (sourceName === 'usda' && locale.toLowerCase().startsWith('de') && canonicalId) {
    const entity = CANONICAL_FOODS.find((e) => e.canonicalId === canonicalId);
    if (entity) {
      const enPrimary = entity.enAliases[0]; // first EN alias = primary term
      if (isDebugLoggingEnabled() && traceId) {
        console.log(
          `[${traceId}] SOURCE_QUERY source=usda canonical="${canonicalId}" mapped="${enPrimary}"`,
        );
      }
      return enPrimary;
    }
  }

  return normalizedQuery;
}
