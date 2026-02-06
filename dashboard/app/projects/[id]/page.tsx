import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/storage';
import { ComplianceGauge } from '@/components/ComplianceGauge';
import { FindingsBreakdown } from '@/components/FindingsBreakdown';
import { ScoreHistory } from '@/components/ScoreHistory';

export const dynamic = 'force-dynamic';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const latestScan = project.scans[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 mb-2 inline-block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              {project.description && <p className="text-gray-600 mt-1">{project.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>📂 {project.path}</span>
                <span>• {project.scans.length} total scans</span>
                {project.lastScanAt && (
                  <span>• Last scan: {new Date(project.lastScanAt).toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!latestScan ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No scans yet</h3>
            <p className="text-gray-600 mb-4">
              Run a scan using the VLayer CLI to see compliance data here.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 max-w-2xl mx-auto">
              <code className="text-sm text-gray-800">
                vlayer scan {project.path} --format json --output scan.json
              </code>
              <p className="text-xs text-gray-500 mt-2">
                Then upload the scan.json to this project via the API
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Latest Score */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6 sticky top-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Latest Score</h2>
                <ComplianceGauge score={latestScan.complianceScore} size="md" />

                <div className="mt-6 space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">Total Findings</div>
                    <div className="text-2xl font-bold text-gray-900">{latestScan.summary.total}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">Files Scanned</div>
                    <div className="text-2xl font-bold text-gray-900">{latestScan.scannedFiles}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600">Scan Duration</div>
                    <div className="text-2xl font-bold text-gray-900">{latestScan.scanDuration}ms</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Findings Breakdown */}
              <div className="bg-white rounded-lg shadow p-6">
                <FindingsBreakdown score={latestScan.complianceScore} />
              </div>

              {/* Recommendations */}
              {latestScan.complianceScore.recommendations.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>💡</span>
                    <span>Recommendations</span>
                  </h3>
                  <ul className="space-y-2">
                    {latestScan.complianceScore.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-800 flex gap-2">
                        <span className="text-yellow-600 font-bold">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Score History */}
              <div className="bg-white rounded-lg shadow p-6">
                <ScoreHistory scans={project.scans} />
              </div>

              {/* Top Findings */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Critical & High Findings</h3>
                <div className="space-y-2">
                  {latestScan.findings
                    .filter((f) => f.severity === 'critical' || f.severity === 'high')
                    .slice(0, 10)
                    .map((finding) => (
                      <div
                        key={finding.id}
                        className="border border-gray-200 rounded-lg p-3 hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${
                                  finding.severity === 'critical' ? 'bg-red-600' : 'bg-orange-600'
                                }`}
                              >
                                {finding.severity}
                              </span>
                              <span className="text-xs text-gray-500">{finding.category}</span>
                            </div>
                            <h4 className="font-medium text-gray-900">{finding.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{finding.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span>📄 {finding.file}</span>
                              {finding.line && <span>Line {finding.line}</span>}
                              {finding.hipaaReference && (
                                <span className="text-indigo-600">{finding.hipaaReference}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {latestScan.findings.filter((f) => f.severity === 'critical' || f.severity === 'high')
                    .length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No critical or high severity findings. Great job! 🎉
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
