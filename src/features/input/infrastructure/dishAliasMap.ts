const dishAliasMap: Record<string, string> = {
  'spaghetti bolognese': 'spaghetti_bolognese',
  lasagne: 'lasagne',
  lasagna: 'lasagne',
  'chicken bowl': 'chicken_bowl',
  'reis bowl': 'reis_bowl',
  hackbraten: 'hackbraten',
};

function normalize(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function getCanonicalDishName(raw: string): string | null {
  const normalized = normalize(raw);
  return dishAliasMap[normalized] || null;
}
