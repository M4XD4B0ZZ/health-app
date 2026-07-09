import {
  COMPOSITE_DISH_HEAD_WORDS,
  isKnownCompositeDishHeadWord,
} from '../domain/catalog/CompositeDishPatterns';
import { splitMultiItemInput } from '../application/utils/splitMultiItemInput';

describe('CompositeDishPatterns (P1-005)', () => {
  it('defines a small curated seed list (~15-20 head-words)', () => {
    expect(COMPOSITE_DISH_HEAD_WORDS.length).toBeGreaterThanOrEqual(15);
    expect(COMPOSITE_DISH_HEAD_WORDS.length).toBeLessThanOrEqual(20);
  });

  it('is structurally separate from nutrition/macro data (plain strings only)', () => {
    COMPOSITE_DISH_HEAD_WORDS.forEach((headWord) => {
      expect(typeof headWord).toBe('string');
    });
    // No duplicate entries in the seed list.
    expect(new Set(COMPOSITE_DISH_HEAD_WORDS).size).toBe(COMPOSITE_DISH_HEAD_WORDS.length);
  });

  it.each(['Fruchtsalat', 'Wurstsalat', 'Nudelauflauf', 'GEMÜSEPFANNE'])(
    'recognizes curated head-word %s case/umlaut-insensitively',
    (headWord) => {
      expect(isKnownCompositeDishHeadWord(headWord)).toBe(true);
    },
  );

  it('does not recognize an arbitrary non-curated word', () => {
    expect(isKnownCompositeDishHeadWord('burger')).toBe(false);
  });

  it.each(['Fruchtsalat', 'Wurstsalat', 'Nudelauflauf'])(
    'curated head-word %s triggers existing P1-003B/C grouping behavior',
    (headWord) => {
      const result = splitMultiItemInput(`${headWord} mit Bananen, Kirschen`);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].label.rawText).toBe(headWord);
      expect(isKnownCompositeDishHeadWord(result.groups[0].label.rawText)).toBe(true);
    },
  );

  it('a non-curated head-word still triggers grouping (list is additive, not a gate)', () => {
    const result = splitMultiItemInput('Currywurst mit Pommes, Majo');

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].label.rawText).toBe('Currywurst');
    expect(isKnownCompositeDishHeadWord(result.groups[0].label.rawText)).toBe(false);
  });
});
