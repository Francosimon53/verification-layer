'use client';

import type { ScanReport } from '@/types';

interface ScoreHistoryProps {
  scans: ScanReport[];
}

export function ScoreHistory({ scans }: ScoreHistoryProps) {
  if (scans.length === 0) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-600">No scan history available yet.</p>
        <p className="text-sm text-gray-500 mt-1">Run a scan to see compliance score trends.</p>
      </div>
    );
  }

  // Get last 10 scans
  const recentScans = scans.slice(0, 10).reverse();

  // Calculate max score for scaling
  const maxScore = 100;
  const minScore = 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Compliance Score History</h3>

      {/* Simple line chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="h-64 flex items-end justify-between gap-2">
          {recentScans.map((scan, index) => {
            const score = scan.complianceScore.score;
            const height = ((score - minScore) / (maxScore - minScore)) * 100;
            let color = 'bg-red-500';
            if (score >= 80) color = 'bg-green-500';
            else if (score >= 60) color = 'bg-yellow-500';

            return (
              <div key={scan.id} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full ${color} rounded-t transition-all duration-300`}
                  style={{ height: `${height}%` }}
                  title={`Score: ${score}`}
                />
                <div className="text-xs text-gray-600 text-center">
                  <div className="font-semibold">{score}</div>
                  <div className="text-gray-400">
                    {new Date(scan.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent scans list */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Recent Scans</h4>
        <div className="space-y-2">
          {scans.slice(0, 5).map((scan) => (
            <div key={scan.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`text-2xl font-bold ${
                    scan.complianceScore.score >= 80
                      ? 'text-green-600'
                      : scan.complianceScore.score >= 60
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  {scan.complianceScore.score}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Grade {scan.complianceScore.grade} - {scan.complianceScore.status}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(scan.timestamp).toLocaleString()} · {scan.summary.total} findings
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">{scan.scannedFiles} files</div>
                <div className="text-xs text-gray-400">{scan.scanDuration}ms</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
