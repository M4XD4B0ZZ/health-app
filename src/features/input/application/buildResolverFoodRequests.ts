import { ParsedInput } from '../domain/ParsedInput';
import { FoodMatch } from '../domain/FoodMatch';
import { ResolverFoodRequest } from '../domain/ResolverFoodRequest';

export function buildResolverFoodRequests(
  parsed: ParsedInput,
  matches: FoodMatch[],
): ResolverFoodRequest[] {
  return parsed.items.map((item, index) => {
    const match = matches[index];
    const canonicalName = match?.canonicalName || null;
    const normalizedUnit = item.unit?.toLowerCase() ?? null;
    const canDispatchToResolver =
      normalizedUnit === null || ['g', 'piece', 'slice'].includes(normalizedUnit);

    return {
      rawName: item.name.toLowerCase(), // normalized for dispatch
      rawText: item.rawText,
      query: canonicalName || item.name,
      canonicalName,
      quantity: item.quantity,
      unit: item.unit,
      status: canDispatchToResolver ? 'ready' : 'unresolved',
    };
  });
}
