import { FoodSourceType } from '../../domain/catalog/FoodCatalogSource';

export function toResolverSourceLabel(
  sourceType: FoodSourceType,
  sourceClassName?: string,
): string {
  const isMock = sourceClassName?.toLowerCase().includes('mock') ?? false;

  if (sourceType === 'off') {
    return isMock ? 'MOCK_OFF' : 'OFF';
  }

  if (sourceType === 'usda') {
    return isMock ? 'MOCK_USDA' : 'USDA';
  }

  if (sourceType === 'user') {
    return 'USER';
  }

  if (sourceType === 'ai') {
    return 'AI';
  }

  return 'UNKNOWN';
}
