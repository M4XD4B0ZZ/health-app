import {
  COMPONENT_TIERS,
  DATA_WORKBOOK_FILE,
  DATA_WORKBOOK_PATH,
  MACRO_COMPONENTS,
  SOURCE_ID,
  TIER_2_COMPONENTS,
  buildColumnMap,
  findHeaderRow,
  mapBlsRowToSampleRecord,
  validateRequiredColumns,
} from './bls-sample-generator.mjs';
import { SCHEMA_VERSION, sha256Bytes, stableJsonBytes } from './bls-artifact-writer.mjs';

export const TOOL_ID = 'P1-006C3C_BLS_FULL_ARTIFACT_DRY_RUN';
export const DRY_RUN_SCHEMA_VERSION = 'bls-full-runtime-artifact-dry-run.v1';
export const FULL_ARTIFACT_TARGET_PATH = 'scripts/nutrition/bls/out/runtime/bls-runtime-catalog.v1.json';
export const DUPLICATE_EXAMPLE_LIMIT = 10;
export const MAX_BOUNDED_PROBE_ROWS = 500;

export const BUNDLE_SIZE_THRESHOLDS = Object.freeze({
  targetMaxBytes: 5 * 1024 * 1024,
  reviewRequiredBytes: 5 * 1024 * 1024 + 1,
  defaultBlockBytes: 10 * 1024 * 1024,
  hardBlockBytes: 20 * 1024 * 1024,
});

const FORBIDDEN_FLAG_PATTERNS = Object.freeze([
  /^--(?:write|out|output|stage|commit|push|deploy|fix|format|mutate|print-records)(?:$|=)/,
  /^-(?:o|w)$/,
]);

function parseMaxRowsValue(value) {
  if (!/^\d+$/.test(value ?? '')) throw new Error(`Invalid --max-rows value refused: ${value ?? '<missing>'}`);
  const maxRows = Number(value);
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > MAX_BOUNDED_PROBE_ROWS) {
    throw new Error(`Invalid --max-rows value refused: ${value}; allowed range is 1..${MAX_BOUNDED_PROBE_ROWS}`);
  }
  return maxRows;
}

