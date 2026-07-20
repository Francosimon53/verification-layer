'use client';

import Link from 'next/link';

export function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-amber-500/30 shadow-xl text-center">
      <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">Pro Feature</h3>
      <p className="text-slate-400 text-sm mb-4">
        {feature} is available on the Pro plan. Upgrade to unlock all features.
      </p>
      <Link
        href="/pricing"
        className="inline-block px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 text-sm"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}
