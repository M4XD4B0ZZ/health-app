import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { readSheet } from 'read-excel-file/node';

const TOOL_ID = 'P1-006C1_BLS_WORKBOOK_READ_PROOF';
const REQUIRED_HEAP_MB = 8192;
const RELAUNCH_ENV = 'BLS_WORKBOOK_SUMMARY_HEAP_RELAUNCHED';

const REPO_ROOT = process.cwd();
const BLS_DIR = 'BLS_4_0_2025_DE';

const DATA_WORKBOOK = {
  role: 'data',
  relativePath: path.join(BLS_DIR, 'BLS_4_0_Daten_2025_DE.xlsx'),
  sheetSelector: 1,
};

const COMPONENTS_WORKBOOK = {
  role: 'components',
  relativePath: path.join(BLS_DIR, 'BLS_4_0_Components_DE_EN.xlsx'),
  sheetSelector: 1,
};

const EXPECTED_COMPONENT_CODES = ['ENERCC', 'PROT625', 'FAT', 'CHO'];

const EXPECTED_DATA_COLUMNS = [
  { key: 'blsCode', label: 'BLS Code', match: (header) => header === 'BLS Code' },
  {
    key: 'germanName',
    label: 'Lebensmittelbezeichnung',
    match: (header) => header === 'Lebensmittelbezeichnung',
  },
  { key: 'englishName', label: 'Food name', match: (header) => header === 'Food name' },
  ...EXPECTED_COMPONENT_CODES.flatMap((code) => [
    {
      key: `${code}.value`,
      label: `${code} value`,
      match: (header) => header.startsWith(`${code} `),
    },
    {
      key: `${code}.provenance`,
      label: `${code} provenance`,
      match: (header) => header === `${code} Datenherkunft`,
    },
    {
      key: `${code}.reference`,
      label: `${code} reference`,
      match: (header) => header === `${code} Referenz`,
    },
  ]),
];

function refuseArgs() {
  const args = process.argv.slice(2);
  const refused = args.filter((arg) => {
    const normalized = arg.toLowerCase();
    return (
      normalized === '--write' ||
      normalized === '--output' ||
      normalized.startsWith('--output=') ||
      normalized === '-o' ||
      normalized.includes('write') ||
      normalized.includes('output')
    );
  });

  if (refused.length > 0 || args.length > 0) {
    const payload = {
      tool: TOOL_ID,
      ok: false,
      error: 'C1 is read-only and accepts no CLI flags. Write/output flags are refused.',
      refusedArgs: args,
      writesFiles: false,
    };
    console.error(JSON.stringify(payload, null, 2));
    process.exit(2);
  }
}

