import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/storage';
import { CircularProgress } from '@/components/CircularProgress';
import { FindingsBreakdown } from '@/components/FindingsBreakdown';
import { ScoreHistory } from '@/components/ScoreHistory';
import { StatusBadge } from '@/components/StatusBadge';

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
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="px-8 py-6">
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium mb-3 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="mt-2">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            {project.description && <p className="text-slate-400 mt-1">{project.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {project.path}
              </span>
              <span>•</span>
              <span>{project.scans.length} scans</span>
              {project.lastScanAt && (
                <>
                  <span>•</span>
                  <span>Last scan: {new Date(project.lastScanAt).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="px-8 py-8">
        {!latestScan ? (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-12 text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No scans yet</h3>
            <p className="text-slate-400 mb-6">Run a scan using the VLayer CLI to see compliance data here.</p>
            <div className="bg-slate-800/50 rounded-lg p-6 max-w-2xl mx-auto border border-slate-700">
              <code className="text-sm text-emerald-400 block mb-3">
                vlayer scan {project.path} --format json --output scan.json
              </code>
              <p className="text-xs text-slate-500">
                Then upload the scan.json to this project via the API
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Latest Score - Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Score Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Compliance Score</h2>
                  <StatusBadge status={latestScan.complianceScore.status} />
                </div>

                <div className="flex justify-center py-6">
                  <CircularProgress score={latestScan.complianceScore.score} size={180} strokeWidth={14} />
                </div>

                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-white">Grade {latestScan.complianceScore.grade}</div>
                  <div className="text-sm text-slate-400 capitalize mt-1">{latestScan.complianceScore.status} Status</div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-400">Total Findings</span>
                    <span className="text-lg font-bold text-white">{latestScan.summary.total}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-400">Files Scanned</span>
                    <span className="text-lg font-bold text-white">{latestScan.scannedFiles}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-400">Scan Duration</span>
                    <span className="text-lg font-bold text-white">{latestScan.scanDuration}ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Details - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Findings Breakdown */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-6">
                <FindingsBreakdown score={latestScan.complianceScore} />
              </div>

              {/* Recommendations */}
              {latestScan.complianceScore.recommendations.length > 0 && (
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <span>Recommendations</span>
                  </h3>
                  <ul className="space-y-2">
                    {latestScan.complianceScore.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-slate-200 flex gap-3 items-start">
                        <span className="text-amber-400 font-bold mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Score History */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-6">
                <ScoreHistory scans={project.scans} />
              </div>

              {/* Critical & High Findings */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white">Critical & High Severity Findings</h3>
                  <p className="text-sm text-slate-400 mt-1">Issues requiring immediate attention</p>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {latestScan.findings
                      .filter((f) => f.severity === 'critical' || f.severity === 'high')
                      .slice(0, 10)
                      .map((finding) => (
                        <div
                          key={finding.id}
                          className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-emerald-500/30 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold text-white ${
                                    finding.severity === 'critical' ? 'bg-red-500/20 border border-red-500/30' : 'bg-orange-500/20 border border-orange-500/30'
                                  }`}
                                >
                                  {finding.severity.toUpperCase()}
                                </span>
                                <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                                  {finding.category}
                                </span>
                              </div>
                              <h4 className="font-medium text-white mb-2">{finding.title}</h4>
                              <p className="text-sm text-slate-400 mb-3">{finding.description}</p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {finding.file}
                                </span>
                                {finding.line && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                    </svg>
                                    Line {finding.line}
                                  </span>
                                )}
                                {finding.hipaaReference && (
                                  <span className="text-emerald-400">§ {finding.hipaaReference}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    {latestScan.findings.filter((f) => f.severity === 'critical' || f.severity === 'high')
                      .length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-slate-400 text-sm">No critical or high severity findings. Great job! 🎉</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
