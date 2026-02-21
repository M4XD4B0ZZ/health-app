import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const tsconfigPath = path.join(rootDir, 'tsconfig.json');
const packageJsonPath = path.join(rootDir, 'package.json');
const babelConfigPath = path.join(rootDir, 'babel.config.js');

const tsconfig = readJson(tsconfigPath);
const pkg = readJson(packageJsonPath);
const babelConfigSource = fs.readFileSync(babelConfigPath, 'utf8');

const excludes = tsconfig.exclude ?? [];
if (!excludes.includes('supabase/functions/**')) {
  fail('tsconfig.json must exclude supabase/functions/**');
}

const paths = tsconfig.compilerOptions?.paths ?? {};
const aliasPaths = paths['@/*'];
if (!Array.isArray(aliasPaths) || !aliasPaths.includes('src/*')) {
  fail('tsconfig.json must map @/* to src/*');
}

if (!pkg.scripts?.verify) {
  fail('package.json must include a verify script');
}

if (
  !babelConfigSource.includes("'module-resolver'") ||
  !babelConfigSource.includes("'@': './src'")
) {
  fail("babel.config.js must define module-resolver alias '@' -> './src'");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Doctor checks passed.');
