import Link from 'next/link';
import { getProjects } from '@/lib/storage';
import { getDemoProjects } from '@/lib/demo-data';
import { CircularProgress } from '@/components/CircularProgress';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const realProjects = await getProjects();
  const demoProjects = getDemoProjects();
  const projects = [...realProjects, ...demoProjects];

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
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
        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-16 text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">No projects yet</h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Get started by creating your first project. Run compliance scans and track HIPAA violations across your codebase.
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20"
            >
              Create Your First Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const lastScan = project.scans[0];
              const score = lastScan?.complianceScore.score || 0;
              const status = score >= 80 ? 'compliant' : score >= 60 ? 'at-risk' : 'critical';

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 hover:border-emerald-500/50 shadow-xl hover:shadow-emerald-500/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                  </div>

                  {lastScan ? (
                    <div className="flex items-center gap-4 mb-4">
                      <CircularProgress score={score} size={60} strokeWidth={6} showLabel={false} />
                      <div>
                        <div className="text-2xl font-bold text-white">{score}</div>
                        <div className="text-xs text-slate-400">Compliance Score</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 py-8 text-center">
                      <p className="text-sm text-slate-500">No scans yet</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                    {lastScan ? (
                      <StatusBadge status={status} size="sm" />
                    ) : (
                      <span className="text-xs text-slate-500">No scans</span>
                    )}
                    {project.lastScanAt && (
                      <span className="text-xs text-slate-400">
                        {new Date(project.lastScanAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
