import Link from 'next/link';
import { getProjects } from '@/lib/storage';
import { hasSampleData } from '@/lib/demo-data';
import { CircularProgress } from '@/components/CircularProgress';
import { StatusBadge } from '@/components/StatusBadge';
import { SuccessToast } from '@/components/SuccessToast';
import { LoadSampleDataButton, ClearSampleDataButton } from '@/components/SampleDataButtons';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const projects = await getProjects();
  const showClearButton = await hasSampleData();

  // Calculate summary stats
  const totalScans = projects.reduce((sum, p) => sum + p.scans.length, 0);
  const projectsWithScans = projects.filter((p) => p.scans.length > 0);
  const avgScore =
    projectsWithScans.length > 0
      ? Math.round(
          projectsWithScans.reduce((sum, p) => sum + (p.scans[0]?.complianceScore.score || 0), 0) /
            projectsWithScans.length
        )
      : 0;

  // Get status distribution
  const compliantCount = projectsWithScans.filter(p => (p.scans[0]?.complianceScore.score || 0) >= 80).length;
  const atRiskCount = projectsWithScans.filter(p => {
    const score = p.scans[0]?.complianceScore.score || 0;
    return score >= 60 && score < 80;
  }).length;
  const criticalCount = projectsWithScans.filter(p => (p.scans[0]?.complianceScore.score || 0) < 60).length;

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
                  <span className="text-4xl font-bold text-white">{avgScore}</span>
                  <span className="text-slate-400">/100</span>
                </div>
                <div className="mt-2">
                  <StatusBadge
                    status={avgScore >= 80 ? 'compliant' : avgScore >= 60 ? 'at-risk' : 'critical'}
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
                <div className="mt-2 text-sm text-slate-400">{projectsWithScans.length} with scans</div>
              </div>

              {/* Total Scans */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-400 text-sm font-medium">Total Scans</div>
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="text-4xl font-bold text-white">{totalScans}</div>
                <div className="mt-2 text-sm text-slate-400">Last 30 days</div>
              </div>

              {/* Status Distribution */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-400 text-sm font-medium">Status</div>
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-400">Compliant</span>
                    <span className="font-semibold text-white">{compliantCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-400">At Risk</span>
                    <span className="font-semibold text-white">{atRiskCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-400">Critical</span>
                    <span className="font-semibold text-white">{criticalCount}</span>
                  </div>
                </div>
              </div>
            </div>
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
                  {projects.map((project) => {
                    const lastScan = project.scans[0];
                    const score = lastScan?.complianceScore.score || 0;
                    const status = score >= 80 ? 'compliant' : score >= 60 ? 'at-risk' : 'critical';

                    return (
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
                          {lastScan ? (
                            <StatusBadge status={status} />
                          ) : (
                            <span className="text-sm text-slate-500">No scans</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {lastScan ? (
                            <div className="flex items-center gap-3">
                              <CircularProgress score={score} size={50} strokeWidth={6} showLabel={false} />
                              <div>
                                <div className="text-lg font-bold text-white">{score}</div>
                                <div className="text-xs text-slate-400">Grade {lastScan.complianceScore.grade}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">&mdash;</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {lastScan ? (
                            <div className="flex items-center gap-3">
                              {lastScan.summary.critical > 0 && (
                                <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded border border-red-500/20">
                                  {lastScan.summary.critical} Critical
                                </span>
                              )}
                              {lastScan.summary.high > 0 && (
                                <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs font-semibold rounded border border-orange-500/20">
                                  {lastScan.summary.high} High
                                </span>
                              )}
                              {lastScan.summary.critical === 0 && lastScan.summary.high === 0 && (
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
