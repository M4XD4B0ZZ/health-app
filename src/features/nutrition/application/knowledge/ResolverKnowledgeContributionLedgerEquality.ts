/**
 * Deterministic, key-order-independent deep-equality serializer used only for idempotency/conflict
 * comparisons (contribution content equality, retraction-action content equality). Distinct from
 * the fixed-field-order canonical serialization used for hashing (see
 * `ResolverKnowledgeContributionIdCalculator.ts`) — this utility exists purely so an adversarial
 * object with keys inserted in a different order still compares equal/unequal correctly.
 */
export function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJsonStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
