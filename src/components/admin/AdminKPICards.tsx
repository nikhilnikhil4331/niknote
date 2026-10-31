import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Crown, FileText, Download, 
  Activity, Eye, TrendingUp,
  DollarSign, Zap, Brain, Upload
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface KPIData {
  totalUsers: number;
  todayUsers: number;
  activeNow: number;
  totalPages: number;
  totalExports: number;
  totalRevenue: number;
  premiumUsers: number;
  conversionRate: number;
  avgSessionDuration: string;
  totalNotebooks: number;
  aiRequests?: number;
  totalUploads?: number;
}

interface AdminKPICardsProps {
  data: KPIData;
  loading?: boolean;
}

interface KPIConfig {
  key: keyof KPIData;
  label: string;
  icon: React.ElementType;
  color: string;
  format?: (value: number | string) => string;
  subLabel?: string;
}

const kpiConfig: KPIConfig[] = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, color: 'bg-[color:hsl(var(--accent-cool-hsl)/0.1)] text-accent-cool' },
  { key: 'todayUsers', label: 'Today Users', icon: Activity, color: 'bg-success/10 text-success' },
  { key: 'activeNow', label: 'Active Now', icon: Zap, color: 'bg-success/10 text-success', subLabel: 'last 15 min' },
  { key: 'premiumUsers', label: 'Active subscriptions', icon: Crown, color: 'bg-nk-warm-600/10 text-accent-warm' },
  { key: 'totalPages', label: 'Total Pages', icon: FileText, color: 'bg-primary/10 text-accent-cool' },
  { key: 'totalNotebooks', label: 'Notebooks', icon: FileText, color: 'bg-primary/10 text-accent-cool' },
  { key: 'totalExports', label: 'Total Exports', icon: Download, color: 'bg-[color:hsl(var(--accent-cool-hsl)/0.1)] text-accent-cool' },
  { key: 'aiRequests', label: 'AI Requests', icon: Brain, color: 'bg-primary/10 text-accent-cool' },
  { key: 'totalUploads', label: 'Uploads', icon: Upload, color: 'bg-primary/10 text-accent-rose' },
  { key: 'conversionRate', label: 'Subscriptions / users', icon: TrendingUp, color: 'bg-primary/10 text-accent-rose', format: (v) => `${v}%` },
];

export const AdminKPICards: React.FC<AdminKPICardsProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <Card key={i} className="rounded-xl animate-pulse">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-16 bg-muted rounded" />
                  <div className="h-5 w-12 bg-muted rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpiConfig.filter(kpi => data[kpi.key] !== undefined).map((kpi, index) => {
        const Icon = kpi.icon;
        const rawValue = data[kpi.key];
        const displayValue = kpi.format ? kpi.format(rawValue) : rawValue;

        return (
          <motion.div
            key={kpi.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${kpi.color}`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                    <p className="text-lg sm:text-xl font-bold truncate">{displayValue}</p>
                    {kpi.subLabel && (
                      <p className="text-[10px] text-muted-foreground">{kpi.subLabel}</p>
                    )}
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
