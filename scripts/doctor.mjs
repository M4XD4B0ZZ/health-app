import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');

const counts = { pass: 0, warn: 0, fail: 0, info: 0 };

function log(kind, msg) {
  const K = kind.toUpperCase();
  if (kind in counts) counts[kind] += 1;
  console.log(`${K} ${msg}`);
}

function resolve(...segments) {
  return path.join(root, ...segments);
}

function exists(...segments) {
  return fs.existsSync(resolve(...segments));
}

function safeRead(...segments) {
  try {
    return fs.readFileSync(resolve(...segments), 'utf8');
  } catch {
    return null;
  }
}

function safeJson(filePath) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return null;
  }
}

function listDirs(absPath) {
  try {
    return fs
      .readdirSync(absPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function listFilesExt(absPath, ext) {
  try {
    return fs
      .readdirSync(absPath, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith(ext))
      .map((f) => f.name)
      .sort();
  } catch {
    return [];
  }
}

function checkFile(file) {
  if (exists(file)) {
    log('pass', `${file} exists`);
    return true;
  }
  log('fail', `${file} is missing`);
  return false;
}

function checkIncludes(fileLabel, text, needle, { warnOnly = false } = {}) {
  if (text && text.includes(needle)) {
    log('pass', `${fileLabel} contains "${needle}"`);
    return true;
  }
  if (warnOnly) {
    log('warn', `${fileLabel} is missing "${needle}"`);
    return false;
  }
  log('fail', `${fileLabel} is missing "${needle}"`);
  return false;
}

function writePackageJson(obj) {
  fs.writeFileSync(pkgPath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  log('info', 'package.json updated with doctor script');
}

async function main() {
  console.log('== HealthApp Repo Doctor ==\n');

  // Required files
  const requiredFiles = ['README.md', 'ROADMAP.md', 'VERIFY.md', 'AGENTS.md', 'package.json'];
  for (const f of requiredFiles) checkFile(f);

  // package.json and scripts
  const pkg = safeJson(pkgPath);
  if (!pkg) {
    log('fail', 'package.json could not be read or parsed');
  } else {
    if (pkg.scripts && typeof pkg.scripts === 'object') {
      log('pass', 'package.json contains a scripts block');
    } else {
      log('fail', 'package.json does not contain a scripts block');
    }

    const neededScripts = ['lint', 'typecheck', 'verify', 'doctor'];
    for (const s of neededScripts) {
      if (pkg.scripts && typeof pkg.scripts[s] === 'string' && pkg.scripts[s].trim()) {
        log('pass', `package.json scripts.${s} exists`);
      } else {
        if (s === 'doctor') {
          // add doctor script deterministically
          pkg.scripts = pkg.scripts || {};
          pkg.scripts.doctor = 'node scripts/doctor.mjs';
          writePackageJson(pkg);
          log('pass', 'package.json scripts.doctor added');
        } else {
          log('fail', `package.json scripts.${s} is missing`);
        }
      }
    }

    if (pkg.scripts && typeof pkg.scripts.build === 'string' && pkg.scripts.build.trim()) {
      log('pass', 'package.json scripts.build exists');
    } else {
      log('warn', 'package.json scripts.build is missing (allowed)');
    }
  }

  // Check ROADMAP statuses
  const roadmap = safeRead('ROADMAP.md');
  if (roadmap) {
    for (const status of ['todo', 'in_progress', 'blocked', 'done']) {
      checkIncludes('ROADMAP.md', roadmap, status);
    }
  }

  // VERIFY.md contains npm run verify
  const verify = safeRead('VERIFY.md');
  if (verify) checkIncludes('VERIFY.md', verify, 'npm run verify');

  // AGENTS.md mentions ROADMAP.md and VERIFY.md
  const agents = safeRead('AGENTS.md');
  if (agents) {
    checkIncludes('AGENTS.md', agents, 'ROADMAP.md');
    checkIncludes('AGENTS.md', agents, 'VERIFY.md');
  }

  // README references
  const readme = safeRead('README.md');
  if (readme) {
    checkIncludes('README.md', readme, 'ROADMAP.md');
    checkIncludes('README.md', readme, 'VERIFY.md');
    checkIncludes('README.md', readme, 'AGENTS.md');
  }

  // supabase checks
  if (exists('supabase')) {
    log('info', 'supabase/ directory detected');
    if (exists('supabase', 'config.toml')) log('pass', 'supabase/config.toml exists');
    else log('fail', 'supabase/config.toml is missing');

    if (exists('supabase', 'functions')) {
      const fnDir = resolve('supabase', 'functions');
      const funcs = listDirs(fnDir);
      if (funcs.length > 0) log('info', `supabase/functions contains: ${funcs.join(', ')}`);
      else log('warn', 'supabase/functions exists but contains no function folders');
    }
  }

  // scripts folder .mjs files
  if (exists('scripts')) {
    const scriptsDir = resolve('scripts');
    const mjs = listFilesExt(scriptsDir, '.mjs');
    if (mjs.length > 0) log('info', `scripts/ contains .mjs files: ${mjs.join(', ')}`);
    else log('warn', 'scripts/ exists but contains no .mjs files');
  }

  console.log('\n== Summary ==');
  console.log(`PASS ${counts.pass}`);
  console.log(`WARN ${counts.warn}`);
  console.log(`FAIL ${counts.fail}`);
  console.log(`INFO ${counts.info}`);

  process.exit(counts.fail > 0 ? 1 : 0);
}

main();
