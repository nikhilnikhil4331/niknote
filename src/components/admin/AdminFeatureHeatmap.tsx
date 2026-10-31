import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, TrendingUp, Clock, Zap } from 'lucide-react';

interface FeatureUsage {
  name: string;
  count: number;
  percentage: number;
}

interface PeakHour {
  hour: number;
  count: number;
}

interface AdminFeatureHeatmapProps {
  features: FeatureUsage[];
  peakHours: PeakHour[];
  topExporters: { name: string; exports: number }[];
  commonMoods: { mood: string; count: number }[];
  avgSessionDuration: string;
  loading?: boolean;
}

export const AdminFeatureHeatmap: React.FC<AdminFeatureHeatmapProps> = ({
  features,
  peakHours,
  topExporters,
  commonMoods,
  avgSessionDuration,
  loading,
}) => {
  const maxFeatureCount = Math.max(...features.map(f => f.count), 1);
  const maxHourCount = Math.max(...peakHours.map(h => h.count), 1);

  const getHeatColor = (percentage: number): string => {
    if (percentage > 75) return 'bg-error';
    if (percentage > 50) return 'bg-nk-warm-600';
    if (percentage > 25) return 'bg-nk-warm-600';
    return 'bg-success';
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-xl animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-6 w-32 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[200px] bg-muted/50 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Most Used Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Flame className="w-4 h-4 text-accent-warm" />
              Most Used Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {features.slice(0, 8).map((feature, index) => {
              const widthPercent = (feature.count / maxFeatureCount) * 100;
              return (
                <motion.div
                  key={feature.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{feature.name}</span>
                    <span className="font-medium">{feature.count}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${getHeatColor(widthPercent)} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPercent}%` }}
                      transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Peak Usage Hours */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-cool" />
              Peak Usage Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-1">
              {peakHours.map((hour, index) => {
                const intensity = hour.count / maxHourCount;
                const bgColor = intensity > 0.75 ? 'bg-error' 
                  : intensity > 0.5 ? 'bg-nk-warm-600'
                  : intensity > 0.25 ? 'bg-nk-warm-600'
                  : intensity > 0 ? 'bg-success/50'
                  : 'bg-secondary';
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={`aspect-square rounded-lg ${bgColor} flex items-center justify-center text-xs font-medium ${intensity > 0.5 ? 'text-white' : ''}`}
                    title={`${formatHour(hour.hour)}: ${hour.count} activities`}
                  >
                    {hour.hour}
                  </motion.div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>Low activity</span>
              <div className="flex gap-1">
                <div className="w-4 h-2 rounded bg-secondary" />
                <div className="w-4 h-2 rounded bg-success/50" />
                <div className="w-4 h-2 rounded bg-nk-warm-600" />
                <div className="w-4 h-2 rounded bg-nk-warm-600" />
                <div className="w-4 h-2 rounded bg-error" />
              </div>
              <span>High activity</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Exporters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-cool" />
              Top Exporting Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topExporters.slice(0, 5).map((user, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-nk-warm-600 text-white' : 
                      index === 1 ? 'bg-muted text-white' : 
                      index === 2 ? 'bg-nk-warm-600 text-white' : 
                      'bg-secondary'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-sm truncate">{user.name}</span>
                  </div>
                  <span className="font-bold text-sm">{user.exports}</span>
                </motion.div>
              ))}
              {topExporters.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No export data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mood & Session Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent-cool" />
              Engagement Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Average Session Duration</p>
              <p className="text-2xl font-bold">{avgSessionDuration}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Common Moods Used</p>
              <div className="flex flex-wrap gap-2">
                {commonMoods.slice(0, 6).map((mood, index) => (
                  <motion.div
                    key={mood.mood}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="px-3 py-1.5 rounded-full bg-primary/10 text-sm"
                  >
                    {mood.mood} ({mood.count})
                  </motion.div>
                ))}
              </div>
              {commonMoods.length === 0 && (
                <p className="text-muted-foreground text-sm">No mood data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
