import { parseInput } from '../parseInput';

describe('parseInput', () => {
  it("should parse '2 Eier und Toast' correctly", () => {
    const result = parseInput('2 Eier und Toast');

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe('eier');
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[1].name).toBe('toast');
  });
});
