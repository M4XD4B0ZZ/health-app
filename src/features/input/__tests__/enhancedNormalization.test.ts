import { parseInput } from '../application/parseInput';
import { matchFood } from '../application/matchFood';
import { buildResolverFoodRequests } from '../application/buildResolverFoodRequests';
import { aggregateCanonicalItems } from '../application/aggregateCanonicalItems';

describe('Enhanced Normalization', () => {
  describe('German singular', () => {
    it("should recognize 'Ei' as egg", () => {
      const parsed = parseInput('Ei');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('ei');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });
  });

  describe('German plural', () => {
    it("should recognize 'Eier' as egg", () => {
      const parsed = parseInput('Eier');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });

    it('should keep singular and plural canonical mapping equivalent', () => {
      const singular = matchFood(parseInput('Ei'));
      const plural = matchFood(parseInput('Eier'));

      expect(singular[0].canonicalName).toBe('egg');
      expect(plural[0].canonicalName).toBe('egg');
      expect(singular[0].status).toBe('matched');
      expect(plural[0].status).toBe('matched');
    });
  });

  describe('German number words', () => {
    it("should parse 'zwei eier' correctly", () => {
      const parsed = parseInput('zwei eier');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[0].quantity).toBe(2);
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });

    it("should parse 'drei eier' correctly", () => {
      const parsed = parseInput('drei eier');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[0].quantity).toBe(3);
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });

    it("should parse 'vier eggs' correctly", () => {
      const parsed = parseInput('vier eggs');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eggs');
      expect(parsed.items[0].quantity).toBe(4);
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });

    it("should parse 'vier eier' correctly", () => {
      const parsed = parseInput('vier eier');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[0].quantity).toBe(4);
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });
  });

  describe('quantity with unit', () => {
    it("should parse '200g Eier' correctly", () => {
      const parsed = parseInput('200g Eier');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[0].quantity).toBe(200);
      expect(parsed.items[0].unit).toBe('g');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });

    it("should parse '1kg Reis' correctly", () => {
      const parsed = parseInput('1kg Reis');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('reis');
      expect(parsed.items[0].quantity).toBe(1);
      expect(parsed.items[0].unit).toBe('kg');
      expect(matches[0].canonicalName).toBe('rice');
      expect(matches[0].status).toBe('matched');
    });

    it("should parse '500ml Eier' correctly", () => {
      const parsed = parseInput('500ml Eier');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[0].quantity).toBe(500);
      expect(parsed.items[0].unit).toBe('ml');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });
  });

  describe('modifier handling', () => {
    it("should handle 'vier gekochte eggs'", () => {
      const parsed = parseInput('vier gekochte eggs');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eggs');
      expect(parsed.items[0].quantity).toBe(4);
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });

    it("should handle 'gekochte Eier'", () => {
      const parsed = parseInput('gekochte Eier');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });

    it("should handle 'gebratene Eier'", () => {
      const parsed = parseInput('gebratene Eier');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });

    it("should handle 'frisches Brot'", () => {
      const parsed = parseInput('frisches Brot');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('brot');
      expect(matches[0].canonicalName).toBe('bread');
      expect(matches[0].status).toBe('matched');
    });
  });

  describe('mixed recognized/unrecognized', () => {
    it("should handle 'Eier und mysteryfood'", () => {
      const parsed = parseInput('Eier und mysteryfood');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(2);
      expect(matches).toHaveLength(2);

      // Eier should be recognized
      expect(parsed.items[0].name).toBe('eier');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');

      // mysteryfood should be unresolved
      expect(parsed.items[1].name).toBe('mysteryfood');
      expect(matches[1].canonicalName).toBe(null);
      expect(matches[1].status).toBe('unmatched');
    });
  });

  describe('mixed canonical duplication', () => {
    it("should handle 'Eier und egg' as two ready egg items", () => {
      const parsed = parseInput('Eier und egg');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[1].name).toBe('egg');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[1].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
      expect(matches[1].status).toBe('matched');
    });

    it("should handle '2 Eier und Egg' - both normalize to egg", () => {
      const parsed = parseInput('2 Eier und Egg');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(2);
      expect(matches).toHaveLength(2);

      // Both should normalize to canonical egg
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[0].quantity).toBe(2);
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');

      expect(parsed.items[1].name).toBe('egg');
      expect(matches[1].canonicalName).toBe('egg');
      expect(matches[1].status).toBe('matched');
    });

    it("should aggregate 'vier eier und egg' with quantity word plus mixed language", () => {
      const parsed = parseInput('vier eier und egg');
      const matches = matchFood(parsed);
      const resolverRequests = buildResolverFoodRequests(parsed, matches);
      const aggregated = aggregateCanonicalItems(resolverRequests);

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].canonicalName).toBe('egg');
      expect(aggregated[0].quantity).toBe(5);
      expect(aggregated[0].rawName).toBe('eier + egg');
    });
  });

  describe('normalization edge cases', () => {
    it('should handle multiple spaces and punctuation', () => {
      const parsed = parseInput('2   Eier,   und   Toast!');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[0].quantity).toBe(2);
      expect(parsed.items[1].name).toBe('toast');
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[1].canonicalName).toBe('toast');
    });

    it('should handle mixed case with modifiers', () => {
      const parsed = parseInput('DREI GEKOCHTE EIER');
      const matches = matchFood(parsed);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].name).toBe('eier');
      expect(parsed.items[0].quantity).toBe(3);
      expect(matches[0].canonicalName).toBe('egg');
      expect(matches[0].status).toBe('matched');
    });
  });

  describe('canonical aggregation', () => {
    it("should aggregate '2 Eier und Egg' into single canonical item", () => {
      const parsed = parseInput('2 Eier und Egg');
      const matches = matchFood(parsed);
      const resolverRequests = buildResolverFoodRequests(parsed, matches);
      const aggregated = aggregateCanonicalItems(resolverRequests);

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].canonicalName).toBe('egg');
      expect(aggregated[0].quantity).toBe(3); // 2 + 1 (default for Egg)
      expect(aggregated[0].rawName).toBe('eier + egg');
      expect(aggregated[0].status).toBe('ready');
    });

    it('should not aggregate items with different units', () => {
      const parsed = parseInput('200g Eier und 2 Eier');
      const matches = matchFood(parsed);
      const resolverRequests = buildResolverFoodRequests(parsed, matches);
      const aggregated = aggregateCanonicalItems(resolverRequests);

      // Should keep separate because units are different (g vs null)
      expect(aggregated).toHaveLength(2);
      expect(aggregated[0].canonicalName).toBe('egg');
      expect(aggregated[1].canonicalName).toBe('egg');
    });

    it('should preserve alias-miss resolver-ready items during aggregation', () => {
      const parsed = parseInput('2 Eier und mysteryfood und Egg');
      const matches = matchFood(parsed);
      const resolverRequests = buildResolverFoodRequests(parsed, matches);
      const aggregated = aggregateCanonicalItems(resolverRequests);

      expect(aggregated).toHaveLength(2);

      // Should have one aggregated egg item
      const eggItem = aggregated.find((item) => item.canonicalName === 'egg');
      expect(eggItem).toBeDefined();
      expect(eggItem!.quantity).toBe(3); // 2 + 1
      expect(eggItem!.rawName).toBe('eier + egg');

      // Should preserve mysteryfood as resolver-ready alias miss
      const mysteryItem = aggregated.find((item) => item.rawName === 'mysteryfood');
      expect(mysteryItem).toBeDefined();
      expect(mysteryItem!.status).toBe('ready');
    });
  });
});
