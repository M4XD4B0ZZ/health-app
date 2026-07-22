import { REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION } from './RepresentativeHybridV1LiveVersions';

/**
 * Closed-schema runtime validator for the persisted `resolver-v3-039-*.json` report artifact.
 * Rejects unknown top-level fields and a mismatched `reportVersion` -- catches drift between the
 * TypeScript-authored builder and a hand-edited or stale JSON file on disk.
 */

const REQUIRED_TOP_LEVEL_KEYS = [
  'reportVersion',
  'protocolVersion',
  'executionPlanVersion',
  'corpusVersion',
  'registryVersion',
  'harnessVersion',
  'sourceManifestVersion',
  'corpusHash',
  'sourceManifestHash',
  'planHash',
  'protocolFreezeCommit',
  'evidenceCommit',
  'providerId',
  'modelId',
  'modelSnapshotId',
  'pricing',
  'pinnedVersions',
  'timeoutPolicy',
  'budgetLimits',
  'budgetReservation',
  'executionStatus',
  'actualUsage',
  'rawTelemetry',
  'development',
  'holdout',
  'consistency',
  'gateVerdicts',
  'noFixtureFallbackProof',
  'noProductionEffectProof',
  'generatedAt',
] as const;

export class RepresentativeHybridV1LiveReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveReportValidationError';
  }
}

export function assertValidRepresentativeHybridV1LiveReport(candidate: unknown): void {
  if (typeof candidate !== 'object' || candidate === null) {
    throw new RepresentativeHybridV1LiveReportValidationError('Report must be a non-null object.');
  }
  const record = candidate as Record<string, unknown>;

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in record)) {
      throw new RepresentativeHybridV1LiveReportValidationError(
        `Report is missing required field "${key}".`,
      );
    }
  }

  const knownKeys = new Set<string>(REQUIRED_TOP_LEVEL_KEYS);
  for (const key of Object.keys(record)) {
    if (!knownKeys.has(key)) {
      throw new RepresentativeHybridV1LiveReportValidationError(
        `Report has unknown field "${key}" (closed schema).`,
      );
    }
  }

  if (record.reportVersion !== REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION) {
    throw new RepresentativeHybridV1LiveReportValidationError(
      `Report version mismatch: expected "${REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION}", got "${String(record.reportVersion)}".`,
    );
  }

  const gateVerdicts = record.gateVerdicts as Record<string, unknown> | null;
  if (!gateVerdicts || typeof gateVerdicts !== 'object') {
    throw new RepresentativeHybridV1LiveReportValidationError(
      'Report gateVerdicts must be an object.',
    );
  }
  const requiredGates = [
    'g2a_representativeQuality',
    'g2b_falseConfidence',
    'g2c_userFriction',
    'g2d_latency',
    'g2e_cost',
    'g2f_provenance',
    'g2g_consistency',
  ];
  for (const gate of requiredGates) {
    const value = gateVerdicts[gate];
    if (value !== 'passed' && value !== 'failed' && value !== 'not_evaluable') {
      throw new RepresentativeHybridV1LiveReportValidationError(
        `Report gateVerdicts.${gate} must be one of "passed"/"failed"/"not_evaluable", got ${JSON.stringify(value)}.`,
      );
    }
  }

  const actualUsage = record.actualUsage as Record<string, unknown> | null;
  if (!actualUsage || typeof actualUsage !== 'object') {
    throw new RepresentativeHybridV1LiveReportValidationError(
      'Report actualUsage must be an object.',
    );
  }
  if (actualUsage.retryCount !== 0) {
    throw new RepresentativeHybridV1LiveReportValidationError(
      'Report actualUsage.retryCount must be exactly 0 (this protocol makes zero automatic retries).',
    );
  }
}
