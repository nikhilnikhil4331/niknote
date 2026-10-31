import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Crown, BookOpen, FileText, 
  LogIn, UserPlus, Download, CreditCard,
  Eye, Activity
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsData {
  totalUsers: number;
  premiumUsers: number;
  totalNotebooks: number;
  totalPages: number;
  todayLogins: number;
  todaySignups: number;
  todayExports: number;
  paymentAttempts: number;
  todayVisits: number;
  activeUsers: number;
}

interface AdminStatsCardsProps {
  stats: StatsData;
  loading?: boolean;
}

const statsConfig = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, color: 'bg-[color:hsl(var(--accent-cool-hsl)/0.1)] text-accent-cool' },
  { key: 'premiumUsers', label: 'Premium Users', icon: Crown, color: 'bg-nk-warm-600/10 text-accent-warm' },
  { key: 'activeUsers', label: 'Active Today', icon: Activity, color: 'bg-success/10 text-success' },
  { key: 'todayVisits', label: 'Today Visits', icon: Eye, color: 'bg-primary/10 text-accent-cool' },
  { key: 'todaySignups', label: 'Signups Today', icon: UserPlus, color: 'bg-success/10 text-success' },
  { key: 'todayLogins', label: 'Logins Today', icon: LogIn, color: 'bg-[color:hsl(var(--accent-cool-hsl)/0.1)] text-accent-cool' },
  { key: 'totalNotebooks', label: 'Total Notebooks', icon: BookOpen, color: 'bg-primary/10 text-accent-cool' },
  { key: 'totalPages', label: 'Total Pages', icon: FileText, color: 'bg-primary/10 text-accent-rose' },
  { key: 'todayExports', label: 'Exports Today', icon: Download, color: 'bg-nk-warm-600/10 text-accent-warm' },
  { key: 'paymentAttempts', label: 'Payment Attempts', icon: CreditCard, color: 'bg-error/10 text-error' },
];

export const AdminStatsCards: React.FC<AdminStatsCardsProps> = ({ stats, loading }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {statsConfig.map((stat, index) => {
        const Icon = stat.icon;
        const value = stats[stat.key as keyof StatsData];
        
        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="rounded-xl overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                    <p className="text-lg sm:text-xl font-bold">
                      {loading ? '...' : value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
