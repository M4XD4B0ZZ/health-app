export const TOOL_ID = 'P1-006C2_BLS_SAMPLE_RECORD_GENERATOR';
export const SOURCE_ID = 'BLS_4_0_2025_DE';
export const DATA_WORKBOOK_PATH = 'BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx';
export const DATA_WORKBOOK_FILE = 'BLS_4_0_Daten_2025_DE.xlsx';
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const MACRO_COMPONENTS = Object.freeze({
  kcal: 'ENERCC',
  protein: 'PROT625',
  fat: 'FAT',
  carbs: 'CHO',
});

export const TIER_1_COMPONENTS = Object.freeze([
  { field: 'kcal', componentCode: 'ENERCC', required: true },
  { field: 'protein', componentCode: 'PROT625', required: true },
  { field: 'fat', componentCode: 'FAT', required: true },
  { field: 'carbs', componentCode: 'CHO', required: true },
]);

export const TIER_2_COMPONENTS = Object.freeze([
  { field: 'energyKj', componentCode: 'ENERCJ' },
  { field: 'waterG', componentCode: 'WATER' },
  { field: 'fiberG', componentCode: 'FIBT' },
  { field: 'sugarG', componentCode: 'SUGAR' },
  { field: 'starchG', componentCode: 'STARCH' },
  { field: 'alcoholG', componentCode: 'ALC' },
  { field: 'saltG', componentCode: 'NACL' },
  { field: 'sodiumMg', componentCode: 'NA' },
  { field: 'saturatedFatG', componentCode: 'FASAT' },
  { field: 'monounsaturatedFatG', componentCode: 'FAMS' },
  { field: 'polyunsaturatedFatG', componentCode: 'FAPU' },
  { field: 'omega3G', componentCode: 'FAPUN3' },
  { field: 'omega6G', componentCode: 'FAPUN6' },
  { field: 'cholesterolMg', componentCode: 'CHORL' },
]);

export const COMPONENT_TIERS = Object.freeze({
  tier1Required: TIER_1_COMPONENTS,
  tier2Optional: TIER_2_COMPONENTS,
});

export const REQUIRED_DATA_COLUMNS = Object.freeze([
  { key: 'blsCode', label: 'BLS Code', match: (header) => header === 'BLS Code' },
  {
    key: 'germanName',
    label: 'Lebensmittelbezeichnung',
    match: (header) => header === 'Lebensmittelbezeichnung',
  },
  { key: 'englishName', label: 'Food name', match: (header) => header === 'Food name' },
  ...Object.entries(MACRO_COMPONENTS).flatMap(([macro, code]) => [
    {
      key: `${macro}.value`,
      label: `${code} value`,
      match: (header) => header.startsWith(`${code} `),
    },
    {
      key: `${macro}.provenance`,
      label: `${code} Datenherkunft`,
      match: (header) => header === `${code} Datenherkunft`,
    },
    {
      key: `${macro}.reference`,
      label: `${code} Referenz`,
      match: (header) => header === `${code} Referenz`,
    },
  ]),
  ...TIER_2_COMPONENTS.map(({ field, componentCode }) => ({
    key: `tier2.${field}.value`,
    label: `${componentCode} value`,
    required: false,
    match: (header) => header.startsWith(`${componentCode} `),
  })),
]);

export function asHeaderString(value) {
  return value == null ? '' : String(value).trim();
}

export function findHeaderRow(rows, requiredHeader = 'BLS Code') {
  const index = rows.findIndex((row) =>
    row.some((cell) => asHeaderString(cell) === requiredHeader),
  );
  if (index === -1) return { index: null, headers: [] };
  return { index, headers: rows[index].map(asHeaderString) };
}

export function countColumns(rows) {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

export function buildColumnMap(headers) {
  const entries = REQUIRED_DATA_COLUMNS.map((expected) => {
    const columnIndex = headers.findIndex((header) => expected.match(asHeaderString(header)));
    return [
      expected.key,
      {
        key: expected.key,
        expected: expected.label,
        required: expected.required !== false,
        found: columnIndex !== -1,
        columnIndex: columnIndex === -1 ? null : columnIndex,
        columnNumber: columnIndex === -1 ? null : columnIndex + 1,
        detectedHeader: columnIndex === -1 ? null : asHeaderString(headers[columnIndex]),
      },
    ];
  });

  return Object.fromEntries(entries);
}

export function validateRequiredColumns(columnMap) {
  return Object.values(columnMap).filter((column) => column.required !== false && !column.found);
}

export function normalizeBlsName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uniqueNonEmpty(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function tokenizeBlsNames(...values) {
  return uniqueNonEmpty(values.flatMap((value) => normalizeBlsName(value).split(' ')));
}

export function parseBlsNumber(value) {
  if (value == null) return { ok: false, reason: 'missing', raw: value };
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { ok: true, value, raw: value }
      : { ok: false, reason: 'non_finite', raw: value };
  }

  const text = String(value).trim();
  if (text === '') return { ok: false, reason: 'missing', raw: value };
  if (text === '-') return { ok: false, reason: 'dash', raw: value };

  const normalized = text.includes(',') && !text.includes('.') ? text.replace(',', '.') : text;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    return { ok: false, reason: 'invalid', raw: value };
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed)
    ? { ok: true, value: parsed, raw: value }
    : { ok: false, reason: 'non_finite', raw: value };
}

