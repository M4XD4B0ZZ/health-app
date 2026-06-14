import { parseInput } from '../parseInput';

describe('parseInput', () => {
  it("should parse '2 Eier und Toast' correctly", () => {
    const result = parseInput('2 Eier und Toast');

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe('eier');
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[1].name).toBe('toast');
  });

  it.each([
    ['ei und quark'],
    ['ei mit quark'],
    ['ei, quark'],
    ['egg and quark'],
    ['egg with quark'],
  ])('should parse P1-003 connector input %s as two items', (input) => {
    const result = parseInput(input);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe(input.startsWith('egg') ? 'egg' : 'ei');
    expect(result.items[1].name).toBe('quark');
  });
});
