import { gzipSync, brotliCompressSync } from 'node:zlib';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

import {
  buildBlsSampleRecords,
  normalizeBlsName,
  tokenizeBlsNames,
} from './bls-sample-generator.mjs';

export const TOOL_ID = 'P1-006C3D1_BLS_RUNTIME_PROFILE_BENCHMARK';

export const PROFILE_NAMES = Object.freeze([
  'full-current-baseline',
  'object-runtime',
  'object-runtime-tier1',
  'tuple-runtime',
  'tuple-runtime-tier1',
  'split-runtime',
  'ultra-lite',
]);

const TIER2_FIELDS = Object.freeze([
  'energyKj',
  'waterG',
  'fiberG',
  'sugarG',
  'starchG',
  'alcoholG',
  'saltG',
  'sodiumMg',
  'saturatedFatG',
  'monounsaturatedFatG',
  'polyunsaturatedFatG',
  'omega3G',
  'omega6G',
  'cholesterolMg',
]);

const FORBIDDEN_ARG_PATTERNS = Object.freeze([
  /^--(?:write|force|out|output|stage|commit|push|deploy|fix|format)(?:$|=)/,
  /^-(?:o)$/,
]);

function round(value, digits) {
  return Number(value.toFixed(digits));
}

function bytesToMiB(bytes) {
  return round(bytes / 1024 / 1024, 6);
}

export function stableJsonBytes(payload) {
  return `${JSON.stringify(payload)}\n`;
}

