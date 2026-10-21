import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Eye, UserPlus, FileText, Download, Crown, 
  ArrowRight, TrendingDown
} from 'lucide-react';

interface FunnelStep {
  name: string;
  icon: React.ElementType;
  count: number;
  color: string;
}

interface AdminUserFunnelProps {
  data: {
    visits: number;
    signups: number;
    firstPage: number;
    firstExport: number;
    premium: number;
  };
  loading?: boolean;
}

export const AdminUserFunnel: React.FC<AdminUserFunnelProps> = ({ data, loading }) => {
  const steps: FunnelStep[] = [
    { name: 'Visit', icon: Eye, count: data.visits, color: 'bg-blue-500' },
    { name: 'Signup', icon: UserPlus, count: data.signups, color: 'bg-green-500' },
    { name: 'First Page', icon: FileText, count: data.firstPage, color: 'bg-indigo-500' },
    { name: 'First Export', icon: Download, count: data.firstExport, color: 'bg-purple-500' },
    { name: 'Premium', icon: Crown, count: data.premium, color: 'bg-amber-500' },
  ];

  const calculateDropoff = (current: number, previous: number): string => {
    if (previous === 0) return '0%';
    const dropoff = ((previous - current) / previous) * 100;
    return `-${dropoff.toFixed(1)}%`;
  };

  const calculateConversion = (current: number, previous: number): string => {
    if (previous === 0) return '0%';
    const conversion = (current / previous) * 100;
    return `${conversion.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const hasData = steps.some(step => step.count > 0);

  if (!hasData) {
    return (
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            User Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No funnel data yet. Instrumentation writes to <code>activity_logs</code>; until rows
            exist every stage stays at zero — nothing here is estimated.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-primary" />
          User Conversion Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop Horizontal Funnel */}
        <div className="hidden md:flex items-center justify-between gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const maxCount = steps[0].count || 1;
            const widthPercent = (step.count / maxCount) * 100;
            const previousStep = index > 0 ? steps[index - 1] : null;

            return (
              <React.Fragment key={step.name}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex-1 relative"
                >
                  <div 
                    className={`${step.color} rounded-xl p-4 text-white relative overflow-hidden`}
                    style={{ 
                      opacity: 0.5 + (widthPercent / 200),
                    }}
                  >
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{step.name}</span>
                      </div>
                      <p className="text-2xl font-bold">{step.count.toLocaleString()}</p>
                      {previousStep && (
                        <p className="text-xs opacity-80 mt-1">
                          {calculateConversion(step.count, previousStep.count)} of prev
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
                {index < steps.length - 1 && (
                  <div className="flex flex-col items-center">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs text-destructive font-medium">
                      {calculateDropoff(steps[index + 1].count, step.count)}
                    </span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile Vertical Funnel */}
        <div className="md:hidden space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const maxCount = steps[0].count || 1;
            const widthPercent = (step.count / maxCount) * 100;
            const previousStep = index > 0 ? steps[index - 1] : null;

            return (
              <motion.div
                key={step.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className={`${step.color} rounded-lg p-3 text-white flex-shrink-0`}
                    style={{ opacity: 0.5 + (widthPercent / 200) }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{step.name}</span>
                      <span className="text-lg font-bold">{step.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 mt-1">
                      <motion.div
                        className={`${step.color} h-2 rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPercent}%` }}
                        transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
                      />
                    </div>
                    {previousStep && (
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span className="text-destructive">
                          {calculateDropoff(step.count, previousStep.count)} dropoff
                        </span>
                        <span className="text-green-500">
                          {calculateConversion(step.count, previousStep.count)} conversion
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
