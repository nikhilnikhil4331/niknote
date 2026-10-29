import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Vite expands a reference to the entire import.meta.env object into every
// VITE_* value at build time. Only statically named public settings may be
// referenced in browser code. Provider credentials stay on the server.
const providerKeys = new Set(['VITE_GEMINI_KEY', 'VITE_GROQ_KEY', 'VITE_LARPROUTER_KEY', 'VITE_OPENAI_KEY']);
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : sourceFiles(file);
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}
function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
  return node;
}

describe('browser environment exposure', () => {
  it('never reads the complete Vite env object or provider-key environment variables', () => {
    const issues: string[] = [];
    for (const file of sourceFiles('src')) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node: ts.Node) => {
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'env') {
          const base = unwrap(node.expression);
          if (ts.isMetaProperty(base) && base.keywordToken === ts.SyntaxKind.ImportKeyword && base.name.text === 'meta') {
            const parent = node.parent;
            if (!ts.isPropertyAccessExpression(parent) || parent.expression !== node) {
              issues.push(`${file}: whole import.meta.env object`);
            } else if (providerKeys.has(parent.name.text)) {
              issues.push(`${file}: provider credential ${parent.name.text}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(issues).toEqual([]);
  });

  it('limits Vite browser exposure to explicitly public prefixes', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    const prefixes = config.match(/envPrefix:\s*\[([\s\S]*?)\]/)?.[1];
    expect(prefixes).toBeTruthy();
    expect(prefixes).not.toMatch(/["']VITE_["']/);
    for (const key of providerKeys) expect(prefixes).not.toContain(key);
    expect(prefixes).toContain('VITE_SUPABASE_URL');
  });
});
