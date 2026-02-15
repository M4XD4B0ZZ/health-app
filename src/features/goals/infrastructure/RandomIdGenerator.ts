import { IdGenerator } from "../application/ports"

/**
 * Simple ID generator without external dependencies
 * Uses timestamp + random for uniqueness
 * For production, a UUID library can be used later
 */
export class RandomIdGenerator implements IdGenerator {
  newId(): string {
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substring(2, 11)
    return `${timestamp}-${randomPart}`
  }
}

/**
 * Deterministic ID generator for testing
 * Generates IDs in the form: "test-id-0", "test-id-1", ...
 */
export class TestIdGenerator implements IdGenerator {
  private counter = 0

  newId(): string {
    return `test-id-${this.counter++}`
  }

  reset(): void {
    this.counter = 0
  }
}