export function roundMacro(value) {
  return Number(value.toFixed(3));
}

function cell(row, columnMap, key) {
  const column = columnMap[key];
  return column?.found ? row[column.columnIndex] : null;
}

function macroProvenance(row, columnMap, macro, parsed, options) {
  const componentCode = MACRO_COMPONENTS[macro];
  const valueColumn = columnMap[`${macro}.value`];
  const provenanceColumn = columnMap[`${macro}.provenance`];
  const referenceColumn = columnMap[`${macro}.reference`];

  return {
    componentCode,
    valueColumnHeader: valueColumn.detectedHeader,
    valueColumnNumber: valueColumn.columnNumber,
    valueColumnIndex: valueColumn.columnIndex,
    rawValue: parsed.raw ?? null,
    provenance: asHeaderString(row[provenanceColumn.columnIndex]) || null,
    reference: asHeaderString(row[referenceColumn.columnIndex]) || null,
    sourceWorkbookSha256: options.sourceWorkbookSha256,
  };
}

function parseOptionalTier2Nutrients(row, columnMap) {
  const nutrientsPer100g = {};
  const parsedTier2 = {};

  for (const component of TIER_2_COMPONENTS) {
    const key = `tier2.${component.field}.value`;
    const column = columnMap[key];
    const parsed = column?.found
      ? parseBlsNumber(row[column.columnIndex])
      : { ok: false, reason: 'column_missing', raw: null };
    parsedTier2[component.field] = parsed;

    if (parsed.ok) {
      nutrientsPer100g[component.field] = roundMacro(parsed.value);
    }
  }

  return {
    parsedTier2,
    nutrientsPer100g: Object.keys(nutrientsPer100g).length > 0 ? nutrientsPer100g : undefined,
  };
}

function tier2Provenance(row, columnMap, parsedTier2, options) {
  return Object.fromEntries(
    TIER_2_COMPONENTS.filter(({ field }) => parsedTier2[field]?.ok).map(
      ({ field, componentCode }) => {
        const valueColumn = columnMap[`tier2.${field}.value`];
        return [
          field,
          {
            componentCode,
            valueColumnHeader: valueColumn.detectedHeader,
            valueColumnNumber: valueColumn.columnNumber,
            valueColumnIndex: valueColumn.columnIndex,
            rawValue: parsedTier2[field].raw ?? null,
            sourceWorkbookSha256: options.sourceWorkbookSha256,
          },
        ];
      },
    ),
  );
}

