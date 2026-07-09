export interface SplitMultiItemInputItem {
  rawText: string;
  index: number;
}

export interface SplitMultiItemGroup {
  label: SplitMultiItemInputItem;
  children: SplitMultiItemInputItem[];
}

export interface SplitMultiItemInputResult {
  items: SplitMultiItemInputItem[];
  groups: SplitMultiItemGroup[];
  wasSplit: boolean;
}

// Top-level connector: only "und"/"and" force a new top-level split point.
// "," and "mit"/"with" are resolved per-segment below, since a "mit"-clause
// changes how a trailing comma list is interpreted (P1-003B).
const TOP_LEVEL_CONNECTOR_PATTERN = /\s*\b(?:und|and)\b\s*/i;

// Detects the first "mit"/"with" clause opener within a top-level segment.
const CLAUSE_CONNECTOR_PATTERN = /\b(?:mit|with)\b/i;

const COMMA_PATTERN = /\s*,\s*/;

// Legacy P1-003 behavior: comma or und/mit/and/with all split flatly at the
// same level. Used as a fallback whenever a segment does not contain a real
// comma-separated "mit"-clause (i.e. a composite-dish ingredient list).
const LEGACY_FLAT_CONNECTOR_PATTERN = /\s*(?:,|\b(?:und|mit|and|with)\b)\s*/i;

function splitAndTrim(text: string, pattern: RegExp): string[] {
  return text
    .split(pattern)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0);
}

/**
 * Deterministically splits simple multi-item nutrition input into item fragments.
 *
 * Supported connectors from P1-003:
 * - German: "und", "mit"
 * - English: "and", "with"
 * - Comma
 *
 * P1-003B (clause-aware): a "mit"/"with" clause followed by a comma-separated
 * list (>= 2 items) is treated as a composite-dish header, e.g.
 * "Fruchtsalat mit Bananen, Kirschen" produces a group with label
 * "Fruchtsalat" and children ["Bananen", "Kirschen"] instead of three flat
 * top-level entries. The label is intentionally excluded from `items` so it
 * is never sent to the resolver on its own. A "mit"/"with" clause with only
 * a single trailing item (no comma list) is not a composite-dish header and
 * keeps the original flat P1-003 behavior, e.g. "burger mit cola" still
 * yields two flat entries.
 *
 * Empty fragments are ignored safely so malformed delimiter sequences do not
 * create empty resolver calls.
 */
export function splitMultiItemInput(rawInput: string): SplitMultiItemInputResult {
  const topLevelSegments = splitAndTrim(rawInput, TOP_LEVEL_CONNECTOR_PATTERN);

  if (topLevelSegments.length === 0) {
    return {
      items: [{ rawText: rawInput.trim(), index: 0 }],
      groups: [],
      wasSplit: false,
    };
  }

  const items: SplitMultiItemInputItem[] = [];
  const groups: SplitMultiItemGroup[] = [];
  let nextIndex = 0;

  for (const segment of topLevelSegments) {
    const clauseMatch = segment.match(CLAUSE_CONNECTOR_PATTERN);

    if (clauseMatch && clauseMatch.index !== undefined) {
      const head = segment.slice(0, clauseMatch.index).trim();
      const rest = segment.slice(clauseMatch.index + clauseMatch[0].length).trim();
      const children = splitAndTrim(rest, COMMA_PATTERN);

      if (head.length > 0 && children.length >= 2) {
        const label: SplitMultiItemInputItem = { rawText: head, index: nextIndex++ };
        const childItems: SplitMultiItemInputItem[] = children.map((rawText) => ({
          rawText,
          index: nextIndex++,
        }));
        items.push(...childItems);
        groups.push({ label, children: childItems });
        continue;
      }
    }

    const flatFragments = splitAndTrim(segment, LEGACY_FLAT_CONNECTOR_PATTERN);
    for (const rawText of flatFragments) {
      items.push({ rawText, index: nextIndex++ });
    }
  }

  const wasSplit = topLevelSegments.length > 1 || groups.length > 0 || items.length > 1;

  return {
    items: items.length > 0 ? items : [{ rawText: rawInput.trim(), index: 0 }],
    groups,
    wasSplit,
  };
}

export interface SplitMultiItemGroupInfo {
  groupId: string;
  groupLabel: string;
}

/**
 * P1-003C: maps each group child's item index to a stable groupId/groupLabel pair, so
 * downstream persistence (FoodEntry.groupId/groupLabel) can tag sibling entries under
 * the same composite-dish label without every consumer re-deriving group ids itself.
 */
export function buildGroupInfoByItemIndex(
  result: SplitMultiItemInputResult,
): Map<number, SplitMultiItemGroupInfo> {
  const groupInfoByItemIndex = new Map<number, SplitMultiItemGroupInfo>();

  result.groups.forEach((group, groupIndex) => {
    const groupId = `group-${groupIndex}-${group.label.index}`;
    for (const child of group.children) {
      groupInfoByItemIndex.set(child.index, { groupId, groupLabel: group.label.rawText });
    }
  });

  return groupInfoByItemIndex;
}
