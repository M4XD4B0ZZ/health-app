import type { FoodSourceProvider } from './FoodSourceProvider';
import { EdgeSearchResponse, isEdgeSearchResponse } from './EdgeSearchTypes';
import { FoodCatalogError } from '../../../domain/errors/FoodCatalogError';
import { withRetry, DEFAULT_RETRY_CONFIG, RetryConfig } from './RetryHelper';

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
  ) { }

  async search(params: {
    query: string;
    locale: 'de' | 'en';
    traceId?: string;
  }): Promise<EdgeSearchResponse> {
    return withRetry(
      async () => {
        console.log(`[${params.traceId || 'unknown'}] [EDGE] OFF ABOUT_TO_INVOKE function="food-off-search"`);
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
          } catch (e) { }

          console.log(`[${params.traceId || 'unknown'}] [EDGE] OFF invoke failed status=${status} message="${msg.substring(0, 50)}" body="${bodySnippet}"`);
          throw FoodCatalogError.edge(`OFF search failed: ${error.message}`, error);
        }

        if (!data) {
          throw FoodCatalogError.invalidPayload('OFF search returned no data');
        }

        if (!isEdgeSearchResponse(data)) {
          throw FoodCatalogError.invalidPayload('OFF search returned invalid response structure');
        }

        return data;
      },
      this.retryConfig,
      { name: 'SupabaseEdgeOffProvider', traceId: params.traceId },
    );
  }
}