function createTier2Coverage() {
  return Object.fromEntries(
    TIER_2_COMPONENTS.map(({ field, componentCode }) => [
      field,
      {
        componentCode,
        valuesPresent: 0,
        missingOrInvalid: 0,
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

export function mapBlsRowToSampleRecord(row, columnMap, options = {}) {
  const sourceRowIndex = options.sourceRowIndex;
  const sourceRowNumber = sourceRowIndex == null ? null : sourceRowIndex + 1;
  const blsCode = asHeaderString(cell(row, columnMap, 'blsCode'));
  if (!blsCode) return { ok: false, reason: 'missingBlsCode', sourceRowIndex, sourceRowNumber };

  const germanName = asHeaderString(cell(row, columnMap, 'germanName'));
  if (!germanName)
    return { ok: false, reason: 'missingGermanName', sourceRowIndex, sourceRowNumber };

  const englishNameRaw = asHeaderString(cell(row, columnMap, 'englishName'));
  const englishName = englishNameRaw || null;
  const parsedMacros = Object.fromEntries(
    Object.keys(MACRO_COMPONENTS).map((macro) => [
      macro,
      parseBlsNumber(cell(row, columnMap, `${macro}.value`)),
    ]),
  );

  const missingMacro = Object.values(parsedMacros).find(
    (parsed) => parsed.ok === false && (parsed.reason === 'missing' || parsed.reason === 'dash'),
  );
  if (missingMacro)
    return { ok: false, reason: 'missingRequiredMacros', sourceRowIndex, sourceRowNumber };

  const invalidMacro = Object.values(parsedMacros).find((parsed) => parsed.ok === false);
  if (invalidMacro)
    return { ok: false, reason: 'invalidRequiredMacros', sourceRowIndex, sourceRowNumber };

  const normalizedName = normalizeBlsName(germanName);
  const normalizedEnglishName = normalizeBlsName(englishName);
  const aliases = uniqueNonEmpty([normalizedName, normalizedEnglishName]);
  const tokens = tokenizeBlsNames(germanName, englishName);
  const { parsedTier2, nutrientsPer100g } = parseOptionalTier2Nutrients(row, columnMap);

  const record = {
    id: `bls-${blsCode.toLowerCase()}`,
    blsCode,
    names: { de: germanName, en: englishName },
    normalizedName,
    aliases,
    tokens,
    macrosPer100g: {
      kcal: roundMacro(parsedMacros.kcal.value),
      protein: roundMacro(parsedMacros.protein.value),
      carbs: roundMacro(parsedMacros.carbs.value),
      fat: roundMacro(parsedMacros.fat.value),
    },
    provenance: {
      source: SOURCE_ID,
      sourceWorkbook: DATA_WORKBOOK_FILE,
      sourceWorkbookPath: DATA_WORKBOOK_PATH,
      sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
      sourceRowIndex,
      sourceRowNumber,
      componentColumns: {
        kcal: macroProvenance(row, columnMap, 'kcal', parsedMacros.kcal, options),
        protein: macroProvenance(row, columnMap, 'protein', parsedMacros.protein, options),
        carbs: macroProvenance(row, columnMap, 'carbs', parsedMacros.carbs, options),
        fat: macroProvenance(row, columnMap, 'fat', parsedMacros.fat, options),
      },
    },
  };

  if (nutrientsPer100g) {
    record.nutrientsPer100g = nutrientsPer100g;
    record.provenance.tier2ComponentColumns = tier2Provenance(row, columnMap, parsedTier2, options);
  }

  return {
    ok: true,
    parsedTier2,
    record,
  };
}

export function buildBlsSampleRecords(rows, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const header = findHeaderRow(rows, 'BLS Code');
  if (header.index == null) throw new Error('Missing required BLS Code header row');

  const columnMap = buildColumnMap(header.headers);
  const missingColumns = validateRequiredColumns(columnMap);
  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required BLS columns: ${missingColumns.map((column) => column.key).join(', ')}`,
    );
  }

  const records = [];
  const exclusionCounts = {
    missingBlsCode: 0,
    missingGermanName: 0,
    missingRequiredMacros: 0,
    invalidRequiredMacros: 0,
  };
  const tier2Coverage = createTier2Coverage();
  let dataRowsVisited = 0;
  let excludedBeforeLimit = 0;

  for (let rowIndex = header.index + 1; rowIndex < rows.length; rowIndex += 1) {
    if (records.length >= limit) break;
    dataRowsVisited += 1;
    const mapped = mapBlsRowToSampleRecord(rows[rowIndex], columnMap, {
      sourceRowIndex: rowIndex,
      sourceWorkbookSha256: options.sourceWorkbookSha256 ?? null,
    });
    if (!mapped.ok) {
      exclusionCounts[mapped.reason] += 1;
      excludedBeforeLimit += 1;
      continue;
    }
    updateTier2Coverage(tier2Coverage, mapped.parsedTier2);
    records.push(mapped.record);
  }

  const detectedTier1Columns = Object.entries(MACRO_COMPONENTS).map(([macro, componentCode]) => ({
    macro,
    componentCode,
    found: columnMap[`${macro}.value`].found,
    columnIndex: columnMap[`${macro}.value`].columnIndex,
    columnNumber: columnMap[`${macro}.value`].columnNumber,
    detectedHeader: columnMap[`${macro}.value`].detectedHeader,
  }));
  const detectedTier2Columns = TIER_2_COMPONENTS.map(({ field, componentCode }) => ({
    field,
    componentCode,
    found: columnMap[`tier2.${field}.value`].found,
    columnIndex: columnMap[`tier2.${field}.value`].columnIndex,
    columnNumber: columnMap[`tier2.${field}.value`].columnNumber,
    detectedHeader: columnMap[`tier2.${field}.value`].detectedHeader,
  }));

  return {
    header,
    columnMap,
    records,
    mapping: {
      headerRowIndex: header.index,
      headerRowNumber: header.index + 1,
      dataRowsVisited,
      validRecordsSelected: records.length,
      excludedBeforeLimit,
      exclusionCounts,
      componentTiers: COMPONENT_TIERS,
      detectedTier1Columns,
      detectedTier2Columns,
      missingTier2Columns: detectedTier2Columns.filter((column) => !column.found),
      tier2Coverage,
      requiredMacroColumns: detectedTier1Columns,
    },
  };
}
