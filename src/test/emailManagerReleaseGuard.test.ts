import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Email Manager production release guard', () => {
  const script = resolve('scripts/check-email-manager.mjs');
  it('accepts the current admin routes, manager, retro template and Resend sync', () => {
    expect(execFileSync(process.execPath, [script], { encoding: 'utf8' })).toContain('release guard passed');
  });
  it('rejects a checkout missing the email manager', () => {
    const root = mkdtempSync(join(tmpdir(), 'niknote-email-guard-'));
    try {
      for (const path of ['src/App.tsx', 'src/pages/AdminPanelNikhil.tsx', 'src/pages/Admin.tsx', 'src/components/admin/AdminMailflareStudio.tsx', 'src/lib/mailflareClient.ts', 'supabase/functions/resend-inbox-sync/index.ts']) {
        const dest = join(root, path);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(resolve(path), dest);
      }
      unlinkSync(join(root, 'src/components/admin/AdminMailflareStudio.tsx'));
      const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('missing src/components/admin/AdminMailflareStudio.tsx');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
