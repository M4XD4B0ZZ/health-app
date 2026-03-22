import type { FoodSourceProvider } from './FoodSourceProvider';
import { EdgeSearchResponse, EdgeFoodItem } from './EdgeSearchTypes';
import { FoodCatalogError } from '../../../domain/errors/FoodCatalogError';
import { withRetry, DEFAULT_RETRY_CONFIG, RetryConfig } from './RetryHelper';

interface CanonicalFoodItem {
  id?: string;
  canonical_name: string;
  brand: string | null;
  source: 'off' | 'usda';
  external_id: string;
  locale: string;
  macros_per_100g: Record<string, number>;
  micros_per_100g?: Record<string, number> | null;
  confidence: number;
  last_verified_at: string;
}

interface EdgeFunctionResponse {
  type: 'fresh' | 'cache';
  items: CanonicalFoodItem[];
  cacheType?: 'positive' | 'negative';
  results?: never[];
  [key: string]: unknown;
}

function isEdgeFunctionResponse(data: unknown): data is EdgeFunctionResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const response = data as EdgeFunctionResponse;

  // Handle negative cache responses
  if (response.cacheType === 'negative' && Array.isArray(response.results)) {
    return true;
  }

  // Handle responses with items
  if (!Array.isArray(response.items)) {
    return false;
  }

  return response.items.every(isCanonicalFoodItem);
}

function isCanonicalFoodItem(item: unknown): item is CanonicalFoodItem {
  if (typeof item !== 'object' || item === null) {
    return false;
  }

  const food = item as CanonicalFoodItem;

  return (
    (food.source === 'off' || food.source === 'usda') &&
    typeof food.external_id === 'string' &&
    typeof food.canonical_name === 'string' &&
    typeof food.macros_per_100g === 'object' &&
    food.macros_per_100g !== null
  );
}

function convertCanonicalToEdgeItem(item: CanonicalFoodItem): EdgeFoodItem {
  return {
    source: item.source,
    sourceId: item.external_id,
    name: item.canonical_name,
    normalizedName: item.canonical_name.toLowerCase().trim(),
    macrosPer100g: {
      kcal: item.macros_per_100g.kcal || 0,
      protein: item.macros_per_100g.protein || 0,
      carbs: item.macros_per_100g.carbs || 0,
      fat: item.macros_per_100g.fat || 0,
    },
  };
}

function convertEdgeFunctionResponse(response: EdgeFunctionResponse): EdgeSearchResponse {
  // Handle negative cache responses
  if (response.cacheType === 'negative') {
    return { items: [] };
  }

  // Filter out items with wrong source and convert canonical items to edge items
  const validItems = response.items.filter(item => {
    if (item.source !== 'off') {
      console.warn(`[SupabaseEdgeOffProvider] Rejecting item with wrong source: ${item.source}, expected: off, item: ${item.canonical_name}`);
      return false;
    }
    return true;
  });
  
  const items = validItems.map(convertCanonicalToEdgeItem);
  return { items };
}

export interface SupabaseClient {
  functions: {
    invoke(
      functionName: string,
      options?: { body?: unknown },
    ): Promise<{
      data: unknown;
      error: Error | null;
    }>;
  };
}

export class SupabaseEdgeOffProvider implements FoodSourceProvider {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  ) {}

  async search(params: {
    query: string;
    locale: 'de' | 'en';
    traceId?: string;
  }): Promise<EdgeSearchResponse> {
    return withRetry(
      async () => {
        console.log(
          `[${params.traceId || 'unknown'}] [EDGE] OFF ABOUT_TO_INVOKE function="food-off-search"`,
        );
        const { data, error } = await this.supabase.functions.invoke('food-off-search', {
          body: {
            query: params.query,
            locale: params.locale,
          },
        });

        if (error) {
          const status = (error as any).status || 'unknown';
          const msg = error.message || 'unknown error';
          let bodySnippet = 'none';
          try {
            if ((error as any).context && typeof (error as any).context.text === 'function') {
              bodySnippet = String(await (error as any).context.text()).substring(0, 50);
            }
          } catch {
            /* ignore */
          }

          console.log(
            `[${params.traceId || 'unknown'}] [EDGE] OFF invoke failed status=${status} message="${msg.substring(0, 50)}" body="${bodySnippet}"`,
          );
          throw FoodCatalogError.edge(`OFF search failed: ${error.message}`, error);
        }

        if (!data) {
          throw FoodCatalogError.invalidPayload('OFF search returned no data');
        }

        if (!isEdgeFunctionResponse(data)) {
          throw FoodCatalogError.invalidPayload('OFF search returned invalid response structure');
        }

        return convertEdgeFunctionResponse(data);
      },
      this.retryConfig,
      { name: 'SupabaseEdgeOffProvider', traceId: params.traceId },
    );
  }
}
