import { AiFoodMapper } from '../../application/ports/AiFoodMapper';
import { normalizeText } from '../../application/utils/normalizeText';

export class FakeAiFoodMapper implements AiFoodMapper {
  async mapToCanonicalFood(rawInput: string): Promise<{
    canonicalId: string;
    confidence: number;
    explanation: string;
  }> {
    const lower = rawInput.toLowerCase();

    // German to English mappings
    if (lower.includes('banane')) {
      return {
        canonicalId: 'banana',
        confidence: 0.8,
        explanation: 'Mapped German "banane" to canonical "banana"',
      };
    }

    if (lower.includes('hähnchen') || lower.includes('haehnchen')) {
      return {
        canonicalId: 'chicken breast',
        confidence: 0.8,
        explanation: 'Mapped German "hähnchen" to canonical "chicken breast"',
      };
    }

    if (lower.includes('pommes')) {
      return {
        canonicalId: 'fries',
        confidence: 0.8,
        explanation: 'Mapped German "pommes" to canonical "fries"',
      };
    }

    // Fallback: use normalized input as canonical ID
    const normalized = normalizeText(rawInput);
    return {
      canonicalId: normalized,
      confidence: 0.4,
      explanation: 'Fallback mapping: no specific rule matched',
    };
  }
}
