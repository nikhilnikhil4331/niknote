import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Users, BarChart3, Crown, 
  CheckCircle2, XCircle, RefreshCw, LogOut, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface UserData {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  is_premium: boolean;
}

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  totalNotebooks: number;
}

const Admin: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, premiumUsers: 0, totalNotebooks: 0 });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) throw error;
      
      setIsAdmin(!!data);
      
      if (data) {
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      // Load profiles with subscription status
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Load subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from('user_subscriptions')
        .select('user_id, status');

      if (subsError) throw subsError;

      // Get notebooks count
      const { count: notebooksCount } = await supabase
        .from('notebooks')
        .select('*', { count: 'exact', head: true });

      // Map users with premium status
      const usersWithStatus: UserData[] = (profiles || []).map(profile => {
        const sub = subscriptions?.find(s => s.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: profile.display_name || 'Unknown',
          display_name: profile.display_name,
          created_at: profile.created_at,
          is_premium: sub?.status === 'active',
        };
      });

      setUsers(usersWithStatus);
      setStats({
        totalUsers: usersWithStatus.length,
        premiumUsers: usersWithStatus.filter(u => u.is_premium).length,
        totalNotebooks: notebooksCount || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setRefreshing(false);
    }
  };

  const togglePremium = async (userId: string, currentStatus: boolean) => {
    try {
      const newStatus = currentStatus ? 'cancelled' : 'active';
      
      const { data, error } = await supabase.functions.invoke('record-payment', {
        body: {
          userId,
          planCode: 'admin_granted',
          status: newStatus,
        },
      });

      if (error || !data?.success) throw error || new Error(data?.error || 'Subscription update failed');
      
      toast.success(`Premium ${currentStatus ? 'revoked' : 'granted'} successfully`);
      await loadDashboardData();
    } catch (error) {
      console.error('Error toggling premium:', error);
      toast.error('Failed to update premium status');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin">
          <RefreshCw className="w-8 h-8 text-accent-rose" />
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="rounded-2xl shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                This area is restricted to administrators only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/')} 
                className="w-full rounded-xl"
              >
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Nikhil Notes</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-xl">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[color:hsl(var(--accent-cool-hsl)/0.1)] flex items-center justify-center">
                    <Users className="w-6 h-6 text-accent-cool" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-nk-warm-600/10 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-accent-warm" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Premium Users</p>
                    <p className="text-2xl font-bold">{stats.premiumUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Notebooks</p>
                    <p className="text-2xl font-bold">{stats.totalNotebooks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Users Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage user accounts and premium access</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadDashboardData}
                disabled={refreshing}
                className="rounded-xl gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map((userData) => (
                  <motion.div
                    key={userData.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-accent-rose">
                          {(userData.display_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{userData.display_name || 'Unknown User'}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(userData.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={userData.is_premium ? 'default' : 'secondary'}
                        className="rounded-full"
                      >
                        {userData.is_premium ? 'Premium' : 'Free'}
                      </Badge>
                      <Button
                        variant={userData.is_premium ? 'destructive' : 'default'}
                        size="sm"
                        onClick={() => togglePremium(userData.id, userData.is_premium)}
                        className="rounded-lg text-xs gap-1"
                      >
                        {userData.is_premium ? (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            Revoke
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Grant
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                ))}

                {users.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default Admin;
