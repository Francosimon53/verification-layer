import Link from 'next/link';

export default function GitHubSetupPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="max-w-lg w-full mx-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Setup Complete</h1>
              <p className="text-slate-400 text-sm">VLayer GitHub App is installed</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                <span className="text-emerald-400 text-xs font-bold">1</span>
              </div>
              <div>
                <h3 className="font-medium text-white">App Installed</h3>
                <p className="text-sm text-slate-400">VLayer is now connected to your repositories.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                <span className="text-emerald-400 text-xs font-bold">2</span>
              </div>
              <div>
                <h3 className="font-medium text-white">Onboarding PR Created</h3>
                <p className="text-sm text-slate-400">Check your repos for a PR titled &quot;Enable VLayer HIPAA Compliance Scanning&quot;.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                <span className="text-blue-400 text-xs font-bold">3</span>
              </div>
              <div>
                <h3 className="font-medium text-white">Merge the PR</h3>
                <p className="text-sm text-slate-400">Once merged, every new pull request will be scanned for HIPAA compliance issues.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                <span className="text-slate-400 text-xs font-bold">4</span>
              </div>
              <div>
                <h3 className="font-medium text-white">Monitor on Dashboard</h3>
                <p className="text-sm text-slate-400">View all scan results, compliance scores, and findings on your VLayer dashboard.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 text-center"
            >
              Go to Dashboard
            </Link>
            <a
              href="https://github.com/apps/vlayer-hipaa"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors text-center"
            >
              Manage App
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
