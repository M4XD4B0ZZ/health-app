/**
 * RESOLVER-V3-019: measures what the Decision Record's economics section requires ("avoided AI
 * calls MUST be measurable") without inventing a metric or hard-coding it to zero. `avoided`
 * counts only cases where a P2-confirmed match actually changed the outcome the caller would
 * otherwise have gotten (a genuinely avoided escalation) — a redundant confirmation of an
 * already-accepted decision is not counted as avoided, so the number stays honest.
 */
export interface PersonalResolutionMemoryReadTelemetryEvent {
  ownerPresent: boolean;
  targetCount: number;
  matchCount: number;
  deterministicReuseMatchCount: number;
  preferredMatchCount: number;
  avoided: boolean;
}

export interface PersonalResolutionMemoryReadTelemetry {
  record(event: PersonalResolutionMemoryReadTelemetryEvent): void;
}

/** Test/default fallback: records nothing. */
export class NoopPersonalResolutionMemoryReadTelemetry implements PersonalResolutionMemoryReadTelemetry {
  record(): void {
    // Intentionally does nothing.
  }
}
