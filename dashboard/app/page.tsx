import Link from 'next/link';
import { getProjects } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const projects = await getProjects();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">VLayer Dashboard</h1>
              <p className="text-gray-600 mt-1">HIPAA Compliance Monitoring</p>
            </div>
            <Link
              href="/projects/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              + New Project
            </Link>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📁</div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
                <div className="text-sm text-gray-600">Total Projects</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🔍</div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalScans}</div>
                <div className="text-sm text-gray-600">Total Scans</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🎯</div>
              <div>
                <div
                  className={`text-2xl font-bold ${
                    avgScore >= 80 ? 'text-green-600' : avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}
                >
                  {avgScore}/100
                </div>
                <div className="text-sm text-gray-600">Average Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          </div>

          {projects.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-6xl mb-4">📂</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first project.</p>
              <Link
                href="/projects/new"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Create Project
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {projects.map((project) => {
                const lastScan = project.scans[0];
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>📂 {project.path}</span>
                          <span>• {project.scans.length} scans</span>
                          {project.lastScanAt && (
                            <span>
                              • Last scan: {new Date(project.lastScanAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {lastScan && (
                        <div className="ml-6 flex items-center gap-4">
                          <div className="text-right">
                            <div
                              className={`text-2xl font-bold ${
                                lastScan.complianceScore.score >= 80
                                  ? 'text-green-600'
                                  : lastScan.complianceScore.score >= 60
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {lastScan.complianceScore.score}
                            </div>
                            <div className="text-xs text-gray-500">
                              Grade {lastScan.complianceScore.grade}
                            </div>
                          </div>
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
