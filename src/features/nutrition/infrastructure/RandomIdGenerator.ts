import { IdGenerator } from '../application/ports/IdGenerator';
import { generateRecordId } from '../../../infrastructure/ids/generateRecordId';

/**
 * ACC-003: delegates to the app's single central UUIDv4 generation boundary
 * (`generateRecordId`). Previously a timestamp+random string; durable records now get a
 * stable, standards-based identity suitable for future backup/sync.
 */
export class RandomIdGenerator implements IdGenerator {
  newId(): string {
    return generateRecordId();
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
