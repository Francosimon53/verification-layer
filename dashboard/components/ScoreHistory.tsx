'use client';

import type { Scan } from '@/types';

interface ScoreHistoryProps {
  scans: Scan[];
}

export function ScoreHistory({ scans }: ScoreHistoryProps) {
  if (scans.length === 0) {
    return (
      <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg p-8 text-center">
        <p className="text-slate-400">No scan history available yet.</p>
        <p className="text-sm text-slate-500 mt-1">Run a scan to see compliance score trends.</p>
      </div>
    );
  }

  // Get last 10 scans
  const recentScans = scans.slice(0, 10).reverse();

  const maxScore = 100;
  const minScore = 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Compliance Score History</h3>

      {/* Simple bar chart */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
        <div className="h-64 flex items-end justify-between gap-2">
          {recentScans.map((scan) => {
            const score = scan.score ?? 0;
            const height = ((score - minScore) / (maxScore - minScore)) * 100;
            let color = 'bg-red-500';
            let glowColor = 'shadow-red-500/50';
            if (score >= 90) {
              color = 'bg-emerald-500';
              glowColor = 'shadow-emerald-500/50';
            } else if (score >= 80) {
              color = 'bg-green-500';
              glowColor = 'shadow-green-500/50';
            } else if (score >= 70) {
              color = 'bg-amber-500';
              glowColor = 'shadow-amber-500/50';
            } else if (score >= 60) {
              color = 'bg-orange-500';
              glowColor = 'shadow-orange-500/50';
            }

            return (
              <div key={scan.id} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full ${color} ${glowColor} shadow-lg rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer`}
                  style={{ height: `${height}%` }}
                  title={`Score: ${score}`}
                />
                <div className="text-xs text-slate-400 text-center">
                  <div className="font-semibold text-white">{score}</div>
                  <div className="text-slate-500">
                    {new Date(scan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent scans list */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-300">Recent Scans</h4>
        <div className="space-y-2">
          {scans.slice(0, 5).map((scan) => {
            const score = scan.score ?? 0;
            return (
              <div key={scan.id} className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div
                    className={`text-3xl font-bold ${
                      score >= 90
                        ? 'text-emerald-500'
                        : score >= 80
                          ? 'text-green-500'
                          : score >= 70
                            ? 'text-amber-500'
                            : score >= 60
                              ? 'text-orange-500'
                              : 'text-red-500'
                    }`}
                  >
                    {score}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      Grade {scan.grade ?? 'N/A'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(scan.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · {scan.totalFindings} findings
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300">{scan.filesScanned} files</div>
                  <div className="text-xs text-slate-500">{scan.scanDurationMs}ms</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
