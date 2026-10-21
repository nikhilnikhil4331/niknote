/**
 * Repository hygiene guard.
 *
 * Two standing rules for this repo:
 *   1. The previous no-code builder must not be named anywhere — not in code, docs,
 *      config, lockfiles or metadata. NikNote is its own project.
 *   2. Root stays tidy: long reports live in docs/archive/, build artifacts are not
 *      committed, and every AI provider key stays server-side (see aiKeyHygiene).
 *
 * If a dependency or generated file reintroduces the name, this fails loudly.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const FORBIDDEN = /lovable/i;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-ssr', '.git', 'coverage', '.vercel', 'build']);
const SKIP_FILES = new Set(['repoHygiene.test.ts']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root).filter((f) => !/\.(png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf|mp4|zip|pdf|lockb)$/i.test(f));

describe('repository hygiene', () => {
  it('never mentions the previous builder anywhere in the repo', () => {
    const offenders = files.filter((file) => FORBIDDEN.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => f.slice(root.length + 1))).toEqual([]);
  });

  it('keeps long-form reports out of the repository root', () => {
    const rootDocs = readdirSync(root).filter((f) => f.endsWith('.md'));
    expect(rootDocs.sort()).toEqual(['AGENTS.md', 'README.md', 'THIRD_PARTY_NOTICES.md']);
    expect(existsSync(join(root, 'docs/archive'))).toBe(true);
  });

  it('does not commit TypeScript build artifacts', () => {
    const tracked = readdirSync(root).filter((f) => f.endsWith('.tsbuildinfo'));
    expect(tracked).toEqual([]);
  });
});
