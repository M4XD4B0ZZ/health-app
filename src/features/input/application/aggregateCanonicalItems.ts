import { ResolverFoodRequest } from '../domain/ResolverFoodRequest';

/**
 * Aggregates resolver food requests that have the same canonical name.
 * Only aggregates items with status "ready" and same canonical name.
 * Combines quantities where possible (same unit or both null).
 */
export function aggregateCanonicalItems(requests: ResolverFoodRequest[]): ResolverFoodRequest[] {
  const aggregated: ResolverFoodRequest[] = [];
  const canonicalGroups = new Map<string, ResolverFoodRequest[]>();

  // Group by canonical name
  for (const request of requests) {
    if (request.status === 'ready' && request.canonicalName) {
      const key = request.canonicalName;
      if (!canonicalGroups.has(key)) {
        canonicalGroups.set(key, []);
      }
      canonicalGroups.get(key)!.push(request);
    } else {
      // Keep unresolved items as-is
      aggregated.push(request);
    }
  }

  // Aggregate each canonical group
  for (const [canonicalName, group] of canonicalGroups) {
    if (group.length === 1) {
      // Single item, no aggregation needed
      aggregated.push(group[0]);
    } else {
      // Multiple items with same canonical name - try to aggregate
      const aggregatedItems = aggregateGroup(group, canonicalName);
      aggregated.push(...aggregatedItems);
    }
  }

  return aggregated;
}

function aggregateGroup(
  group: ResolverFoodRequest[],
  canonicalName: string,
): ResolverFoodRequest[] {
  // Use the first item as base
  const base = group[0];

  // Check if all items have compatible units for aggregation
  const firstUnit = base.unit;
  const allSameUnit = group.every((item) => item.unit === firstUnit);

  if (!allSameUnit) {
    // Units are incompatible, return items separately
    return group;
  }

  // Units are compatible, sum quantities
  // Treat null quantity as 1 for items without explicit quantity
  let totalQuantity = 0;
  for (const item of group) {
    totalQuantity += item.quantity || 1;
  }

  // Create aggregated item
  const rawNames = group.map((item) => item.rawName).join(' + ');
  const rawTexts = group.map((item) => item.rawText || item.rawName).join(' + ');

  return [
    {
      rawName: rawNames,
      rawText: rawTexts,
      query: base.query,
      canonicalName,
      quantity: totalQuantity,
      unit: firstUnit,
      status: 'ready',
    },
  ];
}
