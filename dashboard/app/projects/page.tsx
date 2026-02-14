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
              {projects.map((project) => (
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
                    {project.lastScanAt && (
                      <span className="text-xs text-slate-400">
                        {new Date(project.lastScanAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
