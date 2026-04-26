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

    // DACH Strategy: Allow BLS for German generic AND ambiguous inputs
    const allowedInputTypes = ['generic', 'ambiguous'];
    if (query.locale !== 'de' || !allowedInputTypes.includes(query.inputType || 'ambiguous')) {
      const reason = query.locale !== 'de' ? 'non_german_locale' : 'branded_input_type';
      console.log(
        `[${traceId}] PROOF_BLS_SKIPPED reason="${reason}" locale="${query.locale}" inputType="${query.inputType}"`,
      );
      return [];
    }

    console.log(
      `[${traceId}] PROOF_BLS_ALLOWED locale="${query.locale}" inputType="${query.inputType}"`,
    );

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
    } else {
      // PROOF_BLS_MATCH logging
      const bestMatch = results[0];
      console.log(
        `[${traceId}] PROOF_BLS_MATCH input="${query.normalized}" candidates_count=${results.length} best_match="${bestMatch.food.name}" score=${bestMatch.match.similarity}`,
      );
    }

    return results;
  }
}
