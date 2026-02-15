import { AiMealParser } from '../../application/ports/AiMealParser';
import { AiParsedMeal, AiParsedMealItem } from '../../domain/models/AiMealTypes';

/**
 * Fake AI Meal Parser
 * 
 * Deterministischer Stub für Tests und Entwicklung.
 * Simuliert AI-Verhalten ohne echtes LLM.
 * 
 * Beispiel: "20er nuggets mit cola und pommes" wird zu:
 * - { name: "nuggets", quantity: 20, unit: "piece" }
 * - { name: "cola", quantity: 400, unit: "ml", sizeHint: "medium" }
 * - { name: "pommes", quantity: 1, unit: "portion", sizeHint: "medium" }
 */
export class FakeAiMealParser implements AiMealParser {
  async parseMeal(rawInput: string): Promise<AiParsedMeal> {
    const normalized = rawInput.trim().toLowerCase();

    // Check for connectors
    const hasConnectors = 
      normalized.includes(' mit ') || 
      normalized.includes(' und ') || 
      normalized.includes('+') || 
      normalized.includes('&') ||
      normalized.includes(',');

    if (!hasConnectors) {
      // Single item - low confidence
      return {
        items: [{ name: normalized }],
        confidence: 0.4,
        explanation: 'Einfacher Einzeleintrag, keine Strukturerkennung möglich',
      };
    }

    // Multi-item parsing
    const items: AiParsedMealItem[] = [];
    let explanation = 'Multi-Item-Mahlzeit erkannt. Annahmen: ';
    const assumptions: string[] = [];

    // Split by connectors
    const parts = this.splitByConnectors(normalized);

    for (const part of parts) {
      const item = this.parseItem(part);
      if (item) {
        items.push(item);
      }
    }

    // Build explanation
    if (items.length > 1) {
      assumptions.push(`${items.length} Items strukturiert`);
    }
    
    // Add assumptions about quantities
    const hasDefaultQuantities = items.some(item => item.quantity && !this.hasExplicitQuantity(normalized, item.name));
    if (hasDefaultQuantities) {
      assumptions.push('Standardmengen für Getränke/Beilagen angenommen');
    }

    explanation += assumptions.join(', ');

    return {
      items,
      confidence: 0.7, // Medium-high confidence for multi-item
      explanation,
    };
  }

  private splitByConnectors(text: string): string[] {
    // Split by German connectors: "mit", "und", "+", "&", ","
    const parts: string[] = [];
    let current = '';

    // Replace connectors with a delimiter
    const delimited = text
      .replace(/\s+mit\s+/g, '|')
      .replace(/\s+und\s+/g, '|')
      .replace(/\+/g, '|')
      .replace(/&/g, '|')
      .replace(/,/g, '|');

    return delimited.split('|').map(p => p.trim()).filter(p => p.length > 0);
  }

  private parseItem(part: string): AiParsedMealItem | null {
    if (!part) return null;

    const normalized = part.trim();

    // Check for German "Xer" pattern: "20er nuggets"
    const germanCountMatch = normalized.match(/^(\d+)\s*er\s+(.+)$/i);
    if (germanCountMatch) {
      const quantity = Number.parseInt(germanCountMatch[1], 10);
      const name = germanCountMatch[2].trim();
      return {
        name,
        quantity,
        unit: 'piece',
      };
    }

    // Check for explicit quantity patterns
    const countMatch = normalized.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (countMatch) {
      const quantity = Number.parseInt(countMatch[1], 10);
      const name = countMatch[2].trim();
      return {
        name,
        quantity,
        unit: 'piece',
      };
    }

    const gramsMatch = normalized.match(/^(\d+(?:[.,]\d+)?)\s*g\s+(.+)$/i);
    if (gramsMatch) {
      const quantity = Number.parseFloat(gramsMatch[1].replace(',', '.'));
      const name = gramsMatch[2].trim();
      return {
        name,
        quantity,
        unit: 'g',
      };
    }

    // No explicit quantity - apply heuristics based on food type
    return this.applyDefaultQuantity(normalized);
  }

  private applyDefaultQuantity(name: string): AiParsedMealItem {
    // Heuristics for common foods
    
    // Drinks: default to 400ml medium
    if (this.isDrink(name)) {
      return {
        name,
        quantity: 400,
        unit: 'ml',
        sizeHint: 'medium',
      };
    }

    // Sides/Beilagen: default to 1 portion
    if (this.isSide(name)) {
      return {
        name,
        quantity: 1,
        unit: 'portion',
        sizeHint: 'medium',
      };
    }

    // Default: no quantity
    return { name };
  }

  private isDrink(name: string): boolean {
    const drinks = ['cola', 'fanta', 'sprite', 'wasser', 'saft', 'limo', 'bier', 'wein'];
    return drinks.some(drink => name.includes(drink));
  }

  private isSide(name: string): boolean {
    const sides = ['pommes', 'fries', 'reis', 'nudeln', 'salat', 'gemüse'];
    return sides.some(side => name.includes(side));
  }

  private hasExplicitQuantity(fullText: string, itemName: string): boolean {
    // Check if the item had an explicit quantity in the original text
    const pattern = new RegExp(`\\d+\\s*(?:er|x|g)?\\s*${itemName}`, 'i');
    return pattern.test(fullText);
  }
}
