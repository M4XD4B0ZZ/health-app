import { PortionParseResult } from './PortionParseResult';
import { normalizePortionText, parseLocaleNumber, parseNumberToken } from './UnitNormalization';

export interface PortionParserContext {
  hasBaseGrams: boolean;
}

export class PortionParser {
  parse(input: string, context: PortionParserContext): PortionParseResult {
    const text = normalizePortionText(input);

    const kgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
    if (kgMatch) {
      const kg = parseLocaleNumber(kgMatch[1]);
      if (kg !== null) {
        return {
          status: 'resolved',
          grams: kg * 1000,
          notes: ['GRAMS_FROM_KG'],
          confidence: 0.99,
        };
      }
    }

    const gramsMatch = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
    if (gramsMatch) {
      const grams = parseLocaleNumber(gramsMatch[1]);
      if (grams !== null) {
        return {
          status: 'resolved',
          grams,
          notes: ['GRAMS_SET'],
          confidence: 0.99,
        };
      }
    }

    const hasMl = /(\d+(?:[.,]\d+)?)\s*ml\b/.test(text);
    const hasLiter = /(\d+(?:[.,]\d+)?)\s*l\b/.test(text);
    if (hasMl || hasLiter) {
      return {
        status: 'ambiguous',
        notes: ['ML_UNSUPPORTED'],
        confidence: 0.45,
      };
    }

    if (
      text.includes('doppelte portion') ||
      text.includes('doppelt') ||
      text.includes('double portion') ||
      text === 'double'
    ) {
      return {
        status: 'resolved',
        multiplier: 2,
        notes: ['MULTIPLIER_SET'],
        confidence: 0.9,
      };
    }

    if (
      text.includes('halbe portion') ||
      text === 'halbe' ||
      text === 'halb' ||
      text === 'haelfte' ||
      text.includes('half portion') ||
      text === 'half'
    ) {
      return {
        status: 'resolved',
        multiplier: 0.5,
        notes: ['MULTIPLIER_SET'],
        confidence: 0.9,
      };
    }

    const countXMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*x$/);
    if (countXMatch) {
      const multiplier = parseLocaleNumber(countXMatch[1]);
      if (multiplier !== null) {
        return this.multiplierResult(multiplier, context.hasBaseGrams);
      }
    }

    const exactToken = text.match(/^([a-zA-Z]+|\d+(?:[.,]\d+)?)$/);
    if (exactToken) {
      const multiplier = parseNumberToken(exactToken[1]);
      if (multiplier !== null) {
        return this.multiplierResult(multiplier, context.hasBaseGrams);
      }
    }

    return {
      status: 'unresolved',
      notes: ['NO_PORTION_SIGNAL'],
      confidence: 0.2,
    };
  }

  private multiplierResult(multiplier: number, hasBaseGrams: boolean): PortionParseResult {
    if (!hasBaseGrams) {
      return {
        status: 'ambiguous',
        notes: ['COUNT_WITHOUT_BASE'],
        confidence: 0.4,
      };
    }

    return {
      status: 'resolved',
      multiplier,
      notes: ['MULTIPLIER_SET'],
      confidence: 0.8,
    };
  }
}
