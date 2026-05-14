import { RefreshCw, Zap, BarChart3 } from 'lucide-react';
import { mockOptimizationScore } from '../mockData';
import { BurnoutHeatmap } from './BurnoutHeatmap';

export function OptimizationView() {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--status-green)';
    if (score >= 60) return 'var(--status-orange)';
    return 'var(--status-red)';
  };

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Optimization & Analysis</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Perfection score and workload distribution
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg hover:opacity-90 transition-opacity">
              <RefreshCw className="w-4 h-4" />
              Re-optimize
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Perfection Score */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-[var(--accent-purple)]/10 flex items-center justify-center">
              <Zap className="w-6 h-6" style={{ color: 'var(--accent-purple)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Perfection Score</h2>
              <p className="text-sm text-muted-foreground">Overall optimization quality</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-end gap-4">
              <div className="text-6xl font-bold" style={{ color: getScoreColor(mockOptimizationScore.overall) }}>
                {mockOptimizationScore.overall}
              </div>
              <div className="pb-2 text-2xl text-muted-foreground">/100</div>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${mockOptimizationScore.overall}%`,
                  backgroundColor: getScoreColor(mockOptimizationScore.overall),
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Constraints', value: mockOptimizationScore.constraintSatisfaction },
              { label: 'Workload Balance', value: mockOptimizationScore.workloadBalance },
              { label: 'Student', value: mockOptimizationScore.studentSatisfaction },
              { label: 'Faculty', value: mockOptimizationScore.facultySatisfaction },
            ].map((metric) => (
              <div key={metric.label} className="border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-2">{metric.label}</div>
                <div className="flex items-end gap-1">
                  <div className="text-2xl font-semibold">{metric.value}</div>
                  <div className="text-sm text-muted-foreground pb-0.5">%</div>
                </div>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${metric.value}%`,
                      backgroundColor: getScoreColor(metric.value),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Burnout Heatmap */}
        <div className="mb-6">
          <BurnoutHeatmap />
        </div>

        {/* Iteration Comparison */}
        <div className="mt-6 bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Iteration History</h2>
          <div className="space-y-2">
            {[
              { version: 'v3 (Current)', score: 82, date: 'Today, 10:24 AM' },
              { version: 'v2', score: 78, date: 'Yesterday, 3:45 PM' },
              { version: 'v1', score: 71, date: 'Apr 15, 2:20 PM' },
            ].map((iteration, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 border border-border rounded-lg ${
                  index === 0 ? 'bg-[var(--accent-blue)]/5' : ''
                }`}
              >
                <div>
                  <div className="font-medium">{iteration.version}</div>
                  <div className="text-sm text-muted-foreground">{iteration.date}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Score</div>
                    <div className="text-lg font-semibold" style={{ color: getScoreColor(iteration.score) }}>
                      {iteration.score}/100
                    </div>
                  </div>
                  <button className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
                    Load
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

