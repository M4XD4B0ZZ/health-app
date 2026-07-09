import {
  COMPOSITE_DISH_HEAD_WORDS,
  isCompositeDishHeadWord,
} from '../domain/catalog/CompositeDishPatterns';

describe('CompositeDishPatterns (P1-005)', () => {
  it('defines a seed list of ~15-20 composite-dish head-words', () => {
    expect(COMPOSITE_DISH_HEAD_WORDS.length).toBeGreaterThanOrEqual(15);
    expect(COMPOSITE_DISH_HEAD_WORDS.length).toBeLessThanOrEqual(20);
  });

  it('carries no macro/nutrition data - entries are plain strings only', () => {
    for (const headWord of COMPOSITE_DISH_HEAD_WORDS) {
      expect(typeof headWord).toBe('string');
      expect(headWord.length).toBeGreaterThan(0);
    }
  });

  it.each(['Fruchtsalat', 'Obstsalat', 'Wurstsalat', 'Auflauf', 'Nudelauflauf', 'Eintopf'])(
    'recognizes curated head-word "%s"',
    (headWord) => {
      expect(isCompositeDishHeadWord(headWord)).toBe(true);
    },
  );

  it('is case-insensitive and umlaut-normalized', () => {
    expect(isCompositeDishHeadWord('FRUCHTSALAT')).toBe(true);
    expect(isCompositeDishHeadWord('gemüsesalat')).toBe(true);
    expect(isCompositeDishHeadWord('gemuesesalat')).toBe(true);
  });

  it('matches the last token when the head has an adjective prefix', () => {
    expect(isCompositeDishHeadWord('gemischter Fruchtsalat')).toBe(true);
  });

  it('rejects ordinary foods that are not curated composite-dish head-words', () => {
    expect(isCompositeDishHeadWord('Haehnchen')).toBe(false);
    expect(isCompositeDishHeadWord('Reis')).toBe(false);
    expect(isCompositeDishHeadWord('')).toBe(false);
  });
});
