import {
  InputConfidenceClassifier,
  MatchMetadata,
} from '../../domain/confidence/InputConfidenceClassifier';
import { InputConfidenceClassification } from '../../domain/models/ResolverDecision';

export class DefaultInputConfidenceClassifier implements InputConfidenceClassifier {
  private readonly knownExactFoods = new Set([
    'magerquark',
    'toast',
    'apfel',
    'banane',
    'reis',
    'nudeln',
    'haferflocken',
    'milch',
    'ei',
    'hähnchenbrust',
  ]);

  private readonly vagueInputs = new Set([
    'pizza',
    'essen',
    'snack',
    'süßes',
    'fleisch',
    'gemüse',
    'obst',
    'brot',
  ]);

  classify(
    rawInput: string,
    normalizedInput: string,
    matchMetadata?: MatchMetadata,
  ): InputConfidenceClassification {
    // 1. Prüfe auf Alias-Usage
    if (matchMetadata?.usedHeuristic === 'alias' || matchMetadata?.fromAlias) {
      return {
        level: 'medium',
        reason: 'alias_match',
        assumptions: [`interpreted as ${this.getAliasTarget(normalizedInput)}`],
      };
    }

    // 2. Prüfe auf Fuzzy/Non-exact Matches
    if (matchMetadata?.usedHeuristic === 'fuzzy' || matchMetadata?.exact === false) {
      return {
        level: 'low',
        reason: 'fuzzy_or_partial_match',
      };
    }

    // 3. Prüfe auf exakte bekannte Foods
    if (this.isExactKnownFood(normalizedInput)) {
      return {
        level: 'high',
        reason: 'exact_known_food',
      };
    }

    // 4. Prüfe auf vage Inputs
    if (this.isVagueInput(rawInput)) {
      return {
        level: 'low',
        reason: 'vague_input',
      };
    }

    // Default: medium confidence
    return {
      level: 'medium',
      reason: 'default_classification',
    };
  }

  private isExactKnownFood(normalizedInput: string): boolean {
    return this.knownExactFoods.has(normalizedInput.toLowerCase());
  }

  private isVagueInput(rawInput: string): boolean {
    return this.vagueInputs.has(rawInput.toLowerCase());
  }

  private getAliasTarget(normalizedInput: string): string {
    // Einfache Mapping-Logik für bekannte Aliases
    const aliasMap: Record<string, string> = {
      quark: 'magerquark',
      speisequark: 'magerquark',
    };

    return aliasMap[normalizedInput.toLowerCase()] || normalizedInput;
  }
}