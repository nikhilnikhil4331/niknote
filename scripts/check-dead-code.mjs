#!/usr/bin/env node
// ============================================================
// check-dead-code.mjs — fail the build when a source module is
// shipped but nothing can ever reach it.
//
// Why this exists: the repo had a whole `src/services/*` folder that
// nothing imported. It compiled, it shipped in the bundle graph, and it
// quietly rotted. This walks the real import graph from the app entry
// points instead of trusting "it's in src/, so it must be used".
//
// It is intentionally conservative:
//  - only local module specifiers are resolved (`@/…`, `./…`, `../…`)
//  - tests, type declarations and the test setup are excluded
//  - dynamic `import('@/…')` string literals count as edges
//  - a small allowlist covers deliberate public surfaces (shadcn primitives)
//
// Because the repo already carries a backlog of unreferenced screens, the
// check compares against `scripts/dead-code-baseline.json`: known dead modules
// are reported as debt, and *new* ones fail CI. Regenerate the baseline only
// after deliberately accepting new debt.
//
// Usage:
//   node scripts/check-dead-code.mjs                  # fail on new dead code
//   node scripts/check-dead-code.mjs --list           # report only, exit 0
//   node scripts/check-dead-code.mjs --update-baseline
// ============================================================

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SRC = join(ROOT, 'src');

/** Files that are roots of the graph rather than leaves in it. */
const ENTRY_POINTS = [
  'src/main.tsx',
  'src/App.tsx',
];

/**
 * Not "dead" even with no importer:
 *  - shadcn/ui primitives are a design-system surface, imported on demand
 *  - declaration files carry types only
 *  - the test setup/runners are loaded by vitest config
 */
const ALLOWLIST_PATTERNS = [
  /^src\/components\/ui\//,
  /\.d\.ts$/,
  /^src\/vite-env\.d\.ts$/,
  /^src\/test\//,
  /^src\/setupTests\./,
  /^src\/test-utils\//,
];

const BASELINE_FILE = join(ROOT, 'scripts', 'dead-code-baseline.json');
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (IGNORED_DIRS.has(entry)) continue;
      walk(full, out);
    } else if (CODE_EXTENSIONS.includes(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC).filter(file => {
  const rel = relative(ROOT, file).split('\\').join('/');
  return !/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(rel);
});

/** `@/foo` → <root>/src/foo, `./foo` → resolved against the importer. */
function resolveSpecifier(specifier, importer) {
  if (specifier.startsWith('@/')) return join(SRC, specifier.slice(2));
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return resolve(dirname(importer), specifier);
  }
  return null;
}

/** Resolve a base path to a real file: exact, or with an extension, or index. */
function toExistingFile(base) {
  if (!base) return null;
  const candidates = [
    base,
    ...CODE_EXTENSIONS.map(ext => `${base}${ext}`),
    ...CODE_EXTENSIONS.map(ext => join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** All local module specifiers a file references (static, lazy, re-export). */
function importsOf(file) {
  const source = readFileSync(file, 'utf8');
  const specifiers = new Set();
  const patterns = [
    /(?:^|[^\w$])(?:import|export)\s[^'"()]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|[^\w$])import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) specifiers.add(match[1]);
  }
  return [...specifiers];
}

const known = new Set(files);
const reachable = new Set();
const queue = [];

for (const entry of ENTRY_POINTS) {
  const file = toExistingFile(join(ROOT, entry));
  if (!file) {
    console.error(`✖ Entry point missing: ${entry}`);
    process.exit(2);
  }
  queue.push(file);
  reachable.add(file);
}

while (queue.length) {
  const file = queue.pop();
  for (const specifier of importsOf(file)) {
    const target = toExistingFile(resolveSpecifier(specifier, file));
    if (!target || !known.has(target) || reachable.has(target)) continue;
    reachable.add(target);
    queue.push(target);
  }
}

/** Modules reached only from tests: production-dead, but proven used in specs. */
function reachableFromTests() {
  const seen = new Set();
  const testRoots = walk(SRC).filter(file => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file));
  const pending = [...testRoots];
  while (pending.length) {
    const file = pending.pop();
    for (const specifier of importsOf(file)) {
      const target = toExistingFile(resolveSpecifier(specifier, file));
      if (!target || !known.has(target) || seen.has(target)) continue;
      seen.add(target);
      pending.push(target);
    }
  }
  return seen;
}

const fromTests = reachableFromTests();

const dead = files
  .filter(file => !reachable.has(file))
  .map(file => relative(ROOT, file).split('\\').join('/'))
  .filter(rel => !ALLOWLIST_PATTERNS.some(pattern => pattern.test(rel)))
  .sort();

const listOnly = process.argv.includes('--list');
const updateBaseline = process.argv.includes('--update-baseline');
const testOnly = dead.filter(rel => {
  const file = join(ROOT, rel);
  return fromTests.has(file);
});

if (updateBaseline) {
  writeFileSync(BASELINE_FILE, `${JSON.stringify(dead, null, 2)}\n`);
  console.log(`✔ Baseline written: ${dead.length} known dead module(s) → scripts/dead-code-baseline.json`);
  process.exit(0);
}

let baseline = [];
if (existsSync(BASELINE_FILE)) {
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
    if (Array.isArray(parsed)) baseline = parsed;
  } catch {
    console.error('✖ scripts/dead-code-baseline.json is not valid JSON.');
    process.exit(2);
  }
}
const baselineSet = new Set(baseline);
const added = dead.filter(rel => !baselineSet.has(rel));
const fixed = baseline.filter(rel => !dead.includes(rel));

if (testOnly.length) {
  console.log(`ℹ ${testOnly.length} module(s) are imported only by tests (fine, but not shipped logic):`);
  for (const rel of testOnly) console.log(`  - ${rel}`);
}

if (dead.length === 0) {
  console.log(`✔ No dead modules (${files.length} source files reachable from ${ENTRY_POINTS.length} entry points).`);
  process.exit(0);
}

console.log(`ℹ ${dead.length} module(s) unreachable from the app; ${baseline.length} were already known.`);

if (fixed.length) {
  console.log(`✔ ${fixed.length} baseline entry/entries are now reachable — run --update-baseline to shrink the list:`);
  for (const rel of fixed) console.log(`  - ${rel}`);
}

if (added.length === 0) {
  console.log('✔ No new dead modules.');
  process.exit(0);
}

console.error(`✖ ${added.length} NEW source module(s) are never imported:`);
for (const rel of added) console.error(`  - ${rel}`);
console.error('\nWire them up, delete them, or (deliberately) run --update-baseline.');
process.exit(listOnly ? 0 : 1);
