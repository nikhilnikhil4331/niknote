import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

type Lead = { id: string; name: string; email: string; phone: string | null; institution: string; students: number | null; message: string | null; stage: string; created_at: string };
type Overview = { verifiedPayments: number; grossVerifiedPaise: number; institutionLeads: number; recentLeads: Lead[] };

export function AdminSalesOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = sessionStorage.getItem('admin_token');
      const { data: response, error: failure } = await supabase.functions.invoke('sales-overview', {
        body: {}, headers: token ? { 'x-admin-token': token } : {},
      });
      if (failure || !response || !Array.isArray(response.recentLeads)) throw new Error('Could not load verified sales and inquiries.');
      setData(response as Overview);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load verified sales and inquiries.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <section className="space-y-4" aria-label="Verified sales and institution inquiries">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Verified sales &amp; inquiries</h2><p className="text-sm text-muted-foreground">Read-only view; refresh for the latest records.</p></div>
      <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && !data && <p className="text-sm text-muted-foreground">Loading verified records…</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Verified payments', data.verifiedPayments.toLocaleString('en-IN')],
          ['Gross verified captures', `₹${(data.grossVerifiedPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
          ['Institution inquiries', data.institutionLeads.toLocaleString('en-IN')],
        ].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>)}
      </div>
      <p className="text-xs text-muted-foreground">These are captures recorded in NikNote's verified ledger, not bank settlements. Historical unverified payments, later refunds and provider fees are not reconciled here.</p>
      <Card><CardHeader><CardTitle className="text-base">Recent institution inquiries</CardTitle><p className="text-xs text-muted-foreground">Latest 50; contact people only about their inquiry.</p></CardHeader>
        <CardContent className="space-y-4">
          {data.recentLeads.length === 0 && <p className="text-sm text-muted-foreground">No inquiries recorded yet.</p>}
          {data.recentLeads.map(lead => <article key={lead.id} className="border rounded-xl p-4 space-y-1 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><strong>{lead.institution}</strong><span className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('en-IN')} · {lead.stage}</span></div>
            <p>{lead.name} · <a className="underline" href={`mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent('Your NikNote inquiry')}`}>{lead.email}</a>{lead.phone ? ` · ${lead.phone}` : ''}</p>
            {lead.students !== null && <p className="text-muted-foreground">Students: {lead.students}</p>}
            {lead.message && <p className="whitespace-pre-wrap text-muted-foreground">{lead.message}</p>}
          </article>)}
        </CardContent>
      </Card>
    </>}
  </section>;
}
