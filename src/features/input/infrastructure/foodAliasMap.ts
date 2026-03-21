const FOOD_ALIASES: Record<string, string> = {
  // German to canonical
  ei: 'egg',
  eier: 'egg',
  brot: 'bread',
  reis: 'rice',
  hähnchen: 'chicken',
  haehnchen: 'chicken',
  schinken: 'ham',

  // English canonical forms
  egg: 'egg',
  eggs: 'egg',
  toast: 'toast',
  bread: 'bread',
  rice: 'rice',
  chicken: 'chicken',
  quark: 'quark',
  ham: 'ham',
};

export function getCanonicalFoodName(rawName: string): string | null {
  const normalized = rawName.toLowerCase().trim();
  return FOOD_ALIASES[normalized] || null;
}
