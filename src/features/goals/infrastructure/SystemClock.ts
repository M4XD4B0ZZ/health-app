import { Clock } from "../application/ports"

/**
 * Production implementation of Clock using system time
 */
export class SystemClock implements Clock {
  nowISO(): string {
    return new Date().toISOString()
  }
}

/**
 * Fixed clock implementation for testing
 */
export class FixedClock implements Clock {
  constructor(private readonly fixedTime: string) {}

  nowISO(): string {
    return this.fixedTime
  }
}
