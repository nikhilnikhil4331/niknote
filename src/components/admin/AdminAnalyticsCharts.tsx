import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Users, Smartphone, Monitor, PieChart } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface ChartData {
  dailyVisitors: { date: string; visitors: number; signups: number }[];
  pageCreations: { date: string; pages: number }[];
  exports: { date: string; exports: number }[];
  payments: { date: string; attempts: number; success: number }[];
  deviceUsage: { name: string; value: number; color: string }[];
  premiumTrend: { date: string; premium: number; free: number }[];
}

interface AdminAnalyticsChartsProps {
  data: ChartData;
  loading?: boolean;
}

type TimeRange = '7d' | '30d' | 'all';

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({ data, loading }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const filterByTimeRange = <T extends { date: string }>(arr: T[]): T[] => {
    if (timeRange === 'all') return arr;
    const days = timeRange === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return arr.filter(item => new Date(item.date) >= cutoff);
  };

  const TimeRangeButtons = () => (
    <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
      {(['7d', '30d', 'all'] as TimeRange[]).map((range) => (
        <Button
          key={range}
          variant={timeRange === range ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setTimeRange(range)}
        >
          {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
        </Button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-xl animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-6 w-32 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[250px] bg-muted/50 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex justify-end">
        <TimeRangeButtons />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Visitors & Signups Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent-rose" />
                Visitors & Signups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filterByTimeRange(data.dailyVisitors)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }} 
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="visitors" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="signups" 
                      stroke="hsl(142 76% 36%)" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Page Creations Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent-cool" />
                Page Creations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filterByTimeRange(data.pageCreations)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="pages" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Exports Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent-cool" />
                PDF Exports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filterByTimeRange(data.exports)}>
                    <defs>
                      <linearGradient id="exportGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(270 75% 60%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(270 75% 60%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="exports" 
                      stroke="hsl(270 75% 60%)" 
                      fill="url(#exportGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Device Usage Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <PieChart className="w-4 h-4 text-accent-cool" />
                Device Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[280px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={data.deviceUsage}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {data.deviceUsage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend 
                      formatter={(value, entry) => {
                        const item = data.deviceUsage.find(d => d.name === value);
                        return (
                          <span className="text-sm flex items-center gap-2">
                            {value === 'Mobile' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                            {value}: {item?.value || 0}
                          </span>
                        );
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </div>
  );
};
