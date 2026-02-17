const PUNCTUATION_REGEX = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE_REGEX = /\s+/g;

export function normalizeQuery(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(PUNCTUATION_REGEX, " ")
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

