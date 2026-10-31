import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, Power, Crown, QrCode, 
  Trash2, RefreshCw, Code, Play,
  CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AppSettings {
  premium_enabled: boolean;
  signup_enabled: boolean;
  dev_mode: boolean;
  maintenance_mode: boolean;
  upi_id: string;
  weekly_price: number;
  monthly_price: number;
}

interface SystemCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'pending';
  message?: string;
}

interface AdminControlsProps {
  settings: AppSettings;
  onUpdateSetting: (key: string, value: unknown) => void;
  onClearLogs: () => void;
  onRunSystemCheck: () => Promise<SystemCheckResult[]>;
}

export const AdminControls: React.FC<AdminControlsProps> = ({
  settings,
  onUpdateSetting,
  onClearLogs,
  onRunSystemCheck,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [systemCheckRunning, setSystemCheckRunning] = useState(false);
  const [systemCheckResults, setSystemCheckResults] = useState<SystemCheckResult[]>([]);
  const [showSystemCheck, setShowSystemCheck] = useState(false);

  const handleSystemCheck = async () => {
    setSystemCheckRunning(true);
    setShowSystemCheck(true);
    setSystemCheckResults([
      { name: 'Authentication', status: 'pending' },
      { name: 'Database Connection', status: 'pending' },
      { name: 'Premium System', status: 'pending' },
      { name: 'Export Functions', status: 'pending' },
      { name: 'Payment Gateway', status: 'pending' },
      { name: 'Mobile Layout', status: 'pending' },
    ]);

    try {
      const results = await onRunSystemCheck();
      setSystemCheckResults(results);
    } catch {
      setSystemCheckResults(prev => prev.map(r => ({ ...r, status: 'fail' as const })));
    } finally {
      setSystemCheckRunning(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Feature Toggles */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Power className="w-4 h-4" />
              Feature Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Premium System</Label>
                <p className="text-xs text-muted-foreground">Enable paid subscriptions</p>
              </div>
              <Switch
                checked={settings.premium_enabled}
                onCheckedChange={(v) => onUpdateSetting('premium_enabled', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">User Signups</Label>
                <p className="text-xs text-muted-foreground">Allow new registrations</p>
              </div>
              <Switch
                checked={settings.signup_enabled}
                onCheckedChange={(v) => onUpdateSetting('signup_enabled', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Code className="w-3 h-3" />
                  Dev Mode
                </Label>
                <p className="text-xs text-muted-foreground">Unlock all features for testing</p>
              </div>
              <Switch
                checked={settings.dev_mode}
                onCheckedChange={(v) => onUpdateSetting('dev_mode', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-destructive">Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Disable app for users</p>
              </div>
              <Switch
                checked={settings.maintenance_mode}
                onCheckedChange={(v) => onUpdateSetting('maintenance_mode', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              Payment Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">UPI ID</Label>
              <Input
                value={settings.upi_id}
                onChange={(e) => onUpdateSetting('upi_id', e.target.value)}
                placeholder="yourname@upi"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Weekly Price (₹)</Label>
                <Input
                  type="number"
                  value={settings.weekly_price}
                  onChange={(e) => onUpdateSetting('weekly_price', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Monthly Price (₹)</Label>
                <Input
                  type="number"
                  value={settings.monthly_price}
                  onChange={(e) => onUpdateSetting('monthly_price', parseInt(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Actions */}
        <Card className="rounded-xl lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Settings className="w-4 h-4" />
              System Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Button
                variant="default"
                className="h-auto py-4 flex-col gap-2"
                onClick={handleSystemCheck}
                disabled={systemCheckRunning}
              >
                {systemCheckRunning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span className="text-xs">Run System Check</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-5 h-5" />
                <span className="text-xs">Refresh Dashboard</span>
              </Button>
              
              <Button
                variant="destructive"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 className="w-5 h-5" />
                <span className="text-xs">Clear All Logs</span>
              </Button>
              
              <Button
                variant="secondary"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => window.open('/', '_blank')}
              >
                <Crown className="w-5 h-5" />
                <span className="text-xs">View Live App</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Check Results Dialog */}
      <AlertDialog open={showSystemCheck} onOpenChange={setShowSystemCheck}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>System Health Check</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-4">
                {systemCheckResults.map((result, index) => (
                  <motion.div
                    key={result.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <span className="font-medium">{result.name}</span>
                    {result.status === 'pending' ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : result.status === 'pass' ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-error" />
                    )}
                  </motion.div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Logs Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all activity logs and error logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                onClearLogs();
                setShowClearConfirm(false);
              }}
            >
              Clear All Logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
