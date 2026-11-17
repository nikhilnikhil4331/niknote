import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20261104100000_harden_anon_ai_quota.sql';
const migration = readFileSync(migrationPath, 'utf8');

describe('anonymous AI quota hardening migration', () => {
  it('keeps quota data private and permits the RPC only to service_role', () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.anon_ai_limits FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.consume_anon_quota\(text, integer, integer\) FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.consume_anon_quota\(text, integer, integer\) TO service_role/i);
  });

  it('requires service-role claims and fixes quota identity, limit, and window in the function', () => {
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(migration).toContain("p_bucket !~ '^[a-f0-9]{64}$'");
    expect(migration).toContain('p_limit IS DISTINCT FROM 5');
    expect(migration).toContain('p_window_seconds IS DISTINCT FROM 3600');
    expect(migration).toContain('ON CONFLICT (bucket, window_start)');
    expect(migration).toContain('request_count < 5');
  });
});
