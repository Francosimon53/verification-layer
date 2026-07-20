import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[#0A1628] border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-white font-semibold">VLayer</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              HIPAA compliance scanning for healthcare developers.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/projects" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Dashboard</Link></li>
              <li><Link href="/pricing" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Pricing</Link></li>
              <li><Link href="/reports" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Reports</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/legal/terms" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Terms of Service</Link></li>
              <li><Link href="/legal/privacy" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Support</h4>
            <ul className="space-y-2">
              <li><a href="mailto:support@vlayer.app" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">Contact</a></li>
              <li><a href="https://github.com/Francosimon53/verification-layer" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">GitHub</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} VLayer Inc. All rights reserved.
          </p>
          <p className="text-xs text-slate-600">
            VLayer is a developer tool, not a legal compliance service.
          </p>
        </div>
      </div>
    </footer>
  );
}
