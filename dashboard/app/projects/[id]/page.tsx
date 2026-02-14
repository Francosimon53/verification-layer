import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProject, getScans, getFindings } from '@/lib/storage';
import { CircularProgress } from '@/components/CircularProgress';
import { FindingsBreakdown } from '@/components/FindingsBreakdown';
import { ScoreHistory } from '@/components/ScoreHistory';
import { StatusBadge } from '@/components/StatusBadge';
import { RescanButton } from '@/components/RescanButton';

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

  const scans = await getScans(id);
  const latestScan = scans[0] ?? null;
  const findings = latestScan ? await getFindings(id, latestScan.id) : [];

  const criticalFindings = findings.filter((f) => f.severity === 'critical' || f.severity === 'high');

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="px-8 py-6">
          <Link href="/projects" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium mb-3 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Projects
          </Link>
          <div className="mt-2 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              {project.description && <p className="text-slate-400 mt-1">{project.description}</p>}
              <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                {project.repoUrl && (
                  <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {project.repoUrl.replace('https://github.com/', '')}
                  </a>
                )}
                <span>·</span>
                <span>{scans.length} scan{scans.length !== 1 ? 's' : ''}</span>
                {project.lastScanAt && (
                  <>
                    <span>·</span>
                    <span>Last scan: {new Date(project.lastScanAt).toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>
            {project.repoUrl && (
              <RescanButton projectId={project.id} />
            )}
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
            <p className="text-slate-400 mb-6">
              {project.status === 'scanning'
                ? 'A scan is currently in progress...'
                : 'Click "Re-scan" to run a HIPAA compliance scan on this repository.'}
            </p>
            {project.status === 'scanning' && (
              <div className="flex items-center justify-center gap-3">
                <svg className="w-6 h-6 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-blue-400">Scanning repository...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Latest Score - Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Score Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Compliance Score</h2>
                  <StatusBadge status={project.status} />
                </div>

                <div className="flex justify-center py-6">
                  <CircularProgress score={project.complianceScore} size={180} strokeWidth={14} />
                </div>

                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-white">Grade {project.grade}</div>
                  <div className="text-sm text-slate-400 capitalize mt-1">{project.status.replace('_', ' ')} Status</div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-400">Total Findings</span>
                    <span className="text-lg font-bold text-white">{latestScan.totalFindings}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-400">Files Scanned</span>
                    <span className="text-lg font-bold text-white">{latestScan.filesScanned}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-400">Scan Duration</span>
                    <span className="text-lg font-bold text-white">{latestScan.scanDurationMs}ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Details - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Findings Breakdown */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-6">
                <FindingsBreakdown summary={project.findingsSummary} />
              </div>

              {/* Score History */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-6">
                <ScoreHistory scans={scans} />
              </div>

              {/* Critical & High Findings */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white">Critical & High Severity Findings</h3>
                  <p className="text-sm text-slate-400 mt-1">Issues requiring immediate attention</p>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {criticalFindings.slice(0, 10).map((finding) => (
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
                            {finding.description && (
                              <p className="text-sm text-slate-400 mb-3">{finding.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              {finding.filePath && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {finding.filePath}
                                </span>
                              )}
                              {finding.lineNumber && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                  </svg>
                                  Line {finding.lineNumber}
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
                    {criticalFindings.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-slate-400 text-sm">No critical or high severity findings.</p>
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
