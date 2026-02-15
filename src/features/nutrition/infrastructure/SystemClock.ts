import { Clock } from '../application/ports/Clock';

/**
 * Produktion-Implementierung der Clock.
 * Nutzt die System-Zeit.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  todayISO(): string {
    return this.now().toISOString().slice(0, 10);
  }
}
