'use client';

import { useState, useEffect } from 'react';

interface ProjectOption {
  id: string;
  name: string;
}

const REPORT_TYPES = [
  { value: 'full_compliance', label: 'Full Compliance Report' },
  { value: 'executive_summary', label: 'Executive Summary' },
  { value: 'technical_findings', label: 'Technical Findings Only' },
  { value: 'remediation_plan', label: 'Remediation Plan' },
];

const TIME_PERIODS = [
  { value: 'latest', label: 'Last scan only' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const SECTIONS = [
  'Executive Summary',
  'Compliance Score & Trends',
  'Critical Findings',
  'All Violations',
  'Remediation Recommendations',
  'Historical Data',
];

export default function ReportsPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [reportType, setReportType] = useState('full_compliance');
  const [timePeriod, setTimePeriod] = useState('latest');
  const [sections, setSections] = useState<string[]>([...SECTIONS]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        const list = (data.projects ?? data ?? []).map((p: any) => ({ id: p.id, name: p.name }));
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0].id);
      })
      .catch(() => {});
  }, []);

  function toggleSection(section: string) {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  }

  async function handleGenerate() {
    if (!selectedProject) {
      setError('Please select a project');
      return;
    }
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject,
          report_type: reportType,
          time_period: timePeriod,
          sections,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to generate report');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      a.download = filenameMatch?.[1] || 'vlayer-report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A]">
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
                  <label className="block text-sm font-medium text-slate-300 mb-2">Project</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                  >
                    {projects.length === 0 && <option value="">No projects found</option>}
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                  >
                    {REPORT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Time Period</label>
                  <select
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                  >
                    {TIME_PERIODS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Include Sections</label>
                  <div className="space-y-3">
                    {SECTIONS.map((section) => (
                      <label key={section} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sections.includes(section)}
                          onChange={() => toggleSection(section)}
                          className="w-5 h-5 bg-slate-900 border-slate-700 rounded text-emerald-500 focus:ring-emerald-500/20"
                        />
                        <span className="text-slate-300">{section}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generating || !selectedProject}
                  className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Generate PDF Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pro Tip */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-400 mb-2">Best Practice</h4>
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
                <div>
                  <div className="font-medium text-slate-300">Remediation Plan</div>
                  <div className="text-slate-400">Prioritized fix recommendations</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
