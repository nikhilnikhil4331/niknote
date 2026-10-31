import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Download, Users, Activity, CreditCard, Bug,
  FileText, Calendar, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminCSVExportProps {
  loading?: boolean;
}

type ExportType = 'users' | 'activities' | 'payments' | 'errors';

const exportConfig = [
  { type: 'users' as ExportType, label: 'Users', icon: Users, color: 'bg-[color:hsl(var(--accent-cool-hsl)/0.1)] text-accent-cool' },
  { type: 'activities' as ExportType, label: 'Activity Logs', icon: Activity, color: 'bg-success/10 text-success' },
  { type: 'payments' as ExportType, label: 'Payments', icon: CreditCard, color: 'bg-nk-warm-600/10 text-accent-warm' },
  { type: 'errors' as ExportType, label: 'Error Logs', icon: Bug, color: 'bg-error/10 text-error' },
];

export const AdminCSVExport: React.FC<AdminCSVExportProps> = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportingType, setExportingType] = useState<ExportType | null>(null);

  const convertToCSV = (data: Record<string, unknown>[]): string => {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).includes(',') ? `"${value}"` : String(value);
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async (type: ExportType) => {
    setExportingType(type);
    
    try {
      let query;
      let filename = '';

      switch (type) {
        case 'users':
          query = supabase
            .from('profiles')
            .select('user_id, display_name, created_at, updated_at');
          filename = 'users_export';
          break;
        case 'activities':
          query = supabase
            .from('activity_logs')
            .select('id, user_id, action, category, details, device_type, page_url, created_at');
          filename = 'activity_logs_export';
          break;
        case 'payments':
          query = supabase
            .from('user_subscriptions')
            .select('id, user_id, plan_code, status, current_period_end, created_at');
          filename = 'payments_export';
          break;
        case 'errors':
          query = supabase
            .from('error_logs')
            .select('id, error_type, error_message, component, severity, resolved, device_type, created_at');
          filename = 'error_logs_export';
          break;
      }

      // Apply date filters if set
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        query = query.lt('created_at', endDateObj.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info('No data found for the selected date range');
        return;
      }

      const csv = convertToCSV(data);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadCSV(csv, `${filename}_${dateStr}.csv`);
      toast.success(`Exported ${data.length} records`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExportingType(null);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <FileText className="w-4 h-4" />
          CSV Data Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range Selector */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Start Date
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              End Date
            </Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {/* Export Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {exportConfig.map((config) => {
            const Icon = config.icon;
            const isExporting = exportingType === config.type;

            return (
              <motion.div
                key={config.type}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outline"
                  className={`w-full h-auto py-4 flex-col gap-2 ${config.color} border-transparent hover:border-border`}
                  onClick={() => handleExport(config.type)}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                  <span className="text-xs font-medium">{config.label}</span>
                  <Download className="w-3 h-3 opacity-50" />
                </Button>
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Leave dates empty to export all records
        </p>
      </CardContent>
    </Card>
  );
};