export function parseBenchmarkArgs(argv) {
  const options = { mode: null, limit: null, profile: null, help: false };
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--full-readonly') {
      if (options.mode)
        throw new Error('Choose exactly one benchmark mode: --limit or --full-readonly');
      options.mode = 'full-readonly';
    } else if (arg === '--limit') {
      if (options.mode)
        throw new Error('Choose exactly one benchmark mode: --limit or --full-readonly');
      const value = args[index + 1];
      if (!value || value.startsWith('-'))
        throw new Error('--limit requires a positive integer value');
      options.limit = parsePositiveInteger(value, '--limit');
      options.mode = 'bounded-probe';
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      if (options.mode)
        throw new Error('Choose exactly one benchmark mode: --limit or --full-readonly');
      options.limit = parsePositiveInteger(arg.slice('--limit='.length), '--limit');
      options.mode = 'bounded-probe';
    } else if (arg === '--profile') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) throw new Error('--profile requires a profile name');
      options.profile = parseProfileName(value);
      index += 1;
    } else if (arg.startsWith('--profile=')) {
      options.profile = parseProfileName(arg.slice('--profile='.length));
    } else if (FORBIDDEN_ARG_PATTERNS.some((pattern) => pattern.test(arg))) {
      throw new Error(`Forbidden argument refused: ${arg}`);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument refused: ${arg}`);
    } else {
      throw new Error(`Positional output paths are refused: ${arg}`);
    }
  }

  if (!options.help && !options.mode)
    throw new Error('A read-only mode is required: --limit <n> or --full-readonly');
  return options;
}

function parsePositiveInteger(value, label) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function parseProfileName(value) {
  if (!PROFILE_NAMES.includes(value)) throw new Error(`Unknown profile: ${value}`);
  return value;
}

function toRuntimeRecord(record) {
  return {
    ...record,
    sourceId: record.blsCode,
    displayName: record.names.de,
  };
}

function sourceRecords(rows, options) {
  const sample = buildBlsSampleRecords(rows, {
    limit: options.fullReadonly ? Number.MAX_SAFE_INTEGER : options.limit,
    sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
  });
  return {
    mapping: sample.mapping,
    records: sample.records.map(toRuntimeRecord),
  };
}

function tier2Values(record) {
  return TIER2_FIELDS.map((field) => record.nutrientsPer100g?.[field] ?? null);
}

function objectRuntimeRecord(record, includeTier2) {
  const result = {
    id: record.id,
    sourceId: record.sourceId,
    displayName: record.displayName,
    macrosPer100g: record.macrosPer100g,
  };
  if (includeTier2 && record.nutrientsPer100g) result.nutrientsPer100g = record.nutrientsPer100g;
  return result;
}

function profileDefinitions(records) {
  return {
    'full-current-baseline': {
      definition: definition({
        includedFields: [
          'id',
          'blsCode',
          'sourceId',
          'displayName',
          'names',
          'normalizedName',
          'aliases',
          'tokens',
          'macrosPer100g',
          'nutrientsPer100g',
          'provenance',
        ],
        excludedFields: ['artifactFileWrite', 'artifactOutputPath'],
        tier2Included: true,
        tokensIncluded: true,
        aliasesIncluded: true,
        namesObjectIncluded: true,
        namesEnIncluded: true,
      }),
      architecture: architecture('low', 'low', 'high', 'high', [
        'Current verbose baseline; expected to be rejected for bundle size.',
      ]),
      payload: {
        schemaVersion: 'bls-runtime-profile.full-current-baseline.v1',
        profile: 'full-current-baseline',
        records,
      },
    },
    'object-runtime': {
      definition: definition({
        includedFields: ['id', 'sourceId', 'displayName', 'macrosPer100g', 'nutrientsPer100g'],
        excludedFields: ['blsCode', 'names', 'tokens', 'aliases', 'normalizedName', 'provenance'],
        tier2Included: true,
      }),
      architecture: architecture('low-medium', 'low', 'high', 'high', [
        'Tokens are generated at runtime from displayName.',
      ]),
      payload: {
        schemaVersion: 'bls-runtime-profile.object-runtime.v1',
        profile: 'object-runtime',
        records: records.map((record) => objectRuntimeRecord(record, true)),
      },
    },
    'object-runtime-tier1': {
      definition: definition({
        includedFields: ['id', 'sourceId', 'displayName', 'macrosPer100g'],
        excludedFields: [
          'nutrientsPer100g',
          'blsCode',
          'names',
          'tokens',
          'aliases',
          'normalizedName',
          'provenance',
        ],
        tier2Included: false,
      }),
      architecture: architecture('low', 'low', 'high', 'medium-high', [
        'Tier1-only object candidate.',
      ]),
      payload: {
        schemaVersion: 'bls-runtime-profile.object-runtime-tier1.v1',
        profile: 'object-runtime-tier1',
        records: records.map((record) => objectRuntimeRecord(record, false)),
      },
    },
    'tuple-runtime': {
      definition: definition({
        includedFields: [
          'columns',
          'id',
          'sourceId',
          'displayName',
          'tier1Macros',
          'tier2Nutrients',
        ],
        excludedFields: [
          'objectKeysPerRecord',
          'names',
          'tokens',
          'aliases',
          'normalizedName',
          'provenance',
        ],
        tier2Included: true,
      }),
      architecture: architecture('medium', 'medium-high', 'medium-low', 'medium', [
        'Requires stable column contract.',
      ]),
      payload: tuplePayload('tuple-runtime', true, records),
    },
    'tuple-runtime-tier1': {
      definition: definition({
        includedFields: ['columns', 'id', 'sourceId', 'displayName', 'tier1Macros'],
        excludedFields: [
          'tier2Nutrients',
          'objectKeysPerRecord',
          'names',
          'tokens',
          'aliases',
          'normalizedName',
          'provenance',
        ],
        tier2Included: false,
      }),
      architecture: architecture('medium', 'medium-high', 'medium-low', 'medium', [
        'Compact Tier1 tuple candidate.',
      ]),
      payload: tuplePayload('tuple-runtime-tier1', false, records),
    },
    'split-runtime': {
      definition: definition({
        includedFields: [
          'foodsColumns',
          'foods',
          'searchIndexColumns',
          'searchIndex',
          'id',
          'sourceId',
          'tier1Macros',
          'tier2Nutrients',
          'displayName',
          'aliases',
          'normalizedName',
        ],
        excludedFields: ['tokens', 'names', 'provenance', 'perRecordObjectWrappers'],
        tier2Included: true,
        aliasesIncluded: true,
      }),
      architecture: architecture('high', 'high', 'medium-low', 'high', [
        'Separates nutrition and search concerns; tokens generated at runtime.',
      ]),
      payload: splitPayload(records),
    },
    'ultra-lite': {
      definition: definition({
        includedFields: ['id', 'sourceId', 'displayName', 'macrosPer100g'],
        excludedFields: [
          'nutrientsPer100g',
          'names',
          'tokens',
          'aliases',
          'normalizedName',
          'provenance',
          'optionalMetadata',
        ],
        tier2Included: false,
      }),
      architecture: architecture('low', 'low', 'high', 'medium', [
        'Strict minimal object baseline.',
      ]),
      payload: {
        schemaVersion: 'bls-runtime-profile.ultra-lite.v1',
        profile: 'ultra-lite',
        records: records.map((record) => objectRuntimeRecord(record, false)),
      },
    },
  };
}

function definition(overrides) {
  return {
    includedFields: overrides.includedFields,
    excludedFields: overrides.excludedFields,
    tier2Included: overrides.tier2Included,
    tokensIncluded: overrides.tokensIncluded ?? false,
    aliasesIncluded: overrides.aliasesIncluded ?? false,
    namesObjectIncluded: overrides.namesObjectIncluded ?? false,
    namesEnIncluded: overrides.namesEnIncluded ?? false,
  };
}

function architecture(
  implementationComplexity,
  runtimeComplexity,
  readability,
  extensibility,
  notes,
) {
  return { implementationComplexity, runtimeComplexity, readability, extensibility, notes };
}

function tuplePayload(profile, includeTier2, records) {
  const columns = includeTier2
    ? ['id', 'sourceId', 'displayName', 'kcal', 'protein', 'fat', 'carbs', ...TIER2_FIELDS]
    : ['id', 'sourceId', 'displayName', 'kcal', 'protein', 'fat', 'carbs'];
  return {
    schemaVersion: `bls-runtime-profile.${profile}.v1`,
    profile,
    columns,
    records: records.map((record) => [
      record.id,
      record.sourceId,
      record.displayName,
      record.macrosPer100g.kcal,
      record.macrosPer100g.protein,
      record.macrosPer100g.fat,
      record.macrosPer100g.carbs,
      ...(includeTier2 ? tier2Values(record) : []),
    ]),
  };
}

function splitPayload(records) {
  const foodsColumns = ['id', 'sourceId', 'kcal', 'protein', 'fat', 'carbs', ...TIER2_FIELDS];
  return {
    schemaVersion: 'bls-runtime-profile.split-runtime.v1',
    profile: 'split-runtime',
    foodsColumns,
    foods: records.map((record) => [
      record.id,
      record.sourceId,
      record.macrosPer100g.kcal,
      record.macrosPer100g.protein,
      record.macrosPer100g.fat,
      record.macrosPer100g.carbs,
      ...tier2Values(record),
    ]),
    searchIndexColumns: ['foodIndex', 'displayName', 'aliases', 'normalizedName'],
    searchIndex: records.map((record, index) => [
      index,
      record.displayName,
      record.aliases ?? [],
      record.normalizedName ?? normalizeBlsName(record.displayName),
    ]),
  };
}

export function buildLookupIndex(parsedPayload) {
  const byId = new Map();
  const bySourceId = new Map();
  const searchTerms = new Map();

  if (Array.isArray(parsedPayload.records)) {
    for (const raw of parsedPayload.records) {
      const record = Array.isArray(raw) ? tupleToRecord(parsedPayload.columns, raw) : raw;
      indexRecord(record, byId, bySourceId, searchTerms);
    }
  } else if (Array.isArray(parsedPayload.foods) && Array.isArray(parsedPayload.searchIndex)) {
    const foodRecords = parsedPayload.foods.map((raw) =>
      tupleToRecord(parsedPayload.foodsColumns, raw),
    );
    for (const searchRow of parsedPayload.searchIndex) {
      const [foodIndex, displayName, aliases, normalizedName] = searchRow;
      const record = { ...foodRecords[foodIndex], displayName, aliases, normalizedName };
      indexRecord(record, byId, bySourceId, searchTerms);
    }
  }

  return {
    byIdSize: byId.size,
    bySourceIdSize: bySourceId.size,
    searchTermCount: searchTerms.size,
  };
}

function tupleToRecord(columns, row) {
  const object = Object.fromEntries(columns.map((column, index) => [column, row[index]]));
  return {
    id: object.id,
    sourceId: object.sourceId,
    displayName: object.displayName,
    macrosPer100g: {
      kcal: object.kcal,
      protein: object.protein,
      fat: object.fat,
      carbs: object.carbs,
    },
  };
}

function indexRecord(record, byId, bySourceId, searchTerms) {
  if (record.id) byId.set(record.id, record);
  if (record.sourceId) bySourceId.set(record.sourceId, record);
  for (const token of tokenizeBlsNames(
    record.displayName,
    ...(record.aliases ?? []),
    record.normalizedName ?? '',
  )) {
    if (!searchTerms.has(token)) searchTerms.set(token, 0);
    searchTerms.set(token, searchTerms.get(token) + 1);
  }
}

function classifyRawSize(jsonMiB) {
  if (jsonMiB <= 5) return 'target';
  if (jsonMiB <= 10) return 'review';
  return 'blocked';
}

function profileRecommendation(profile, storage, architectureSummary) {
  const rawSizeClass = classifyRawSize(storage.jsonMiB);
  const rejected =
    rawSizeClass === 'blocked' ||
    (architectureSummary.runtimeComplexity === 'high' && rawSizeClass !== 'target');
  const reasons = [];
  reasons.push(
    rawSizeClass === 'target'
      ? 'under_raw_json_target'
      : rawSizeClass === 'review'
        ? 'raw_json_requires_review'
        : 'raw_json_blocked',
  );
  if (architectureSummary.runtimeComplexity === 'high') reasons.push('high_runtime_complexity');
  if (profile.includes('tier1') || profile === 'ultra-lite') reasons.push('tier1_only');
  return {
    status: rejected ? 'reject' : 'candidate',
    keepCandidate: !rejected,
    reject: rejected,
    rawSizeClass,
    performanceClass: 'measured',
    memoryClass: 'measured',
    rationale: reasons,
  };
}

function benchmarkProfile(profile, config, baselineJsonBytes, selectedRecordCount) {
  const beforeSerialize = performance.now();
  const serializedJson = stableJsonBytes(config.payload);
  const jsonSerializationMs = round(performance.now() - beforeSerialize, 3);
  const jsonBytes = Buffer.byteLength(serializedJson, 'utf8');
  const gzipBytes = gzipSync(serializedJson).byteLength;
  const brotliBytes = brotliCompressSync(serializedJson).byteLength;

  const heapBeforeParseBytes = process.memoryUsage().heapUsed;
  const beforeParse = performance.now();
  const parsed = JSON.parse(serializedJson);
  const jsonParseMs = round(performance.now() - beforeParse, 3);
  const heapAfterParseBytes = process.memoryUsage().heapUsed;

  const beforeIndex = performance.now();
  const lookupIndex = buildLookupIndex(parsed);
  const lookupIndexBuildMs = round(performance.now() - beforeIndex, 3);
  const heapAfterLookupIndexBytes = process.memoryUsage().heapUsed;

  const storage = {
    jsonBytes,
    jsonMiB: bytesToMiB(jsonBytes),
    gzipBytes,
    gzipMiB: bytesToMiB(gzipBytes),
    brotliBytes,
    brotliMiB: bytesToMiB(brotliBytes),
    bytesPerRecord: selectedRecordCount === 0 ? 0 : round(jsonBytes / selectedRecordCount, 3),
    reductionVsBaseline:
      baselineJsonBytes === 0 ? 0 : round((baselineJsonBytes - jsonBytes) / baselineJsonBytes, 6),
  };

  return {
    profile,
    candidate: true,
    definition: config.definition,
    storage,
    runtime: {
      jsonSerializationMs,
      jsonParseMs,
      lookupIndexBuildMs,
      totalPreparationMs: round(jsonParseMs + lookupIndexBuildMs, 3),
    },
    memory: memoryMetrics(heapBeforeParseBytes, heapAfterParseBytes, heapAfterLookupIndexBytes),
    architecture: config.architecture,
    lookupIndex,
    recommendation: profileRecommendation(profile, storage, config.architecture),
  };
}

function memoryMetrics(heapBeforeParseBytes, heapAfterParseBytes, heapAfterLookupIndexBytes) {
  return {
    heapBeforeParseBytes,
    heapBeforeParseMiB: bytesToMiB(heapBeforeParseBytes),
    heapAfterParseBytes,
    heapAfterParseMiB: bytesToMiB(heapAfterParseBytes),
    heapAfterLookupIndexBytes,
    heapAfterLookupIndexMiB: bytesToMiB(heapAfterLookupIndexBytes),
    heapGrowthParseBytes: heapAfterParseBytes - heapBeforeParseBytes,
    heapGrowthParseMiB: bytesToMiB(heapAfterParseBytes - heapBeforeParseBytes),
    heapGrowthWithIndexBytes: heapAfterLookupIndexBytes - heapBeforeParseBytes,
    heapGrowthWithIndexMiB: bytesToMiB(heapAfterLookupIndexBytes - heapBeforeParseBytes),
  };
}

export function runBlsRuntimeProfileBenchmark(rows, options = {}) {
  const fullReadonly = options.mode === 'full-readonly' || options.fullReadonly === true;
  const selected = sourceRecords(rows, {
    fullReadonly,
    limit: options.limit ?? 100,
    sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
  });
  const selectedRecordCount = selected.records.length;
  const definitions = profileDefinitions(selected.records);
  const selectedProfiles = options.profile ? [options.profile] : PROFILE_NAMES;
  const baselineJsonBytes = Buffer.byteLength(
    stableJsonBytes(definitions['full-current-baseline'].payload),
    'utf8',
  );
  const profiles = selectedProfiles.map((profile) =>
    benchmarkProfile(profile, definitions[profile], baselineJsonBytes, selectedRecordCount),
  );

  const preferredProfiles = profiles
    .filter((profile) => profile.recommendation.keepCandidate)
    .sort((a, b) => a.storage.jsonBytes - b.storage.jsonBytes)
    .map((profile) => profile.profile);
  const rejectedProfiles = profiles
    .filter((profile) => profile.recommendation.reject)
    .map((profile) => profile.profile);

  return {
    tool: TOOL_ID,
    ok: true,
    mode: fullReadonly ? 'full-readonly' : 'bounded-probe',
    writesFiles: false,
    generatesArtifacts: false,
    modifiesRuntimeBlsSourceBehavior: false,
    packageFilesModified: false,
    source: {
      dataWorkbookPath: options.dataWorkbookPath ?? null,
      sheet: 1,
      workbookRows: rows.length,
      validRecordCount: selected.mapping.validRecordsSelected,
      selectedRecordCount,
      limit: fullReadonly ? null : (options.limit ?? 100),
      fullBenchmark: fullReadonly,
    },
    benchmarkEnvironment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      highResolutionTimer: 'performance.now',
      memorySource: 'process.memoryUsage.heapUsed',
      gcAvailable: typeof global.gc === 'function',
      notes: [
        'Memory measurements are process-local estimates and should be compared relatively, not as absolute mobile heap usage.',
      ],
    },
    baseline: {
      profile: 'full-current-baseline',
      recordCount: selectedRecordCount,
      storage: profiles.find((profile) => profile.profile === 'full-current-baseline')?.storage ?? {
        jsonBytes: baselineJsonBytes,
        jsonMiB: bytesToMiB(baselineJsonBytes),
      },
    },
    profiles,
    summary: {
      preferredProfiles,
      rejectedProfiles,
      needsAlternativeArchitecture: preferredProfiles.length === 0,
      alternativeArchitectureOptions:
        preferredProfiles.length === 0
          ? [
              'lazy-loaded compressed JSON asset',
              'binary/indexed format',
              'prebuilt SQLite catalog',
              'split search index plus lazy nutrition table',
            ]
          : [],
      finalArtifactChosen: false,
      finalArtifactWritten: false,
    },
  };
}
