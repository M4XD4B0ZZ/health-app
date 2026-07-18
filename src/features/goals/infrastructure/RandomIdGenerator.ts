import { IdGenerator } from '../application/ports';
import { generateRecordId } from '../../../infrastructure/ids/generateRecordId';

/**
 * ACC-003: delegates to the app's single central UUIDv4 generation boundary
 * (`generateRecordId`). Previously a timestamp+random string; the MetabolismProfile's
 * `id` now gets a stable, standards-based identity suitable for future backup/sync.
 */
export class RandomIdGenerator implements IdGenerator {
  newId(): string {
    return generateRecordId();
  }
}

/**
 * Deterministic ID generator for testing
 * Generates IDs in the form: "test-id-0", "test-id-1", ...
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
