import { CANONICAL_FOODS } from '../canonicalFoods';

const LOCAL_MVP_ALIASES: Record<string, string> = {
  karotte: 'carrot',
  karotten: 'carrot',
  moehre: 'carrot',
  moehren: 'carrot',
  möhre: 'carrot',
  möhren: 'carrot',
};

export function resolveFoodIdentityKey(input: string): string | null {
  const normalizedInput = input.toLowerCase().trim();

  const localAliasMatch = LOCAL_MVP_ALIASES[normalizedInput];
  if (localAliasMatch) {
    return toFoodIdentityKey(localAliasMatch);
  }

  for (const food of CANONICAL_FOODS) {
    if (food.aliases.de.includes(normalizedInput) || food.aliases.en.includes(normalizedInput)) {
      return toFoodIdentityKey(food.id);
    }
  }

  return null;
}

export function toFoodIdentityKey(canonicalId: string): string {
  return `canonical:${canonicalId}`;
}
