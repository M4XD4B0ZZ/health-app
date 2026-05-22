export interface SplitMultiItemInputItem {
  rawText: string;
  index: number;
}

export interface SplitMultiItemInputResult {
  items: SplitMultiItemInputItem[];
  wasSplit: boolean;
}

const MULTI_ITEM_CONNECTOR_PATTERN = /\s*(?:,|\b(?:und|mit|and|with)\b)\s*/i;

/**
 * Deterministically splits simple multi-item nutrition input into item fragments.
 *
 * Supported connectors from P1-003:
 * - German: "und", "mit"
 * - English: "and", "with"
 * - Comma
 *
 * Empty fragments are ignored safely so malformed delimiter sequences do not
 * create empty resolver calls.
 */
export function splitMultiItemInput(rawInput: string): SplitMultiItemInputResult {
  const fragments = rawInput
    .split(MULTI_ITEM_CONNECTOR_PATTERN)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0);

  const items = fragments.map((rawText, index) => ({ rawText, index }));

  return {
    items: items.length > 0 ? items : [{ rawText: rawInput.trim(), index: 0 }],
    wasSplit: items.length > 1,
  };
}
