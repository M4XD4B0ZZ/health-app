import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';

describe('DeterministicFoodParser', () => {
  let parser: DeterministicFoodParser;

  beforeEach(() => {
    parser = new DeterministicFoodParser();
  });

  describe('Gramm-Parsing', () => {
    it('sollte "250g chicken breast" korrekt parsen', () => {
      const result = parser.parse('250g chicken breast');
      expect(result.name).toBe('chicken breast');
      expect(result.quantityGrams).toBe(250);
      expect(result.unit).toBe('g');
      expect(result.quantityCount).toBeUndefined();
    });

    it('sollte "skyr 200 g" korrekt parsen (mit Leerzeichen)', () => {
      const result = parser.parse('skyr 200 g');
      expect(result.name).toBe('skyr');
      expect(result.quantityGrams).toBe(200);
      expect(result.unit).toBe('g');
    });

    it('sollte Dezimalwerte mit Punkt parsen', () => {
      const result = parser.parse('125.5g rice');
      expect(result.name).toBe('rice');
      expect(result.quantityGrams).toBe(125.5);
      expect(result.unit).toBe('g');
    });

    it('sollte Dezimalwerte mit Komma parsen', () => {
      const result = parser.parse('125,5g rice');
      expect(result.name).toBe('rice');
      expect(result.quantityGrams).toBe(125.5);
      expect(result.unit).toBe('g');
    });
  });

  describe('Count-Parsing', () => {
    it('sollte "2 eggs" korrekt parsen', () => {
      const result = parser.parse('2 eggs');
      expect(result.name).toBe('eggs');
      expect(result.quantityCount).toBe(2);
      expect(result.unit).toBe('count');
      expect(result.quantityGrams).toBeUndefined();
    });

    it('sollte "3x eggs" korrekt parsen', () => {
      const result = parser.parse('3x eggs');
      expect(result.name).toBe('eggs');
      expect(result.quantityCount).toBe(3);
      expect(result.unit).toBe('count');
    });

    it('sollte "2 x eggs" korrekt parsen (mit Leerzeichen)', () => {
      const result = parser.parse('2 x eggs');
      expect(result.name).toBe('eggs');
      expect(result.quantityCount).toBe(2);
      expect(result.unit).toBe('count');
    });
  });

  describe('Ohne Mengenangabe', () => {
    it('sollte "banana" ohne Menge parsen', () => {
      const result = parser.parse('banana');
      expect(result.name).toBe('banana');
      expect(result.quantityGrams).toBeUndefined();
      expect(result.quantityCount).toBeUndefined();
      expect(result.unit).toBeUndefined();
    });

    it('sollte "protein shake 30g" korrekt parsen', () => {
      const result = parser.parse('protein shake 30g');
      expect(result.name).toBe('protein shake');
      expect(result.quantityGrams).toBe(30);
      expect(result.unit).toBe('g');
    });
  });

  describe('Normalisierung', () => {
    it('sollte mehrfache Leerzeichen entfernen', () => {
      const result = parser.parse('chicken   breast   200g');
      expect(result.name).toBe('chicken breast');
      expect(result.quantityGrams).toBe(200);
    });

    it('sollte Whitespace trimmen', () => {
      const result = parser.parse('  chicken breast 200g  ');
      expect(result.name).toBe('chicken breast');
      expect(result.quantityGrams).toBe(200);
    });

    it('sollte lowercase verwenden', () => {
      const result = parser.parse('CHICKEN BREAST 200G');
      expect(result.name).toBe('chicken breast');
      expect(result.quantityGrams).toBe(200);
    });
  });
});