function relaunchWithLargerHeapIfNeeded() {
  const hasHeapFlag = process.execArgv.some((arg) => arg.startsWith('--max-old-space-size='));
  if (hasHeapFlag || process.env[RELAUNCH_ENV] === '1') {
    return;
  }

  const result = spawnSync(
    process.execPath,
    [`--max-old-space-size=${REQUIRED_HEAP_MB}`, ...process.argv.slice(1)],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, [RELAUNCH_ENV]: '1' },
      stdio: 'inherit',
    },
  );

  if (result.error) {
    console.error(
      JSON.stringify(
        {
          tool: TOOL_ID,
          ok: false,
          error: `Failed to relaunch Node with --max-old-space-size=${REQUIRED_HEAP_MB}: ${result.error.message}`,
          writesFiles: false,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function assertWorkbookExists(workbook) {
  const absolutePath = path.join(REPO_ROOT, workbook.relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required workbook: ${workbook.relativePath}`);
  }
  return absolutePath;
}

function countColumns(rows) {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function asHeaderString(value) {
  return value == null ? '' : String(value).trim();
}

function findHeaderRow(rows, requiredHeader) {
  const index = rows.findIndex((row) => row.some((cell) => asHeaderString(cell) === requiredHeader));
  if (index === -1) {
    return { index: null, headers: [] };
  }

  return { index, headers: rows[index].map(asHeaderString) };
}

function summarizeExpectedDataColumns(headers) {
  return EXPECTED_DATA_COLUMNS.map((expected) => {
    const columnIndex = headers.findIndex((header) => expected.match(header));
    return {
      key: expected.key,
      expected: expected.label,
      found: columnIndex !== -1,
      columnIndex: columnIndex === -1 ? null : columnIndex,
      columnNumber: columnIndex === -1 ? null : columnIndex + 1,
      detectedHeader: columnIndex === -1 ? null : headers[columnIndex],
    };
  });
}

function summarizeComponentRows(rows) {
  const header = findHeaderRow(rows, 'Nährstoffcode / Component code');
  const codeColumnIndex = header.headers.findIndex(
    (value) => value === 'Nährstoffcode / Component code',
  );

  const componentNameColumnIndex = header.headers.findIndex((value) => value === 'Component name');
  const unitColumnIndex = header.headers.findIndex((value) => value === 'Einheit / Unit');
  const groupColumnIndex = header.headers.findIndex((value) => value === 'Component group');

  const dataRows = header.index == null ? [] : rows.slice(header.index + 1);

  return {
    headerRowIndex: header.index,
    headerRowNumber: header.index == null ? null : header.index + 1,
    codeColumnIndex: codeColumnIndex === -1 ? null : codeColumnIndex,
    codeColumnNumber: codeColumnIndex === -1 ? null : codeColumnIndex + 1,
    expected: EXPECTED_COMPONENT_CODES.map((code) => {
      const rowIndex = dataRows.findIndex((row) => asHeaderString(row[codeColumnIndex]) === code);
      const row = rowIndex === -1 ? null : dataRows[rowIndex];
      return {
        code,
        found: rowIndex !== -1,
        rowIndex: rowIndex === -1 || header.index == null ? null : header.index + 1 + rowIndex,
        rowNumber: rowIndex === -1 || header.index == null ? null : header.index + 2 + rowIndex,
        componentName:
          row && componentNameColumnIndex !== -1 ? asHeaderString(row[componentNameColumnIndex]) : null,
        unit: row && unitColumnIndex !== -1 ? asHeaderString(row[unitColumnIndex]) : null,
        group: row && groupColumnIndex !== -1 ? asHeaderString(row[groupColumnIndex]) : null,
      };
    }),
  };
}

async function readWorkbook(workbook) {
  const absolutePath = assertWorkbookExists(workbook);
  const rows = await readSheet(absolutePath, { sheet: workbook.sheetSelector });

  return {
    workbook,
    absolutePath,
    rows,
    summary: {
      role: workbook.role,
      path: workbook.relativePath.replaceAll(path.sep, '/'),
      sha256: sha256File(absolutePath),
      sheetSelection: {
        selector: workbook.sheetSelector,
        limitation:
          'read-excel-file sheet-name listing was not used for C1; this script reads the first worksheet explicitly to avoid loading all sheets for the large data workbook.',
      },
      rowCount: rows.length,
      columnCount: countColumns(rows),
    },
  };
}

async function main() {
  refuseArgs();
  relaunchWithLargerHeapIfNeeded();

  const dataWorkbook = await readWorkbook(DATA_WORKBOOK);
  const componentsWorkbook = await readWorkbook(COMPONENTS_WORKBOOK);

  const dataHeader = findHeaderRow(dataWorkbook.rows, 'BLS Code');
  const dataExpectedColumns = summarizeExpectedDataColumns(dataHeader.headers);
  const components = summarizeComponentRows(componentsWorkbook.rows);

  const payload = {
    tool: TOOL_ID,
    ok: true,
    mode: 'read-only',
    writesFiles: false,
    generatesBlsIndexArtifacts: false,
    modifiesRuntimeBlsSourceBehavior: false,
    packageFilesModified: false,
    implementationNotes: [
      'Default behavior writes nothing and emits deterministic JSON to stdout.',
      `The script self-relaunches with --max-old-space-size=${REQUIRED_HEAP_MB} when no heap flag is present because the official data workbook is large for read-excel-file on the default Node heap.`,
      'Sheet-name listing is intentionally not attempted in C1; the first worksheet is read explicitly and this limitation is reported.',
    ],
    sourceFiles: {
      dataWorkbook: dataWorkbook.summary,
      componentsWorkbook: componentsWorkbook.summary,
    },
    validation: {
      dataWorkbook: {
        headerRowIndex: dataHeader.index,
        headerRowNumber: dataHeader.index == null ? null : dataHeader.index + 1,
        expectedColumns: dataExpectedColumns,
        allExpectedColumnsFound: dataExpectedColumns.every((column) => column.found),
      },
      componentsWorkbook: {
        present: true,
        ...components,
        allExpectedComponentRowsFound: components.expected.every((component) => component.found),
      },
    },
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        tool: TOOL_ID,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        writesFiles: false,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
