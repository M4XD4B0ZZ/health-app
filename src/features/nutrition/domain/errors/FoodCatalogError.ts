export type FoodCatalogErrorKind =
  | 'network'
  | 'edge'
  | 'invalid_payload'
  | 'rate_limit'
  | 'timeout'
  | 'unknown';

export class FoodCatalogError extends Error {
  constructor(
    public readonly kind: FoodCatalogErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'FoodCatalogError';
  }

  static network(message: string, cause?: unknown): FoodCatalogError {
    return new FoodCatalogError('network', message, cause);
  }

  static edge(message: string, cause?: unknown): FoodCatalogError {
    return new FoodCatalogError('edge', message, cause);
  }

  static invalidPayload(message: string, cause?: unknown): FoodCatalogError {
    return new FoodCatalogError('invalid_payload', message, cause);
  }

  static rateLimit(message: string, cause?: unknown): FoodCatalogError {
    return new FoodCatalogError('rate_limit', message, cause);
  }

  static timeout(message: string, cause?: unknown): FoodCatalogError {
    return new FoodCatalogError('timeout', message, cause);
  }

  static unknown(message: string, cause?: unknown): FoodCatalogError {
    return new FoodCatalogError('unknown', message, cause);
  }
}
