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

    if (query.locale !== 'de' || query.inputType !== 'generic') {
      return [];
    }

    const shortcutCandidate = getBlsShortcutCandidate(query.normalized);
    if (shortcutCandidate) {
      console.log(
        `[${traceId}] PROOF_CANONICAL_SHORTCUT_USED shortcut="${query.normalized}" source="bls"`,
      );
      return [shortcutCandidate];
    }

    return searchBlsGenericFoods(query.normalized);
  }
}
