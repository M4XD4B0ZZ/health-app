import { FoodSourceType } from '../../domain/catalog/FoodCatalogSource';

export const RESOLVER_SOURCE_LABELS = {
  OFF: 'OFF',
  BLS: 'BLS',
  USDA: 'USDA',
  MOCK_OFF: 'MOCK_OFF',
  MOCK_USDA: 'MOCK_USDA',
  USER: 'USER',
  AI: 'AI',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ResolverSourceLabel =
  (typeof RESOLVER_SOURCE_LABELS)[keyof typeof RESOLVER_SOURCE_LABELS];

export function toResolverSourceLabel(
  sourceType: FoodSourceType,
  sourceClassName?: string,
): ResolverSourceLabel {
  const isMock = sourceClassName?.toLowerCase().includes('mock') ?? false;

  if (sourceType === 'off') {
    return isMock ? RESOLVER_SOURCE_LABELS.MOCK_OFF : RESOLVER_SOURCE_LABELS.OFF;
  }

  if (sourceType === 'bls') {
    return RESOLVER_SOURCE_LABELS.BLS;
  }

  if (sourceType === 'usda') {
    return isMock ? RESOLVER_SOURCE_LABELS.MOCK_USDA : RESOLVER_SOURCE_LABELS.USDA;
  }

  if (sourceType === 'user') {
    return RESOLVER_SOURCE_LABELS.USER;
  }

  if (sourceType === 'ai') {
    return RESOLVER_SOURCE_LABELS.AI;
  }

  return RESOLVER_SOURCE_LABELS.UNKNOWN;
}

export function isMockResolverSourceLabel(source: ResolverSourceLabel): boolean {
  return source === RESOLVER_SOURCE_LABELS.MOCK_OFF || source === RESOLVER_SOURCE_LABELS.MOCK_USDA;
}

export function isRealResolverSourceLabel(source: ResolverSourceLabel): boolean {
  return (
    source === RESOLVER_SOURCE_LABELS.OFF ||
    source === RESOLVER_SOURCE_LABELS.BLS ||
    source === RESOLVER_SOURCE_LABELS.USDA
  );
}
