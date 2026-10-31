// ============================================================
// NikNote 4.0 — QA Dashboard Page
// Access via /qa — runs tests and shows results
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { qaRunner, QACycleResult, QATestResult } from '@/utils/qa/testRunner';
import { Button } from '@/components/ui/button';
import { Check, X, AlertTriangle, SkipForward, Play, RotateCcw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const statusConfig = {
  pass: { icon: <Check className="w-4 h-4" />, color: 'text-success', bg: 'bg-[color:hsl(var(--success)/0.14)]', label: 'PASS' },
  fail: { icon: <X className="w-4 h-4" />, color: 'text-error', bg: 'bg-[color:hsl(var(--error)/0.14)]', label: 'FAIL' },
  warn: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-accent-warm', bg: 'bg-[color:hsl(var(--accent-warm-hsl)/0.16)]', label: 'WARN' },
  skip: { icon: <SkipForward className="w-4 h-4" />, color: 'text-fg-muted/70', bg: 'bg-muted', label: 'SKIP' },
};

export default function QAPage() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [totalCycles, setTotalCycles] = useState(10);
  const [results, setResults] = useState<QACycleResult[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<number | null>(null);

  const runTests = useCallback(async (count: number) => {
    setIsRunning(true);
    setResults([]);
    
    for (let i = 1; i <= count; i++) {
      setCurrentCycle(i);
      const cycleResult = await qaRunner.runCycle(i);
      setResults(prev => [...prev, cycleResult]);
    }
    
    setIsRunning(false);
  }, []);

  const lastResult = results.length > 0 ? results[results.length - 1] : null;
  const selectedResult = selectedCycle !== null ? results.find(r => r.cycleNumber === selectedCycle) : lastResult;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">🧪 NikNote 4.0 QA</h1>
              <p className="text-sm text-muted-foreground">10-12 complete test cycles before release</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runTests(1)}
              disabled={isRunning}
              className="gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Run 1
            </Button>
            <Button
              onClick={() => runTests(totalCycles)}
              disabled={isRunning}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Run {totalCycles}
            </Button>
          </div>
        </div>

        {/* Running indicator */}
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-xl text-center"
          >
            <span className="text-sm font-semibold text-accent-rose">
              🧪 Running Cycle #{currentCycle}...
            </span>
          </motion.div>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-muted-foreground">Cycles</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-success">
                {lastResult?.passed || 0}
              </div>
              <div className="text-xs text-muted-foreground">Passed</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-error">
                {lastResult?.failed || 0}
              </div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-accent-warm">
                {lastResult?.warnings || 0}
              </div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">
                {lastResult ? ((lastResult.passed / lastResult.totalTests) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Pass Rate</div>
            </div>
          </div>
        )}

        {/* Cycle selector */}
        {results.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
            {results.map(r => (
              <button
                key={r.cycleNumber}
                onClick={() => setSelectedCycle(r.cycleNumber)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  (selectedCycle || results.length) === r.cycleNumber
                    ? 'bg-primary text-primary-foreground'
                    : r.failed > 0
                      ? 'bg-[color:hsl(var(--error)/0.14)] text-error border border-[color:hsl(var(--error)/0.4)]'
                      : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                #{r.cycleNumber} {r.failed > 0 ? '❌' : '✅'}
              </button>
            ))}
          </div>
        )}

        {/* Test Results */}
        {selectedResult && (
          <div className="space-y-2">
            {/* Group by category */}
            {Object.entries(
              groupByCategory(selectedResult.results)
            ).map(([category, categoryResults]) => (
              <div key={category} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                  <h3 className="text-sm font-semibold">{category}</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {categoryResults.map((result: QATestResult) => {
                    const config = statusConfig[result.status];
                    return (
                      <div key={result.id} className="px-4 py-2.5 flex items-center gap-3">
                        <div className={`${config.color} ${config.bg} p-1 rounded-md`}>
                          {config.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{result.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {result.message}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {results.length === 0 && !isRunning && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🧪</div>
            <h2 className="text-lg font-bold mb-2">Ready to Test</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Click "Run 10" to start comprehensive QA testing
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function groupByCategory(results: QATestResult[]): Record<string, QATestResult[]> {
  return results.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = [];
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, QATestResult[]>);
}
