import Link from 'next/link';
import { getProjects, getRecentScans, getCriticalFindings } from '@/lib/storage';
import { hasSampleData } from '@/lib/demo-data';
import { CircularProgress } from '@/components/CircularProgress';
import { StatusBadge } from '@/components/StatusBadge';
import { SuccessToast } from '@/components/SuccessToast';
import { LoadSampleDataButton, ClearSampleDataButton } from '@/components/SampleDataButtons';

export const dynamic = 'force-dynamic';

function cleanFilePath(p: string | null): string | null {
  return p?.replace(/\/tmp\/vlayer-scan-[^/]+\/[^/]+\//, '') ?? null;
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  if (score > 0) return 'text-red-400';
  return 'text-slate-400';
}

export default async function HomePage() {
  const [projects, recentScans, criticalFindings, showClearButton] = await Promise.all([
    getProjects(),
    getRecentScans(5),
    getCriticalFindings(5),
    hasSampleData(),
  ]);

  // Calculate summary stats
  const scannedProjects = projects.filter((p) => p.lastScanAt);
  const avgScore =
    scannedProjects.length > 0
      ? Math.round(
          scannedProjects.reduce((sum, p) => sum + p.complianceScore, 0) /
            scannedProjects.length
        )
      : 0;

  const totalCriticalIssues = projects.reduce(
    (sum, p) => sum + (p.findingsSummary.critical ?? 0) + (p.findingsSummary.high ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <SuccessToast />
      {/* Header */}
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Compliance Overview</h1>
              <p className="text-slate-400 mt-1">Monitor HIPAA compliance across all projects</p>
            </div>
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20"
            >
              + New Project
            </Link>
          </div>
        </div>
      </header>

      <div className="px-8 py-8">
        {projects.length > 0 && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Average Score Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-400 text-sm font-medium">Average Score</div>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-bold ${scoreColor(avgScore)}`}>{avgScore}</span>
                  <span className="text-slate-400">/100</span>
                </div>
                <div className="mt-2">
                  <StatusBadge
                    status={avgScore >= 90 ? 'compliant' : avgScore >= 70 ? 'at_risk' : avgScore > 0 ? 'critical' : 'pending'}
                    size="sm"
                  />
                </div>
              </div>

              {/* Total Projects */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-400 text-sm font-medium">Total Projects</div>
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="text-4xl font-bold text-white">{projects.length}</div>
                <div className="mt-2 text-sm text-slate-400">{scannedProjects.length} scanned</div>
              </div>

              {/* Total Findings */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-400 text-sm font-medium">Total Findings</div>
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="text-4xl font-bold text-white">
                  {projects.reduce((sum, p) => sum + (p.findingsSummary.total ?? 0), 0)}
                </div>
                <div className="mt-2 text-sm text-slate-400">Across all projects</div>
              </div>

              {/* Critical Issues */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-400 text-sm font-medium">Critical Issues</div>
                  <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className={`text-4xl font-bold ${totalCriticalIssues > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {totalCriticalIssues}
                </div>
                <div className="mt-2 text-sm text-slate-400">Critical + High severity</div>
              </div>
            </div>

            {/* Compliance Scores + Recent Scans + Critical Findings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Compliance Scores Bar Chart */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Compliance Scores</h3>
                {scannedProjects.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">No scanned projects yet.</p>
                ) : (
                  <div className="space-y-3">
                    {scannedProjects.slice(0, 8).map((project) => {
                      const score = project.complianceScore;
                      const barColor =
                        score >= 90 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={project.id}>
                          <div className="flex items-center justify-between mb-1">
                            <Link href={`/projects/${project.id}`} className="text-sm text-slate-300 hover:text-emerald-400 transition-colors truncate max-w-[60%]">
                              {project.name}
                            </Link>
                            <span className={`text-sm font-semibold ${scoreColor(score)}`}>{score}</span>
                          </div>
                          <div className="w-full bg-slate-700/50 rounded-full h-2">
                            <div
                              className={`${barColor} h-2 rounded-full transition-all duration-500`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Scans */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Scans</h3>
                {recentScans.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">No scans yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentScans.map((scan) => {
                      const score = scan.score ?? 0;
                      return (
                        <div key={scan.id} className="flex items-center justify-between bg-slate-800/30 border border-slate-700 rounded-lg p-3 hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`text-xl font-bold ${scoreColor(score)} shrink-0`}>{score}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">{scan.projectName}</div>
                              <div className="text-xs text-slate-400">
                                {new Date(scan.createdAt).toLocaleDateString()} &middot; {scan.totalFindings} findings
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 shrink-0">{scan.filesScanned} files</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top Critical Findings */}
            {criticalFindings.length > 0 && (
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden mb-8">
                <div className="px-6 py-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white">Top Critical Findings</h3>
                  <p className="text-sm text-slate-400 mt-1">Most urgent issues across all projects</p>
                </div>
                <div className="p-6 space-y-3">
                  {criticalFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${
                                finding.severity === 'critical' ? 'bg-red-500/20 border border-red-500/30' : 'bg-orange-500/20 border border-orange-500/30'
                              }`}
                            >
                              {finding.severity.toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-400">{finding.projectName}</span>
                          </div>
                          <h4 className="font-medium text-white text-sm">{finding.title}</h4>
                          {finding.filePath && (
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {cleanFilePath(finding.filePath)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Projects Table */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Projects</h2>
              <p className="text-sm text-slate-400 mt-1">Monitor compliance status across all projects</p>
            </div>
            {showClearButton && <ClearSampleDataButton />}
          </div>

          {projects.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
              <p className="text-slate-400 mb-6">Get started by creating your first project.</p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/projects/new"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20"
                >
                  Create Project
                </Link>
                <LoadSampleDataButton />
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Findings</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Scan</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/projects/${project.id}`} className="font-medium text-white hover:text-emerald-400 transition-colors">
                              {project.name}
                            </Link>
                            {project.isSample && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-400 rounded border border-slate-600">
                                Sample
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <div className="text-sm text-slate-400 mt-1">{project.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-6 py-4">
                        {project.complianceScore > 0 ? (
                          <div className="flex items-center gap-3">
                            <CircularProgress score={project.complianceScore} size={50} strokeWidth={6} showLabel={false} />
                            <div>
                              <div className="text-lg font-bold text-white">{project.complianceScore}</div>
                              <div className="text-xs text-slate-400">Grade {project.grade}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">&mdash;</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {project.findingsSummary.total ? (
                          <div className="flex items-center gap-3">
                            {(project.findingsSummary.critical ?? 0) > 0 && (
                              <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded border border-red-500/20">
                                {project.findingsSummary.critical} Critical
                              </span>
                            )}
                            {(project.findingsSummary.high ?? 0) > 0 && (
                              <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs font-semibold rounded border border-orange-500/20">
                                {project.findingsSummary.high} High
                              </span>
                            )}
                            {(project.findingsSummary.critical ?? 0) === 0 && (project.findingsSummary.high ?? 0) === 0 && (
                              <span className="text-sm text-emerald-400">No critical issues</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">&mdash;</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {project.lastScanAt ? (
                          <div className="text-sm text-slate-300">
                            {new Date(project.lastScanAt).toLocaleDateString()}
                            <div className="text-xs text-slate-500">
                              {new Date(project.lastScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-emerald-400 hover:text-emerald-300 font-medium text-sm transition-colors"
                        >
                          View Details &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
