import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw, Search, Crown, Ban, ShieldCheck, ShieldOff, Trash2,
  Coins, BookOpen, FileText, Zap, Activity, Flame, User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface AdminUser {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  onboarding_completed: boolean;
  use_case: string | null;
  plan: string;
  premium_until: string | null;
  sub_status: string;
  coins: number;
  total_earned: number;
  referral_code: string | null;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  notebooks: number;
  pages: number;
  activity_7d: number;
  ai_requests_month: number;
  last_activity_at: string | null;
  banned_until: string | null;
  is_banned: boolean;
  is_admin?: boolean;
  has_profile?: boolean;
  provider?: string;
  email_confirmed?: boolean;
  last_sign_in_at?: string | null;

}

interface UserDetail {
  activities: any[];
  features: any[];
  notebooks: any[];
}

async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  const adminToken = sessionStorage.getItem('admin_token');
  // NOTE: do NOT set Content-Type here — supabase-js then skips JSON.stringify
  // and the body arrives as "[object Object]".
  const headers: Record<string, string> = {};
  if (adminToken) headers['x-admin-token'] = adminToken;
  const { data, error } = await supabase.functions.invoke('admin-user-management', {
    body: { action, payload },
    headers,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export const AdminCommandCenter: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'premium' | 'free' | 'banned' | 'active7d'>('all');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await callAdmin('list_users');
      setUsers(res?.users || []);
    } catch (e: any) {
      toast.error(`Failed to load users: ${e.message || e}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (u: AdminUser) => {
    setSelected(u);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await callAdmin('user_detail', { user_id: u.user_id });
      setDetail(res as UserDetail);
    } catch (e: any) {
      toast.error(`Failed to load details: ${e.message || e}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (label: string, action: string, payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      await callAdmin(action, payload);
      toast.success(label);
      await load();
      if (selected) {
        const fresh = users.find(u => u.user_id === selected.user_id);
        if (fresh) setSelected(fresh);
      }
    } catch (e: any) {
      toast.error(`${label} failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (filter === 'premium' && u.plan === 'free') return false;
      if (filter === 'free' && u.plan !== 'free') return false;
      if (filter === 'banned' && !u.is_banned) return false;
      if (filter === 'active7d' && u.activity_7d === 0) return false;
      if (!q) return true;
      return (u.email || '').toLowerCase().includes(q)
        || (u.display_name || '').toLowerCase().includes(q)
        || u.user_id.includes(q)
        || (u.referral_code || '').toLowerCase().includes(q);
    });
  }, [users, search, filter]);

  const stats = useMemo(() => ({
    total: users.length,
    premium: users.filter(u => u.plan !== 'free').length,
    banned: users.filter(u => u.is_banned).length,
    active7d: users.filter(u => u.activity_7d > 0).length,
    totalCoins: users.reduce((a, u) => a + u.coins, 0),
    totalPages: users.reduce((a, u) => a + u.pages, 0),
  }), [users]);

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total users', value: stats.total, icon: UserIcon },
          { label: 'Premium', value: stats.premium, icon: Crown },
          { label: 'Active 7d', value: stats.active7d, icon: Activity },
          { label: 'Banned', value: stats.banned, icon: Ban },
          { label: 'Pages', value: stats.totalPages, icon: FileText },
          { label: 'Coins in circ.', value: stats.totalCoins, icon: Coins },
        ].map((s) => (
          <Card key={s.label} className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold leading-tight">{s.value.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by email, name, user id, or referral code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['all', 'premium', 'free', 'active7d', 'banned'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
            >
              {f === 'active7d' ? 'Active 7d' : f[0].toUpperCase() + f.slice(1)}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Plan</th>
                <th className="text-right px-3 py-2">Notebooks</th>
                <th className="text-right px-3 py-2">Pages</th>
                <th className="text-right px-3 py-2">AI/mo</th>
                <th className="text-right px-3 py-2">Streak</th>
                <th className="text-right px-3 py-2">Coins</th>
                <th className="text-left px-3 py-2">Last active</th>
                <th className="text-left px-3 py-2">Joined</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Loading users…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No users match your filter.</td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.user_id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-[220px]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-semibold">
                        {(u.display_name || u.email || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          {u.display_name || u.email || u.user_id.slice(0, 8)}
                          {u.is_admin && <Badge variant="outline" className="text-[9px] px-1 py-0">admin</Badge>}
                          {!u.has_profile && <Badge variant="outline" className="text-[9px] px-1 py-0">legacy</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {u.email || 'no email'} · {u.provider || 'email'}
                          {u.email_confirmed === false && ' · unverified'}
                        </div>
                      </div>

                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {u.is_banned ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : u.plan !== 'free' ? (
                      <div>
                        <Badge className="bg-amber-500/90 text-white">
                          <Crown className="w-3 h-3 mr-1" />
                          {u.plan}
                        </Badge>
                        {u.premium_until && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            till {new Date(u.premium_until).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary">Free</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.notebooks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.pages}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.ai_requests_month}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-500" />{u.current_streak}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.coins}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.last_activity_at ? formatDistanceToNow(new Date(u.last_activity_at), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openDetail(u)}>Manage</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Manage user dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.display_name || selected.email || selected.user_id.slice(0, 8)}
                  {selected.plan !== 'free' && <Crown className="w-4 h-4 text-amber-500" />}
                  {selected.is_banned && <Ban className="w-4 h-4 text-destructive" />}
                </DialogTitle>
                <div className="text-xs text-muted-foreground font-mono">{selected.user_id}</div>
              </DialogHeader>

              <Tabs defaultValue="overview">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="features">Feature usage</TabsTrigger>
                  <TabsTrigger value="notebooks">Notebooks</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <MiniStat icon={BookOpen} label="Notebooks" value={selected.notebooks} />
                    <MiniStat icon={FileText} label="Pages" value={selected.pages} />
                    <MiniStat icon={Zap} label="AI this month" value={selected.ai_requests_month} />
                    <MiniStat icon={Activity} label="Events 7d" value={selected.activity_7d} />
                    <MiniStat icon={Flame} label="Streak" value={selected.current_streak} sub={`best ${selected.longest_streak}`} />
                    <MiniStat icon={Coins} label="Coins" value={selected.coins} sub={`earned ${selected.total_earned}`} />
                    <MiniStat icon={UserIcon} label="Onboarded" value={selected.onboarding_completed ? 'yes' : 'no'} />
                    <MiniStat icon={Crown} label="Plan" value={selected.plan} sub={selected.premium_until ? `till ${new Date(selected.premium_until).toLocaleDateString()}` : ''} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                    <ActionButton disabled={busy} icon={Crown} label="Grant 7 days premium"
                      onClick={() => runAction('Granted 7 days premium', 'grant_premium', { user_id: selected.user_id, days: 7 })} />
                    <ActionButton disabled={busy} icon={Crown} label="Grant 30 days premium"
                      onClick={() => runAction('Granted 30 days premium', 'grant_premium', { user_id: selected.user_id, days: 30 })} />
                    <ActionButton disabled={busy} icon={ShieldOff} label="Revoke premium" variant="outline"
                      onClick={() => runAction('Revoked premium', 'revoke_premium', { user_id: selected.user_id })} />
                    <ActionButton disabled={busy} icon={Coins} label="Set coins…" variant="outline"
                      onClick={async () => {
                        const v = prompt(`Set coins for ${selected.display_name || selected.email}:`, String(selected.coins));
                        if (v == null) return;
                        const n = Number(v);
                        if (!Number.isFinite(n) || n < 0) { toast.error('Invalid amount'); return; }
                        runAction(`Coins set to ${n}`, 'set_coins', { user_id: selected.user_id, coins: n });
                      }} />
                    <ActionButton disabled={busy} icon={ShieldCheck} label="Make admin" variant="outline"
                      onClick={() => runAction('Granted admin role', 'set_role', { user_id: selected.user_id, role: 'admin', grant: true })} />
                    <ActionButton disabled={busy} icon={ShieldOff} label="Remove admin" variant="outline"
                      onClick={() => runAction('Removed admin role', 'set_role', { user_id: selected.user_id, role: 'admin', grant: false })} />
                    {selected.is_banned ? (
                      <ActionButton disabled={busy} icon={ShieldCheck} label="Unban user"
                        onClick={() => runAction('User unbanned', 'unban_user', { user_id: selected.user_id })} />
                    ) : (
                      <ActionButton disabled={busy} icon={Ban} label="Ban user" variant="destructive"
                        onClick={() => {
                          if (!confirm(`Ban ${selected.email || selected.user_id}? They will be signed out and blocked from signing in.`)) return;
                          runAction('User banned', 'ban_user', { user_id: selected.user_id });
                        }} />
                    )}
                    <ActionButton disabled={busy} icon={Trash2} label="Delete user" variant="destructive"
                      onClick={() => {
                        if (!confirm(`Permanently DELETE ${selected.email || selected.user_id}? This cannot be undone.`)) return;
                        runAction('User deleted', 'delete_user', { user_id: selected.user_id });
                        setSelected(null);
                      }} />
                  </div>
                </TabsContent>

                <TabsContent value="activity">
                  {detailLoading ? <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div> : (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto text-xs">
                      {(detail?.activities || []).length === 0 && <div className="text-muted-foreground py-4 text-center">No activity recorded.</div>}
                      {(detail?.activities || []).map((a) => (
                        <div key={a.id} className="flex items-center justify-between border-b border-border/30 py-1.5">
                          <div>
                            <span className="font-medium">{a.action}</span>
                            <span className="text-muted-foreground ml-2">{a.category}</span>
                            {a.page_url && <span className="text-muted-foreground ml-2 truncate">{a.page_url}</span>}
                          </div>
                          <div className="text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="features">
                  {detailLoading ? <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div> : (
                    <div className="max-h-[400px] overflow-y-auto text-sm">
                      {(detail?.features || []).length === 0 && <div className="text-muted-foreground py-4 text-center">No feature usage recorded.</div>}
                      {(detail?.features || []).map((f) => (
                        <div key={f.id} className="flex items-center justify-between border-b border-border/30 py-1.5 text-xs">
                          <div>
                            <span className="font-medium">{f.feature_name}</span>
                            <span className="text-muted-foreground ml-2">{f.usage_month}</span>
                          </div>
                          <div className="tabular-nums font-semibold">{f.usage_count}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="notebooks">
                  {detailLoading ? <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div> : (
                    <div className="max-h-[400px] overflow-y-auto text-sm">
                      {(detail?.notebooks || []).length === 0 && <div className="text-muted-foreground py-4 text-center">No notebooks.</div>}
                      {(detail?.notebooks || []).map((n) => (
                        <div key={n.id} className="flex items-center justify-between border-b border-border/30 py-1.5 text-xs">
                          <div className="truncate">{n.title || 'Untitled'}</div>
                          <div className="text-muted-foreground">{formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MiniStat: React.FC<{ icon: any; label: string; value: string | number; sub?: string }> = ({ icon: Icon, label, value, sub }) => (
  <Card className="p-3">
    <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase">
      <Icon className="w-3 h-3" /> {label}
    </div>
    <div className="text-lg font-bold">{value}</div>
    {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
  </Card>
);

const ActionButton: React.FC<{
  icon: any; label: string; onClick: () => void; disabled?: boolean;
  variant?: 'default' | 'outline' | 'destructive';
}> = ({ icon: Icon, label, onClick, disabled, variant = 'default' }) => (
  <Button size="sm" variant={variant} disabled={disabled} onClick={onClick} className="justify-start">
    <Icon className="w-4 h-4 mr-2" />
    {label}
  </Button>
);
