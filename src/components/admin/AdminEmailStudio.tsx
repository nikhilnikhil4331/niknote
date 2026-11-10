import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, Clock3, Mail, RefreshCw, Search, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { buildNikNoteWelcomeEmail, NIKNOTE_WELCOME_TEMPLATE_ID } from '../../../supabase/functions/_shared/admin-welcome-email';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

const MAX_RECIPIENTS_PER_SEND = 25;
type RecentDays = 7 | 30 | 90;
type Recipient = {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  already_sent: boolean;
  sent_at: string | null;
};
type SendResult = {
  user_id: string;
  email?: string;
  status: 'accepted' | 'skipped' | 'failed';
  reason?: string;
  audit_logged?: boolean;
};
type SendSummary = { results: SendResult[]; accepted: number; skipped: number; failed: number };

async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  const adminToken = sessionStorage.getItem('admin_token');
  if (!adminToken) throw new Error('Your admin session has expired. Sign in again to continue.');
  const { data, error } = await supabase.functions.invoke('admin-welcome-email', {
    body: { action, payload },
    headers: { 'x-admin-token': adminToken },
  });
  if (error) throw new Error(data?.error || 'Could not complete the email request.');
  if (data?.error) throw new Error(data.error);
  return data;
}

function joinedLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Signup date unavailable'
    : `Joined ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function AdminEmailStudio() {
  const [days, setDays] = useState<RecentDays>(30);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<SendSummary | null>(null);

  const loadRecipients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callAdmin('list_recipients', { days });
      setRecipients(Array.isArray(data?.recipients) ? data.recipients : []);
      setTruncated(Boolean(data?.truncated));
    } catch (e) {
      setRecipients([]);
      setTruncated(false);
      setError(e instanceof Error ? e.message : 'Could not load recent signups.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void loadRecipients(); }, [loadRecipients]);

  const filteredRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recipients;
    return recipients.filter((recipient) => recipient.email.toLowerCase().includes(query)
      || recipient.display_name.toLowerCase().includes(query));
  }, [recipients, search]);
  const availableRecipients = filteredRecipients.filter((recipient) => !recipient.already_sent);
  const selectedCount = selectedIds.size;
  const allAvailableSelected = availableRecipients.length > 0
    && availableRecipients.every((recipient) => selectedIds.has(recipient.user_id));
  const preview = useMemo(() => buildNikNoteWelcomeEmail('Asha'), []);

  const toggleRecipient = (recipient: Recipient, checked: boolean | 'indeterminate') => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked === true) {
        if (next.size < MAX_RECIPIENTS_PER_SEND) next.add(recipient.user_id);
      } else {
        next.delete(recipient.user_id);
      }
      return next;
    });
  };

  const toggleVisible = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allAvailableSelected) {
        availableRecipients.forEach((recipient) => next.delete(recipient.user_id));
        return next;
      }
      const remaining = Math.max(0, MAX_RECIPIENTS_PER_SEND - next.size);
      availableRecipients.filter((recipient) => !next.has(recipient.user_id))
        .slice(0, remaining)
        .forEach((recipient) => next.add(recipient.user_id));
      return next;
    });
  };

  const sendWelcomeEmails = async () => {
    setSending(true);
    setError('');
    setSummary(null);
    try {
      const data = await callAdmin('send_welcome', { days, user_ids: Array.from(selectedIds) });
      const nextSummary: SendSummary = {
        results: Array.isArray(data?.results) ? data.results : [],
        accepted: Number(data?.accepted || 0),
        skipped: Number(data?.skipped || 0),
        failed: Number(data?.failed || 0),
      };
      setSummary(nextSummary);
      setSelectedIds(new Set());
      setConfirmOpen(false);
      await loadRecipients();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the welcome email.');
      setConfirmOpen(false);
    } finally {
      setSending(false);
    }
  };

  const unloggedAccepted = summary?.results.filter((result) => result.status === 'accepted' && result.audit_logged === false).length || 0;
  const detailedResults = summary?.results.filter((result) => result.status === 'failed' || result.audit_logged === false) || [];

  return (
    <section className="space-y-4" aria-label="NikNote email studio">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">NikNote Email Studio</h2>
            <Badge variant="secondary">Welcome · v1</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            A fresh Fredoka + Inter welcome email, styled to match NikNote. Choose recent accounts below; only verified email addresses are eligible.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadRecipients()} disabled={loading || sending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh recipients
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Card className="min-w-0">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-primary" /> Recent signups</CardTitle>
              <CardDescription className="mt-1">Send individually to selected new users. Each address receives a separate email.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={String(days)} onValueChange={(value) => {
                setDays(Number(value) as RecentDays);
                setSelectedIds(new Set());
                setSummary(null);
              }}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Signup age window">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Joined in last 7 days</SelectItem>
                  <SelectItem value="30">Joined in last 30 days</SelectItem>
                  <SelectItem value="90">Joined in last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" aria-label="Search recent signups" placeholder="Search name or email…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{loading ? 'Loading recipients…' : `${recipients.length} verified account${recipients.length === 1 ? '' : 's'} in this window`}</span>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={toggleVisible} disabled={loading || availableRecipients.length === 0 || (!allAvailableSelected && selectedCount >= MAX_RECIPIENTS_PER_SEND)}>
                <CheckCheck className="mr-1.5 h-4 w-4" /> {allAvailableSelected ? 'Clear visible' : 'Select up to 25'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            {truncated && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">Showing the 200 most recent verified signups. Narrow the date window to work through a larger audience.</p>}
            {summary && <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-semibold">{summary.accepted} accepted by Resend · {summary.skipped} skipped · {summary.failed} failed</p>
              <p className="mt-1 text-xs text-muted-foreground">Acceptance is not a delivery receipt. NikNote does not verify inbox delivery here.</p>
              {unloggedAccepted > 0 && <p className="mt-1 text-xs text-amber-700">{unloggedAccepted} accepted message(s) could not be written to the email audit log.</p>}
              {detailedResults.map((result) => <p key={`${result.user_id}-${result.status}`} className="mt-1 text-xs text-muted-foreground">
                {result.email || result.user_id}: {result.reason || 'Audit log warning'}
              </p>)}
            </div>}
            <div className="max-h-[510px] space-y-2 overflow-auto pr-1">
              {!loading && filteredRecipients.length === 0 && !error && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No verified signups found for this period.</p>}
              {filteredRecipients.map((recipient) => {
                const checked = selectedIds.has(recipient.user_id);
                const disabled = recipient.already_sent || (!checked && selectedCount >= MAX_RECIPIENTS_PER_SEND);
                return <label key={recipient.user_id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${recipient.already_sent ? 'cursor-default bg-muted/30 opacity-75' : checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}>
                  <Checkbox className="mt-1" checked={checked} disabled={disabled || loading || sending} onCheckedChange={(value) => toggleRecipient(recipient, value)} aria-label={`Select ${recipient.email}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{recipient.display_name}</span>
                      {recipient.already_sent && <Badge variant="secondary" className="gap-1 text-[10px]"><Check className="h-3 w-3" /> Welcome sent</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{recipient.email}</span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{joinedLabel(recipient.created_at)}</span>
                  </span>
                </label>;
              })}
            </div>
            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">{selectedCount} selected · maximum {MAX_RECIPIENTS_PER_SEND} per send</p>
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button disabled={selectedCount === 0 || loading || sending} className="gap-2">
                    <Send className="h-4 w-4" /> Review send
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Send the NikNote welcome email?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This sends the fixed “Welcome · v1” template to {selectedCount} selected, verified account{selectedCount === 1 ? '' : 's'}, one message per recipient. This can’t be recalled. No email is sent until you confirm here.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={sending} onClick={(event) => {
                      event.preventDefault();
                      void sendWelcomeEmails();
                    }}>
                      {sending ? 'Sending…' : `Send to ${selectedCount}`}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Template preview</CardTitle>
            <CardDescription>Rendered from the same HTML template used by the secure sender.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <iframe
              title="NikNote welcome email preview"
              sandbox=""
              srcDoc={preview.html}
              className="h-[630px] w-full rounded-xl border bg-[#F4F6FB]"
            />
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />The template contains a NikNote sign-in link and support contact only—no private note content. “Accepted” is logged when Resend accepts the request.</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Template ID: {NIKNOTE_WELCOME_TEMPLATE_ID}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
