import { IdGenerator } from '../application/ports/IdGenerator';

/**
 * Einfacher ID-Generator ohne externe Dependencies.
 * Nutzt Timestamp + Random für Uniqueness.
 * Für echte Produktion kann später UUID-Library verwendet werden.
 */
export class RandomIdGenerator implements IdGenerator {
  newId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${randomPart}`;
  }
}

/**
 * Deterministische ID-Generator-Implementierung für Tests.
 * Generiert IDs in der Form: "test-id-0", "test-id-1", ...
 */
export class TestIdGenerator implements IdGenerator {
  private counter = 0;

  newId(): string {
    return `test-id-${this.counter++}`;
  }

  reset(): void {
    this.counter = 0;
  }
}
