import { splitMultiItemInput } from '../application/utils/splitMultiItemInput';

describe('splitMultiItemInput', () => {
  it('splits German connector "und"', () => {
    const result = splitMultiItemInput('2 Eier und 200g Quark');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['2 Eier', '200g Quark']);
  });

  it('splits English connector "and"', () => {
    const result = splitMultiItemInput('2 eggs and 200g quark');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['2 eggs', '200g quark']);
  });

  it('splits comma-separated items', () => {
    const result = splitMultiItemInput('apple, banana, skyr');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['apple', 'banana', 'skyr']);
  });

  it('splits mixed comma and English connector items', () => {
    const result = splitMultiItemInput('apple, banana and skyr');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['apple', 'banana', 'skyr']);
  });

  it('ignores empty fragments safely', () => {
    const result = splitMultiItemInput('apple, , banana and  skyr');

    expect(result.wasSplit).toBe(true);
    expect(result.items.map((item) => item.rawText)).toEqual(['apple', 'banana', 'skyr']);
  });

  it('does not split single-item input', () => {
    const result = splitMultiItemInput('20er nuggets');

    expect(result.wasSplit).toBe(false);
    expect(result.items.map((item) => item.rawText)).toEqual(['20er nuggets']);
  });
});
