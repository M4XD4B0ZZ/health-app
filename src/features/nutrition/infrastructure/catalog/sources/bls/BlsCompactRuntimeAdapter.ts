import { BlsFoodRecord } from './BlsLookupEngine';
import { BlsCompactRuntimeArtifact, BlsCompactRuntimeRecord } from './BlsCompactRuntimeTypes';

const UMLAUT_REPLACEMENTS: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
};

const COMPATIBILITY_ALIASES_BY_SOURCE_ID: Readonly<Record<string, readonly string[]>> = {
  M713100: ['magerquark', 'quark', 'speisequark', 'magerstufe'],
  B314000: ['toast', 'toastbrot', 'weizentoastbrot', 'buttertoast'],
  Y720143: ['ruehrei', 'rührei', 'ruehei'],
};

/**
 * RESOLVER-V3-043: source-ID-scoped negative-compatibility contract, the mirror image of
 * `COMPATIBILITY_ALIASES_BY_SOURCE_ID` above. A record listed here must never win an exact,
 * includes, token, or ranked-token match for one of its listed (already-normalized) bare
 * queries, however that identity was generated (its own display name, a split alias, or a
 * derived token) — closing the "any exact hit short-circuits everything else" false-confidence
 * class documented in RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md for
 * D771900 ("Brötchen (Blätterteig)"): `normalizeBlsRuntimeText()` strips the entire
 * "(Blätterteig)" qualifier, so the record's own paren-stripped display name falsely claims
 * exact identity with the everyday, unqualified word "Brötchen" -- a real bread roll's word, not
 * this puff-pastry roll's. Listing the record here does not remove it from search entirely: a
 * *qualified* query like "Brötchen Blätterteig" is untouched (a different, longer normalized
 * string), so the record stays fully discoverable for the food it actually is.
 */
const INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID: Readonly<Record<string, readonly string[]>> = {
  D771900: ['broetchen'],
};

/** Test/diagnostic accessor -- production code reads the field on the adapted `BlsFoodRecord`. */
export function getIncompatibleGenericQueries(sourceId: string): readonly string[] {
  return INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID[sourceId] ?? [];
}

export function adaptBlsCompactRuntimeRecords(
  artifact: BlsCompactRuntimeArtifact,
): readonly BlsFoodRecord[] {
  return artifact.records.map((record) => adaptBlsCompactRuntimeRecord(record));
}

export function adaptBlsCompactRuntimeRecord(record: BlsCompactRuntimeRecord): BlsFoodRecord {
  const aliases = buildBlsRuntimeAliases(record);

  return {
    id: record.id,
    sourceId: record.sourceId,
    displayName: record.displayName,
    normalizedName: normalizeBlsRuntimeText(record.displayName),
    aliases,
    tokens: buildBlsRuntimeTokens(record.displayName, aliases),
    macrosPer100g: { ...record.macrosPer100g },
    incompatibleGenericQueries: INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID[record.sourceId] ?? [],
  };
}

export function normalizeBlsRuntimeText(text: string): string {
  return foldGermanUmlauts(text)
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[%]/g, ' ')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokenizeBlsRuntimeText(text: string): string[] {
  return uniqueStrings(
    normalizeBlsRuntimeText(text)
      .split(' ')
      .filter((token) => token.length > 1),
  );
}

export function buildBlsRuntimeAliases(record: BlsCompactRuntimeRecord): string[] {
  const deterministicAliases = splitAliasCandidates(record.displayName).flatMap((candidate) => [
    candidate.toLowerCase().trim(),
    normalizeBlsRuntimeText(candidate),
  ]);
  const compatibilityAliases = COMPATIBILITY_ALIASES_BY_SOURCE_ID[record.sourceId] ?? [];

  return uniqueStrings([
    ...deterministicAliases,
    normalizeBlsRuntimeText(record.displayName),
    ...compatibilityAliases,
  ]).filter((alias) => alias.length > 0);
}

export function buildBlsRuntimeTokens(displayName: string, aliases: readonly string[]): string[] {
  return uniqueStrings([
    ...tokenizeBlsRuntimeText(displayName),
    ...aliases.flatMap((alias) => tokenizeBlsRuntimeText(alias)),
  ]);
}

function foldGermanUmlauts(text: string): string {
  return text.replace(/[äöüß]/g, (match) => UMLAUT_REPLACEMENTS[match] ?? match);
}

function splitAliasCandidates(displayName: string): string[] {
  const withoutAngles = displayName.replace(/<[^>]*>/g, ' ');
  const withoutParentheses = withoutAngles.replace(/[()]/g, ' ');

  // A "mit" clause introduces a natural-language ingredient/addition list (e.g.
  // "Schichtsalat mit Gemüse, Käse, Eiern"), not alternate names for the record - a
  // comma segment that only starts once that clause is underway is a listed
  // ingredient, not an alternate name, and must not become an exact-match alias for
  // the whole (composite) record. Segments that start before the "mit" clause are
  // kept even if the clause itself begins partway through them (e.g. a name with no
  // delimiter at all, "Eier mit Käse überbacken", stays a single specific alias
  // instead of being truncated down to the overly generic "Eier").
  const mitClauseIndex = withoutParentheses.search(/\bmit\b/i);

  const segments: string[] = [];
  const delimiterPattern = /[\/,;]+/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = delimiterPattern.exec(withoutParentheses)) !== null) {
    if (mitClauseIndex === -1 || cursor < mitClauseIndex) {
      segments.push(withoutParentheses.slice(cursor, match.index));
    }
    cursor = match.index + match[0].length;
  }
  if (mitClauseIndex === -1 || cursor < mitClauseIndex) {
    segments.push(withoutParentheses.slice(cursor));
  }

  return segments.map((candidate) => candidate.trim()).filter((candidate) => candidate.length > 0);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}
