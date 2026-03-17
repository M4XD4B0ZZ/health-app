export class DeterministicFoodParser {
  germanNumberWords = ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'];

  matchGermanNumberWord(word: string): number | null {
    const index = this.germanNumberWords.indexOf(word.toLowerCase());
    return index >= 0 ? index + 1 : null;
  }

  parse(input: string) {
    // Minimal parse implementation for integration
    return [];
  }
}
