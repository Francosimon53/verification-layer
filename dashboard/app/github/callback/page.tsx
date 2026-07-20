import Link from 'next/link';

export default function GitHubCallbackPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">VLayer Installed Successfully!</h1>
          <p className="text-slate-400 mb-6">
            Your GitHub App is connected. We&apos;re setting up compliance scanning for your repositories.
          </p>
          <p className="text-sm text-slate-500 mb-8">
            Check your repositories for an onboarding PR from VLayer. Merge it to start automated HIPAA compliance scanning on every pull request.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
