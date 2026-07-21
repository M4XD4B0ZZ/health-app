import { isDebugLoggingEnabled } from '../../../../infrastructure/config/appEnv';
import type {
  PersonalResolutionMemoryReadTelemetry,
  PersonalResolutionMemoryReadTelemetryEvent,
} from '../../application/ports/PersonalResolutionMemoryReadTelemetry';

/**
 * RESOLVER-V3-019: production telemetry adapter. Deliberately dependency-free (no new table or
 * migration): counts and closed enum values only, no raw input, no food/candidate identity, no
 * owner ID — printed only behind the same `isDebugLoggingEnabled()` gate already used for other
 * resolver diagnostics (e.g. `PROOF_*` logs in `SequentialFoodCatalogResolver`), and always a
 * no-op cost outside that gate. Never throws: a telemetry failure must never affect resolution.
 */
export class ConsolePersonalResolutionMemoryReadTelemetry implements PersonalResolutionMemoryReadTelemetry {
  record(event: PersonalResolutionMemoryReadTelemetryEvent): void {
    if (!isDebugLoggingEnabled()) return;
    try {
      console.log(
        `PROOF_PERSONAL_MEMORY_READ ownerPresent=${event.ownerPresent} targetCount=${event.targetCount} matchCount=${event.matchCount} deterministicReuseMatchCount=${event.deterministicReuseMatchCount} preferredMatchCount=${event.preferredMatchCount} avoided=${event.avoided}`,
      );
    } catch {
      // Telemetry must never affect resolution.
    }
  }
}
