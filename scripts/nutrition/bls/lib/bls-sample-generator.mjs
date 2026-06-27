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
]);

export function asHeaderString(value) {
  return value == null ? '' : String(value).trim();
}

export function findHeaderRow(rows, requiredHeader = 'BLS Code') {
  const index = rows.findIndex((row) => row.some((cell) => asHeaderString(cell) === requiredHeader));
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
  return Object.values(columnMap).filter((column) => !column.found);
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
  return uniqueNonEmpty(
    values.flatMap((value) => normalizeBlsName(value).split(' ')),
  );
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

export function mapBlsRowToSampleRecord(row, columnMap, options = {}) {
  const sourceRowIndex = options.sourceRowIndex;
  const sourceRowNumber = sourceRowIndex == null ? null : sourceRowIndex + 1;
  const blsCode = asHeaderString(cell(row, columnMap, 'blsCode'));
  if (!blsCode) return { ok: false, reason: 'missingBlsCode', sourceRowIndex, sourceRowNumber };

  const germanName = asHeaderString(cell(row, columnMap, 'germanName'));
  if (!germanName) return { ok: false, reason: 'missingGermanName', sourceRowIndex, sourceRowNumber };

  const englishNameRaw = asHeaderString(cell(row, columnMap, 'englishName'));
  const englishName = englishNameRaw || null;
  const parsedMacros = Object.fromEntries(
    Object.keys(MACRO_COMPONENTS).map((macro) => [macro, parseBlsNumber(cell(row, columnMap, `${macro}.value`))]),
  );

  const missingMacro = Object.values(parsedMacros).find((parsed) =>
    parsed.ok === false && (parsed.reason === 'missing' || parsed.reason === 'dash'),
  );
  if (missingMacro) return { ok: false, reason: 'missingRequiredMacros', sourceRowIndex, sourceRowNumber };

  const invalidMacro = Object.values(parsedMacros).find((parsed) => parsed.ok === false);
  if (invalidMacro) return { ok: false, reason: 'invalidRequiredMacros', sourceRowIndex, sourceRowNumber };

  const normalizedName = normalizeBlsName(germanName);
  const normalizedEnglishName = normalizeBlsName(englishName);
  const aliases = uniqueNonEmpty([normalizedName, normalizedEnglishName]);
  const tokens = tokenizeBlsNames(germanName, englishName);

  return {
    ok: true,
    record: {
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
    },
  };
}

export function buildBlsSampleRecords(rows, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const header = findHeaderRow(rows, 'BLS Code');
  if (header.index == null) throw new Error('Missing required BLS Code header row');

  const columnMap = buildColumnMap(header.headers);
  const missingColumns = validateRequiredColumns(columnMap);
  if (missingColumns.length > 0) {
    throw new Error(`Missing required BLS columns: ${missingColumns.map((column) => column.key).join(', ')}`);
  }

  const records = [];
  const exclusionCounts = {
    missingBlsCode: 0,
    missingGermanName: 0,
    missingRequiredMacros: 0,
    invalidRequiredMacros: 0,
  };
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
    records.push(mapped.record);
  }

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
      requiredMacroColumns: Object.entries(MACRO_COMPONENTS).map(([macro, componentCode]) => ({
        macro,
        componentCode,
        columnIndex: columnMap[`${macro}.value`].columnIndex,
        columnNumber: columnMap[`${macro}.value`].columnNumber,
        detectedHeader: columnMap[`${macro}.value`].detectedHeader,
      })),
    },
  };
}
