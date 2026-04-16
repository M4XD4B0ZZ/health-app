import { FoodCatalogResolver } from './FoodCatalogResolver';
import { FusionCandidateResolver } from './FusionCandidateResolver';
import { FoodSearchQuery, FoodCatalogSource } from '../../domain/catalog/FoodCatalogSource';
import { ResolverDecision } from '../../domain/models/ResolverDecision';

/**
 * Adapter to integrate FusionCandidateResolver alongside existing SequentialFoodCatalogResolver
 * Allows feature-flagged or side-by-side testing without breaking existing functionality
 */
export class FusionResolverAdapter implements FoodCatalogResolver {
  private readonly fusionResolver: FusionCandidateResolver;
  private readonly fallbackResolver?: FoodCatalogResolver;

  constructor(
    sources: FoodCatalogSource[],
    fallbackResolver?: FoodCatalogResolver,
    private readonly config: {
      enableFusion: boolean;
      enableFallback: boolean;
      logComparison: boolean;
    } = {
      enableFusion: true,
      enableFallback: false,
      logComparison: false,
    }
  ) {
    this.fusionResolver = new FusionCandidateResolver(sources);
    this.fallbackResolver = fallbackResolver;
  }

  async resolve(query: FoodSearchQuery, ctx?: { traceId?: string }): Promise<ResolverDecision> {
    const traceId = ctx?.traceId || query.traceId || this.generateTraceId();

    try {
      // Primary path: Use Fusion Resolver
      if (this.config.enableFusion) {
        console.log(`[${traceId}] PROOF_FUSION_ADAPTER using fusion resolver`);
        
        const fusionResult = await this.fusionResolver.resolve(query, { traceId });
        
        // Optional: Compare with fallback for validation
        if (this.config.enableFallback && this.fallbackResolver && this.config.logComparison) {
          await this.compareWithFallback(query, fusionResult, traceId);
        }
        
        return fusionResult;
      }

      // Fallback path: Use existing resolver
      if (this.config.enableFallback && this.fallbackResolver) {
        console.log(`[${traceId}] PROOF_FUSION_ADAPTER using fallback resolver`);
        return await this.fallbackResolver.resolve(query, ctx);
      }

      // No resolver available - should not happen in production
      throw new Error('No resolver configured');

    } catch (error) {
      console.error(`[${traceId}] PROOF_FUSION_ADAPTER_ERROR`, error);
      
      // Graceful degradation to fallback
      if (this.fallbackResolver && this.config.enableFallback) {
        console.log(`[${traceId}] PROOF_FUSION_ADAPTER degrading to fallback`);
        return await this.fallbackResolver.resolve(query, ctx);
      }
      
      // Return error decision
      return this.createErrorDecision(query, error);
    }
  }

  /**
   * Compare fusion result with fallback for validation/debugging
   */
  private async compareWithFallback(
    query: FoodSearchQuery,
    fusionResult: ResolverDecision,
    traceId: string
  ): Promise<void> {
    if (!this.fallbackResolver) return;

    try {
      const fallbackResult = await this.fallbackResolver.resolve(query, { traceId });
      
      const comparison = {
        fusionStatus: fusionResult.status,
        fallbackStatus: fallbackResult.status,
        fusionWinner: fusionResult.best?.source || 'none',
        fallbackWinner: fallbackResult.best?.source || 'none',
        fusionCandidates: fusionResult.candidates.length,
        fallbackCandidates: fallbackResult.candidates.length,
        agreement: fusionResult.status === fallbackResult.status,
        winnerAgreement: fusionResult.best?.source === fallbackResult.best?.source,
      };
      
      console.log(`[${traceId}] PROOF_FUSION_COMPARISON`, JSON.stringify(comparison));
      
    } catch (error) {
      console.warn(`[${traceId}] PROOF_FUSION_COMPARISON_FAILED`, error);
    }
  }

  /**
   * Create error decision when both resolvers fail
   */
  private createErrorDecision(query: FoodSearchQuery, error: any): ResolverDecision {
    return {
      normalizedQuery: query.normalized,
      status: 'rejected',
      reasonCodes: ['ADAPTER_ERROR'],
      candidates: [],
      createdAt: new Date().toISOString(),
    };
  }

  private generateTraceId(): string {
    return `fusion-adapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create FusionResolverAdapter with different configurations
 */
export class FusionResolverAdapterFactory {
  /**
   * Create adapter for production use (fusion only)
   */
  static createProductionAdapter(sources: FoodCatalogSource[]): FusionResolverAdapter {
    return new FusionResolverAdapter(sources, undefined, {
      enableFusion: true,
      enableFallback: false,
      logComparison: false,
    });
  }

  /**
   * Create adapter for A/B testing (fusion with fallback comparison)
   */
  static createTestingAdapter(
    sources: FoodCatalogSource[],
    fallbackResolver: FoodCatalogResolver
  ): FusionResolverAdapter {
    return new FusionResolverAdapter(sources, fallbackResolver, {
      enableFusion: true,
      enableFallback: true,
      logComparison: true,
    });
  }

  /**
   * Create adapter for gradual rollout (fallback with fusion comparison)
   */
  static createRolloutAdapter(
    sources: FoodCatalogSource[],
    fallbackResolver: FoodCatalogResolver,
    useFusion: boolean = false
  ): FusionResolverAdapter {
    return new FusionResolverAdapter(sources, fallbackResolver, {
      enableFusion: useFusion,
      enableFallback: true,
      logComparison: useFusion,
    });
  }

  /**
   * Create adapter for development/debugging (both resolvers with comparison)
   */
  static createDebugAdapter(
    sources: FoodCatalogSource[],
    fallbackResolver: FoodCatalogResolver
  ): FusionResolverAdapter {
    return new FusionResolverAdapter(sources, fallbackResolver, {
      enableFusion: true,
      enableFallback: true,
      logComparison: true,
    });
  }
}