export function parseArgs(argv) {
  const options = {
    mode: 'estimate-artifact',
    help: false,
  };
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--scan-only') {
      options.mode = 'scan-only';
    } else if (arg === '--estimate-artifact') {
      options.mode = 'estimate-artifact';
    } else if (arg === '--max-rows') {
      index += 1;
      options.maxRows = parseMaxRowsValue(args[index]);
    } else if (arg.startsWith('--max-rows=')) {
      options.maxRows = parseMaxRowsValue(arg.slice('--max-rows='.length));
    } else if (FORBIDDEN_FLAG_PATTERNS.some((pattern) => pattern.test(arg))) {
      throw new Error(`Forbidden argument refused: ${arg}`);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument refused: ${arg}`);
    } else {
      throw new Error(`Positional paths are refused; output is summary stdout-only: ${arg}`);
    }
  }

  return options;
}

function createExclusionCounts() {
  return {
    missingBlsCode: 0,
    missingGermanName: 0,
    missingRequiredMacros: 0,
    invalidRequiredMacros: 0,
  };
}

function createTier2Coverage() {
  return Object.fromEntries(
    TIER_2_COMPONENTS.map(({ field, componentCode }) => [
      field,
      {
        componentCode,
        valuesPresent: 0,
        missingOrInvalid: 0,
        coverageRatio: 0,
      },
    ]),
  );
}

function updateTier2Coverage(coverage, parsedTier2) {
  for (const component of TIER_2_COMPONENTS) {
    if (parsedTier2[component.field]?.ok) {
      coverage[component.field].valuesPresent += 1;
    } else {
      coverage[component.field].missingOrInvalid += 1;
    }
  }
}

function finalizeTier2Coverage(coverage) {
  return Object.fromEntries(
    Object.entries(coverage).map(([field, stats]) => {
      const total = stats.valuesPresent + stats.missingOrInvalid;
      return [
        field,
        {
          ...stats,
          coverageRatio: total === 0 ? 0 : Number((stats.valuesPresent / total).toFixed(6)),
        },
      ];
    }),
  );
}

function detectDuplicateRecords(records, keySelector) {
  const seen = new Map();
  const duplicateMap = new Map();

  for (const record of records) {
    const key = keySelector(record);
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, record);
      continue;
    }

    const entries = duplicateMap.get(key) ?? [seen.get(key)];
    entries.push(record);
    duplicateMap.set(key, entries);
  }

  const examples = Array.from(duplicateMap.entries())
    .slice(0, DUPLICATE_EXAMPLE_LIMIT)
    .map(([value, duplicateRecords]) => ({
      value,
      count: duplicateRecords.length,
      sourceRowNumbers: duplicateRecords.map((record) => record.provenance?.sourceRowNumber ?? null),
    }));

  return {
    count: duplicateMap.size,
    examples,
  };
}

function detectedTier1Columns(columnMap) {
  return Object.entries(MACRO_COMPONENTS).map(([field, componentCode]) => ({
    field,
    componentCode,
    found: columnMap[`${field}.value`].found,
    columnIndex: columnMap[`${field}.value`].columnIndex,
    columnNumber: columnMap[`${field}.value`].columnNumber,
    detectedHeader: columnMap[`${field}.value`].detectedHeader,
  }));
}

function detectedTier2Columns(columnMap) {
  return TIER_2_COMPONENTS.map(({ field, componentCode }) => ({
    field,
    componentCode,
    found: columnMap[`tier2.${field}.value`].found,
    columnIndex: columnMap[`tier2.${field}.value`].columnIndex,
    columnNumber: columnMap[`tier2.${field}.value`].columnNumber,
    detectedHeader: columnMap[`tier2.${field}.value`].detectedHeader,
  }));
}

export function toRuntimeRecord(record) {
  return {
    ...record,
    sourceId: record.blsCode,
    displayName: record.names.de,
  };
}

function withContentHash(payload, contentSha256) {
  return {
    ...payload,
    manifest: {
      ...payload.manifest,
      artifact: {
        ...payload.manifest.artifact,
        contentSha256,
      },
    },
  };
}

export function computeFullArtifactContentHash(payload) {
  return sha256Bytes(stableJsonBytes(withContentHash(payload, null)));
}

export function buildFullArtifactPayloadFromRecords(records, options = {}) {
  const payloadWithoutHash = {
    schemaVersion: SCHEMA_VERSION,
    manifest: {
      artifact: {
        kind: 'full',
        purpose: 'runtime-catalog-candidate',
        path: FULL_ARTIFACT_TARGET_PATH,
        recordCount: records.length,
        contentSha256: null,
      },
      generator: {
        toolId: TOOL_ID,
        version: 1,
        deterministic: true,
        writesFiles: false,
        modifiesRuntimeBlsSourceBehavior: false,
        packageFilesModified: false,
      },
      selection: {
        mode: 'full',
        ordering: 'source-workbook-row-order-all-valid-records',
        filtering: 'requires BLS code, German name, and Tier 1 macro values',
      },
      source: {
        sourceId: SOURCE_ID,
        dataWorkbook: {
          path: DATA_WORKBOOK_PATH,
          file: DATA_WORKBOOK_FILE,
          sha256: options.sourceWorkbookSha256 ?? null,
          sheetSelection: {
            selector: 1,
            limitation: 'The first worksheet is read explicitly to avoid loading all workbook sheets.',
          },
        },
      },
      tiers: COMPONENT_TIERS,
      mapping: options.mapping ?? null,
    },
    records: records.map(toRuntimeRecord),
  };

  const payload = withContentHash(payloadWithoutHash, computeFullArtifactContentHash(payloadWithoutHash));
  const bytes = stableJsonBytes(payload);
  return {
    payload,
    bytes,
    sha256: sha256Bytes(bytes),
  };
}

export function scanAllBlsRows(rows, options = {}) {
  const header = findHeaderRow(rows, 'BLS Code');
  if (header.index == null) throw new Error('Missing required BLS Code header row');

  const maxRows = options.maxRows ?? null;

  const columnMap = buildColumnMap(header.headers);
  const missingRequiredColumns = validateRequiredColumns(columnMap);
  if (missingRequiredColumns.length > 0) {
    throw new Error(`Missing required BLS columns: ${missingRequiredColumns.map((column) => column.key).join(', ')}`);
  }

  const records = [];
  const exclusionCounts = createExclusionCounts();
  const tier2Coverage = createTier2Coverage();
  const dataRowsAvailable = Math.max(0, rows.length - header.index - 1);
  let dataRowsScanned = 0;

  for (let rowIndex = header.index + 1; rowIndex < rows.length; rowIndex += 1) {
    if (maxRows != null && dataRowsScanned >= maxRows) break;
    dataRowsScanned += 1;
    const mapped = mapBlsRowToSampleRecord(rows[rowIndex], columnMap, {
      sourceRowIndex: rowIndex,
      sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
    });

    if (!mapped.ok) {
      exclusionCounts[mapped.reason] += 1;
      continue;
    }

    updateTier2Coverage(tier2Coverage, mapped.parsedTier2);
    records.push(mapped.record);
  }

  const tier1Columns = detectedTier1Columns(columnMap);
  const tier2Columns = detectedTier2Columns(columnMap);
  const duplicates = {
    blsCodes: detectDuplicateRecords(records, (record) => record.blsCode),
    ids: detectDuplicateRecords(records, (record) => record.id),
    normalizedNames: {
      ...detectDuplicateRecords(records, (record) => record.normalizedName),
      blocking: false,
    },
  };

  return {
    records,
    header,
    columnMap,
    scan: {
      headerRowIndex: header.index,
      headerRowNumber: header.index + 1,
      totalWorkbookRows: rows.length,
      dataRowsAvailable,
      dataRowsScanned,
      fullScanCompleted: dataRowsScanned === dataRowsAvailable,
      maxRows,
      evidenceScope: maxRows == null ? 'full-workbook-scan' : 'bounded-real-workbook-probe',
      validTier1Records: records.length,
      estimatedRecordCount: records.length,
      excludedRecords: {
        total: Object.values(exclusionCounts).reduce((sum, count) => sum + count, 0),
        byReason: exclusionCounts,
      },
    },
    mapping: {
      tier1RequiredColumns: tier1Columns,
      missingTier1Columns: tier1Columns.filter((column) => !column.found),
      tier2OptionalColumns: tier2Columns,
      missingTier2Columns: tier2Columns.filter((column) => !column.found),
      tier2Coverage: finalizeTier2Coverage(tier2Coverage),
    },
    duplicates,
  };
}

export function validateFullArtifactPayload(payload) {
  const errors = [];
  if (payload?.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion mismatch');
  if (payload?.manifest?.artifact?.kind !== 'full') errors.push('artifact kind must be full');
  if (payload?.manifest?.artifact?.path !== FULL_ARTIFACT_TARGET_PATH) errors.push('artifact path mismatch');
  if (payload?.manifest?.generator?.writesFiles !== false) errors.push('full dry-run generator must declare writesFiles false');
  if (payload?.manifest?.artifact?.contentSha256 !== computeFullArtifactContentHash(payload)) {
    errors.push('content hash verification failed');
  }
  if (!Array.isArray(payload?.records)) errors.push('records must be an array');
  for (const [index, record] of (payload?.records ?? []).entries()) {
    if (!record.id || !record.blsCode || !record.sourceId || !record.displayName) {
      errors.push(`record ${index} missing identity fields`);
    }
    if (!record.macrosPer100g || typeof record.macrosPer100g.kcal !== 'number') {
      errors.push(`record ${index} missing macrosPer100g`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function evaluateBundleRisk(byteLength) {
  if (byteLength > BUNDLE_SIZE_THRESHOLDS.hardBlockBytes) {
    return { status: 'hard_blocked', requiresHumanReviewBeforeC3D: true };
  }
  if (byteLength > BUNDLE_SIZE_THRESHOLDS.defaultBlockBytes) {
    return { status: 'blocked', requiresHumanReviewBeforeC3D: true };
  }
  if (byteLength >= BUNDLE_SIZE_THRESHOLDS.reviewRequiredBytes) {
    return { status: 'review_required', requiresHumanReviewBeforeC3D: true };
  }
  return { status: 'acceptable', requiresHumanReviewBeforeC3D: false };
}

function buildRiskChecklist({ scanResult, artifactEstimate, deterministicRegeneration, validation }) {
  const blockingFindings = [];
  const warnings = [];

  if (scanResult.scan.maxRows == null && scanResult.scan.dataRowsScanned !== scanResult.scan.dataRowsAvailable) {
    blockingFindings.push('full_scan_did_not_scan_all_available_data_rows');
  }
  if (scanResult.scan.maxRows != null) warnings.push('bounded_probe_not_full_workbook_evidence');
  if (scanResult.scan.validTier1Records === 0) blockingFindings.push('zero_valid_tier1_records');
  if (scanResult.mapping.missingTier1Columns.length > 0) blockingFindings.push('missing_tier1_columns');
  if (scanResult.duplicates.blsCodes.count > 0) blockingFindings.push('duplicate_bls_codes');
  if (scanResult.duplicates.ids.count > 0) blockingFindings.push('duplicate_generated_ids');
  if (artifactEstimate && artifactEstimate.byteLength > BUNDLE_SIZE_THRESHOLDS.defaultBlockBytes) {
    blockingFindings.push('artifact_size_exceeds_default_block_threshold');
  }
  if (artifactEstimate && artifactEstimate.byteLength > BUNDLE_SIZE_THRESHOLDS.hardBlockBytes) {
    blockingFindings.push('artifact_size_exceeds_hard_block_threshold');
  }
  if (validation && !validation.ok) blockingFindings.push('artifact_validation_failed');
  if (deterministicRegeneration && !deterministicRegeneration.byteIdentical) {
    blockingFindings.push('deterministic_regeneration_failed');
  }

  if (scanResult.mapping.missingTier2Columns.length > 0) warnings.push('missing_tier2_columns');
  if (scanResult.duplicates.normalizedNames.count > 0) warnings.push('duplicate_normalized_names');
  if (artifactEstimate && artifactEstimate.byteLength >= BUNDLE_SIZE_THRESHOLDS.reviewRequiredBytes) {
    warnings.push('artifact_size_requires_mobile_bundle_review');
  }

  return {
    blockingFindings,
    warnings,
    c3dRecommendation: blockingFindings.length > 0 ? 'blocked' : warnings.length > 0 ? 'review_before_proceeding' : 'proceed',
  };
}

function buildArtifactEstimate(artifact) {
  const byteLength = Buffer.byteLength(artifact.bytes, 'utf8');
  return {
    schemaVersion: artifact.payload.schemaVersion,
    kind: artifact.payload.manifest.artifact.kind,
    targetPathCandidate: artifact.payload.manifest.artifact.path,
    recordCount: artifact.payload.records.length,
    generatedInMemory: true,
    writtenToDisk: false,
    byteLength,
    byteLengthMiB: Number((byteLength / 1024 / 1024).toFixed(6)),
    sha256: artifact.sha256,
    contentSha256: artifact.payload.manifest.artifact.contentSha256,
    stableJsonTrailingNewline: artifact.bytes.endsWith('\n') && !artifact.bytes.endsWith('\n\n'),
  };
}

export function buildFullArtifactDryRunSummary(rows, options = {}) {
  const startedAt = process.hrtime.bigint();
  const mode = options.mode ?? 'estimate-artifact';
  const scanResult = scanAllBlsRows(rows, {
    sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
    maxRows: options.maxRows,
  });

  let artifactEstimate = null;
  let deterministicRegeneration = {
    checked: false,
    runs: 0,
    byteIdentical: null,
    firstSha256: null,
    secondSha256: null,
    firstByteLength: null,
    secondByteLength: null,
  };
  let validation = null;

  if (mode === 'estimate-artifact') {
    const first = buildFullArtifactPayloadFromRecords(scanResult.records, {
      sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
      mapping: scanResult.mapping,
    });
    const second = buildFullArtifactPayloadFromRecords(scanResult.records, {
      sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
      mapping: scanResult.mapping,
    });
    validation = validateFullArtifactPayload(first.payload);
    artifactEstimate = buildArtifactEstimate(first);
    deterministicRegeneration = {
      checked: true,
      runs: 2,
      byteIdentical: first.bytes === second.bytes,
      firstSha256: first.sha256,
      secondSha256: second.sha256,
      firstByteLength: Buffer.byteLength(first.bytes, 'utf8'),
      secondByteLength: Buffer.byteLength(second.bytes, 'utf8'),
    };
  }

  const bundleRiskBase = artifactEstimate
    ? evaluateBundleRisk(artifactEstimate.byteLength)
    : { status: 'not_evaluated_scan_only', requiresHumanReviewBeforeC3D: true };
  const riskChecklist = buildRiskChecklist({ scanResult, artifactEstimate, deterministicRegeneration, validation });
  const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);

  return {
    schemaVersion: DRY_RUN_SCHEMA_VERSION,
    tool: TOOL_ID,
    ok: true,
    mode: mode === 'scan-only' ? 'full-artifact-scan-only-summary-only' : 'full-artifact-dry-run-summary-only',
    writesFiles: false,
    generatesRuntimeArtifactFile: false,
    generatedArtifactBytesInMemory: mode === 'estimate-artifact',
    modifiesRuntimeBlsSourceBehavior: false,
    packageFilesModified: false,
    deterministic: true,
    sourceFiles: {
      dataWorkbook: {
        role: 'data',
        path: DATA_WORKBOOK_PATH,
        file: DATA_WORKBOOK_FILE,
        sha256: options.sourceWorkbookSha256 ?? null,
        sheetSelection: {
          selector: 1,
          limitation: 'The first worksheet is read explicitly to avoid loading all workbook sheets.',
        },
        workbookRows: rows.length,
        columnCount: rows.reduce((max, row) => Math.max(max, row.length), 0),
      },
    },
    scan: scanResult.scan,
    mapping: scanResult.mapping,
    duplicates: scanResult.duplicates,
    artifactEstimate,
    deterministicRegeneration,
    validation,
    bundleRisk: {
      thresholds: BUNDLE_SIZE_THRESHOLDS,
      ...bundleRiskBase,
    },
    runtimeStats: {
      durationMs,
      memoryUsageBytes: process.memoryUsage(),
      heapRelaunch: {
        requiredHeapMb: options.requiredHeapMb ?? null,
        used: options.heapRelaunched === true,
      },
    },
    riskChecklist,
  };
}

export function errorPayload(error, extras = {}) {
  return {
    schemaVersion: DRY_RUN_SCHEMA_VERSION,
    tool: TOOL_ID,
    ok: false,
    mode: 'full-artifact-dry-run-summary-only',
    error: error instanceof Error ? error.message : String(error),
    writesFiles: false,
    generatesRuntimeArtifactFile: false,
    modifiesRuntimeBlsSourceBehavior: false,
    packageFilesModified: false,
    ...extras,
  };
}