'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scanPhase, setScanPhase] = useState('');
  const [error, setError] = useState('');

  function isValidGitHubUrl(url: string) {
    return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const repoUrl = (formData.get('repo_url') as string).trim();

    if (!isValidGitHubUrl(repoUrl)) {
      setError('Please enter a valid GitHub repository URL (https://github.com/...)');
      setLoading(false);
      return;
    }

    const data = {
      name: formData.get('name') as string,
      repo_url: repoUrl,
      description: formData.get('description') as string,
    };

    try {
      // 1. Create project
      setScanPhase('Creating project...');
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create project');
      }
      const { project } = await createRes.json();

      // 2. Trigger scan
      setScanPhase('Cloning repository and running compliance scan...');
      const scanRes = await fetch(`/api/projects/${project.id}/scan`, { method: 'POST' });
      if (!scanRes.ok) {
        // Scan failed but project was created - redirect anyway
        console.error('Initial scan failed');
      }

      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setLoading(false);
      setScanPhase('');
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="px-8 py-6">
          <Link href="/projects" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium mb-3 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Projects
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">Create New Project</h1>
          <p className="text-slate-400 mt-1">Add a GitHub repository to monitor HIPAA compliance</p>
        </div>
      </header>

      <div className="px-8 py-8 max-w-3xl">
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Project Information</h2>
            <p className="text-sm text-slate-400 mt-1">Enter the details for your new project</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors disabled:opacity-50"
                placeholder="My Healthcare App"
              />
            </div>

            <div>
              <label htmlFor="repo_url" className="block text-sm font-medium text-slate-300 mb-2">
                GitHub Repository URL *
              </label>
              <input
                type="url"
                id="repo_url"
                name="repo_url"
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm transition-colors disabled:opacity-50"
                placeholder="https://github.com/username/repository"
              />
              <p className="text-xs text-slate-500 mt-1.5">Public GitHub repository URL</p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                disabled={loading}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none disabled:opacity-50"
                placeholder="Brief description of the project..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {scanPhase}
                  </span>
                ) : (
                  'Create Project & Scan'
                )}
              </button>
              {!loading && (
                <Link href="/projects" className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-center transition-colors">
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
