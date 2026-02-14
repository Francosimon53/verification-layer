import Link from 'next/link';
import { getProjects } from '@/lib/storage';
import { hasSampleData } from '@/lib/demo-data';
import { CircularProgress } from '@/components/CircularProgress';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadSampleDataButton, ClearSampleDataButton } from '@/components/SampleDataButtons';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await getProjects();
  const showClearButton = await hasSampleData();

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Projects</h1>
              <p className="text-slate-400 mt-1">Manage and monitor all your HIPAA compliance projects</p>
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
        {projects.length === 0 ? (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-16 text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">No projects yet</h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Add a GitHub repository to scan for HIPAA compliance issues.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/projects/new"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20"
              >
                + New Project
              </Link>
              <LoadSampleDataButton />
            </div>
          </div>
        ) : (
          <>
            {showClearButton && (
              <div className="flex justify-end mb-4">
                <ClearSampleDataButton />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => {
                const criticalCount = project.findingsSummary.critical ?? 0;
                const highCount = project.findingsSummary.high ?? 0;
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 hover:border-emerald-500/50 shadow-xl hover:shadow-emerald-500/10 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                            {project.name}
                          </h3>
                          {project.isSample && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-400 rounded border border-slate-600">
                              Sample
                            </span>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{project.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Finding count badges */}
                    {(criticalCount > 0 || highCount > 0) && (
                      <div className="flex items-center gap-2 mb-4">
                        {criticalCount > 0 && (
                          <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded border border-red-500/20">
                            {criticalCount} Critical
                          </span>
                        )}
                        {highCount > 0 && (
                          <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs font-semibold rounded border border-orange-500/20">
                            {highCount} High
                          </span>
                        )}
                      </div>
                    )}

                    {project.status === 'scanning' ? (
                      <div className="flex items-center gap-3 mb-4 py-4">
                        <svg className="w-8 h-8 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-blue-400 text-sm">Scanning...</span>
                      </div>
                    ) : project.complianceScore > 0 ? (
                      <div className="flex items-center gap-4 mb-4">
                        <CircularProgress score={project.complianceScore} size={60} strokeWidth={6} showLabel={false} />
                        <div>
                          <div className="text-2xl font-bold text-white">{project.complianceScore}</div>
                          <div className="text-xs text-slate-400">Grade {project.grade}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 py-8 text-center">
                        <p className="text-sm text-slate-500">Not scanned yet</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                      <StatusBadge status={project.status} size="sm" />
                      <div className="flex items-center gap-3">
                        {project.lastScanAt && (
                          <span className="text-xs text-slate-400">
                            {new Date(project.lastScanAt).toLocaleDateString()}
                          </span>
                        )}
                        {project.repoUrl && (
                          <a
                            href={project.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-emerald-400 transition-colors"
                            title="Open repository"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
