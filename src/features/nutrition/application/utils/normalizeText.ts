/**
 * Normalisiert Text für deterministische Suche:
 * - lowercase
 * - trim
 * - collapse spaces
 * - replace umlauts (ä->ae, ö->oe, ü->ue, ß->ss)
 * - remove punctuation except spaces
 */
export function normalizeText(input: string): string {
  let normalized = input.toLowerCase().trim();
  
  // Replace umlauts
  normalized = normalized
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  
  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, '');
  
  // Collapse multiple spaces into one
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}
