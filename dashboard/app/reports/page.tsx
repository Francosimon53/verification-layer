import Link from 'next/link';
import { getProjects } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const projects = await getProjects();

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Compliance Reports</h1>
            <p className="text-slate-400 mt-1">Generate and download HIPAA compliance reports for auditors</p>
          </div>
        </div>
      </header>

      <div className="px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generate Report Card */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 border border-slate-700 shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-6">Generate New Report</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Report Type</label>
                  <select className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors">
                    <option>Full Compliance Report</option>
                    <option>Executive Summary</option>
                    <option>Technical Findings Only</option>
                    <option>Remediation Plan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Project</label>
                  <select className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors">
                    <option>All Projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Time Period</label>
                  <select className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors">
                    <option>Last scan only</option>
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                    <option>Last 90 days</option>
                    <option>All time</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Include Sections</label>
                  <div className="space-y-3">
                    {[
                      'Executive Summary',
                      'Compliance Score & Trends',
                      'Critical Findings',
                      'All Violations',
                      'Remediation Recommendations',
                      'Historical Data',
                    ].map((section) => (
                      <label key={section} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-5 h-5 bg-slate-900 border-slate-700 rounded text-emerald-500 focus:ring-emerald-500/20"
                        />
                        <span className="text-slate-300">{section}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20">
                  Generate PDF Report
                </button>
              </div>
            </div>
          </div>

          {/* Recent Reports & Info */}
          <div className="space-y-6">
            {/* Recent Reports */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Reports</h3>
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">No reports generated yet</p>
              </div>
            </div>

            {/* Pro Tip */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-400 mb-2">💡 Best Practice</h4>
                  <p className="text-sm text-emerald-200/80">
                    Generate monthly reports for internal audits and quarterly executive summaries to maintain compliance documentation.
                  </p>
                </div>
              </div>
            </div>

            {/* Report Types Info */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
              <h4 className="font-semibold text-white mb-4">Report Types</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium text-slate-300">Full Compliance</div>
                  <div className="text-slate-400">Complete audit trail with all findings</div>
                </div>
                <div>
                  <div className="font-medium text-slate-300">Executive Summary</div>
                  <div className="text-slate-400">High-level overview for stakeholders</div>
                </div>
                <div>
                  <div className="font-medium text-slate-300">Technical Findings</div>
                  <div className="text-slate-400">Detailed violations for developers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
