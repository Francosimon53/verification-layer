import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: {
    default: 'AWS PHI Evidence | vLayer',
    template: '%s | vLayer',
  },
  description: 'Turn observable AWS configuration into reusable evidence for customer security reviews involving PHI workloads.',
};

export default function AwsValidationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      <header className="border-b border-white/10 bg-[#07111f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/aws" className="flex items-center gap-3" aria-label="vLayer AWS evidence home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 12.75l2.25 2.25L15 9.75m5.25-3.12A11.95 11.95 0 0112 3c-3.02 0-5.78 1.12-7.89 2.97A11.98 11.98 0 004.5 15c1.56 3.03 4.1 5.3 7.5 6 3.4-.7 5.94-2.97 7.5-6a11.98 11.98 0 00.75-8.37z" />
              </svg>
            </span>
            <span>
              <span className="block text-base font-semibold tracking-tight">vLayer</span>
              <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-500">AWS evidence</span>
            </span>
          </Link>

          <Link href="/aws/report" className="text-sm font-medium text-slate-400 transition hover:text-white">
            Sample report
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
