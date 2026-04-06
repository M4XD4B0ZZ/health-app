import {
  FoodCandidate,
  FoodCatalogSource,
  FoodSearchQuery,
} from '../../../domain/catalog/FoodCatalogSource';
import { getBlsShortcutCandidate, searchBlsGenericFoods } from './blsGenericFoods';

export class BlsStaticSource implements FoodCatalogSource {
  type = 'bls' as const;

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    const traceId = query.traceId || 'unknown';
    console.log(`[DEBUG] BLS CALLED with query="${query.normalized}"`);

    if (query.locale !== 'de' || query.inputType !== 'generic') {
      console.log(`[DEBUG] BLS SKIPPED locale="${query.locale}" inputType="${query.inputType}"`);
      return [];
    }

    const shortcutCandidate = getBlsShortcutCandidate(query.normalized);
    if (shortcutCandidate) {
      console.log(
        `[${traceId}] PROOF_CANONICAL_SHORTCUT_USED shortcut="${query.normalized}" source="bls"`,
      );
      console.log(`[DEBUG] BLS RESULTS count=1 (shortcut)`);
      return [shortcutCandidate];
    }

    const results = searchBlsGenericFoods(query.normalized);
    console.log(`[DEBUG] BLS RESULTS count=${results.length}`);
    
    if (results.length === 0) {
      console.log(`[DEBUG] BLS NO MATCH for "${query.normalized}"`);
    }
    
    return results;
  }
}
