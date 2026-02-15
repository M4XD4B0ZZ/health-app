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

  describe('German "Xer" Count-Parsing', () => {
    it('sollte "20er nuggets" korrekt parsen', () => {
      const result = parser.parse('20er nuggets');
      expect(result.name).toBe('nuggets');
      expect(result.quantityCount).toBe(20);
      expect(result.unit).toBe('count');
      expect(result.quantityGrams).toBeUndefined();
    });

    it('sollte "6er nuggets" korrekt parsen', () => {
      const result = parser.parse('6er nuggets');
      expect(result.name).toBe('nuggets');
      expect(result.quantityCount).toBe(6);
      expect(result.unit).toBe('count');
    });

    it('sollte "10er chicken wings" korrekt parsen', () => {
      const result = parser.parse('10er chicken wings');
      expect(result.name).toBe('chicken wings');
      expect(result.quantityCount).toBe(10);
      expect(result.unit).toBe('count');
    });

    it('sollte case-insensitive sein', () => {
      const result = parser.parse('20ER NUGGETS');
      expect(result.name).toBe('nuggets');
      expect(result.quantityCount).toBe(20);
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

  describe('Deutsche Zahlwörter', () => {
    it('sollte "zwei äpfel" korrekt parsen', () => {
      const result = parser.parse('zwei äpfel');
      expect(result.name).toBe('äpfel');
      expect(result.quantityCount).toBe(2);
      expect(result.unit).toBe('count');
      expect(result.quantityGrams).toBeUndefined();
    });

    it('sollte "drei eier" korrekt parsen', () => {
      const result = parser.parse('drei eier');
      expect(result.name).toBe('eier');
      expect(result.quantityCount).toBe(3);
      expect(result.unit).toBe('count');
    });

    it('sollte "ein apfel" korrekt parsen', () => {
      const result = parser.parse('ein apfel');
      expect(result.name).toBe('apfel');
      expect(result.quantityCount).toBe(1);
      expect(result.unit).toBe('count');
    });

    it('sollte "eine banane" korrekt parsen', () => {
      const result = parser.parse('eine banane');
      expect(result.name).toBe('banane');
      expect(result.quantityCount).toBe(1);
      expect(result.unit).toBe('count');
    });

    it('sollte "einen apfel" korrekt parsen', () => {
      const result = parser.parse('einen apfel');
      expect(result.name).toBe('apfel');
      expect(result.quantityCount).toBe(1);
      expect(result.unit).toBe('count');
    });

    it('sollte "eins apfel" korrekt parsen', () => {
      const result = parser.parse('eins apfel');
      expect(result.name).toBe('apfel');
      expect(result.quantityCount).toBe(1);
      expect(result.unit).toBe('count');
    });

    it('sollte "vier bananen" korrekt parsen', () => {
      const result = parser.parse('vier bananen');
      expect(result.name).toBe('bananen');
      expect(result.quantityCount).toBe(4);
      expect(result.unit).toBe('count');
    });

    it('sollte "fünf äpfel" korrekt parsen', () => {
      const result = parser.parse('fünf äpfel');
      expect(result.name).toBe('äpfel');
      expect(result.quantityCount).toBe(5);
      expect(result.unit).toBe('count');
    });

    it('sollte "fuenf äpfel" korrekt parsen (ohne Umlaut)', () => {
      const result = parser.parse('fuenf äpfel');
      expect(result.name).toBe('äpfel');
      expect(result.quantityCount).toBe(5);
      expect(result.unit).toBe('count');
    });

    it('sollte "sechs eier" korrekt parsen', () => {
      const result = parser.parse('sechs eier');
      expect(result.name).toBe('eier');
      expect(result.quantityCount).toBe(6);
      expect(result.unit).toBe('count');
    });

    it('sollte "sieben brötchen" korrekt parsen', () => {
      const result = parser.parse('sieben brötchen');
      expect(result.name).toBe('brötchen');
      expect(result.quantityCount).toBe(7);
      expect(result.unit).toBe('count');
    });

    it('sollte "acht pfannkuchen" korrekt parsen', () => {
      const result = parser.parse('acht pfannkuchen');
      expect(result.name).toBe('pfannkuchen');
      expect(result.quantityCount).toBe(8);
      expect(result.unit).toBe('count');
    });

    it('sollte "neun cookies" korrekt parsen', () => {
      const result = parser.parse('neun cookies');
      expect(result.name).toBe('cookies');
      expect(result.quantityCount).toBe(9);
      expect(result.unit).toBe('count');
    });

    it('sollte "zehn erdbeeren" korrekt parsen', () => {
      const result = parser.parse('zehn erdbeeren');
      expect(result.name).toBe('erdbeeren');
      expect(result.quantityCount).toBe(10);
      expect(result.unit).toBe('count');
    });

    it('sollte case-insensitive sein', () => {
      const result = parser.parse('ZWEI ÄPFEL');
      expect(result.name).toBe('äpfel');
      expect(result.quantityCount).toBe(2);
    });

    it('sollte Namen mit mehreren Wörtern unterstützen', () => {
      const result = parser.parse('drei chicken nuggets');
      expect(result.name).toBe('chicken nuggets');
      expect(result.quantityCount).toBe(3);
      expect(result.unit).toBe('count');
    });
  });
});
