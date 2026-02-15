import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - VLayer',
  description: 'VLayer Privacy Policy. Learn about our Zero Trust architecture and how we handle your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium mb-3 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mt-2">Privacy Policy</h1>
          <p className="text-slate-400 mt-1">Last updated: February 14, 2026</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="prose prose-invert prose-slate max-w-none space-y-10">

          {/* Zero Trust Architecture */}
          <section>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-emerald-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Zero Trust Architecture
              </h2>
              <p className="text-slate-300 mt-4 leading-relaxed">
                VLayer is built on a <strong className="text-white">Zero Trust</strong> principle: <strong className="text-white">we
                do NOT store your source code</strong>. All code analysis happens entirely within your own GitHub Actions runner
                environment. Our servers never download, clone, or access your repository contents.
              </p>
              <p className="text-slate-300 mt-3 leading-relaxed">
                After a scan completes, only the results metadata is transmitted to our API via HTTPS. This includes
                finding descriptions, file paths, line numbers, severity levels, and compliance scores. Your actual source
                code never leaves your infrastructure.
              </p>
            </div>
          </section>

          {/* 1. Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">1. Information We Collect</h2>
            <div className="mt-4 space-y-6">

              <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <h3 className="text-base font-semibold text-white mb-2">Account Information</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  When you create an account, we collect your email address through Supabase Auth. This is used for
                  authentication, account recovery, and essential service communications (security alerts, billing
                  notifications).
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <h3 className="text-base font-semibold text-white mb-2">Payment Information</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Payment processing is handled entirely by Stripe, Inc. We do not store credit card numbers, CVVs, or
                  full payment credentials on our servers. We receive from Stripe only: a customer ID, subscription status,
                  plan type, and billing dates. See{' '}
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">
                    Stripe&apos;s Privacy Policy
                  </a>{' '}
                  for details on how they handle your payment data.
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <h3 className="text-base font-semibold text-white mb-2">Scan Metadata</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  When your GitHub Actions workflow sends scan results to our API, we receive and store:
                </p>
                <ul className="list-disc list-inside text-slate-300 text-sm mt-2 space-y-1 pl-2">
                  <li>Compliance score and grade</li>
                  <li>Number and severity of findings</li>
                  <li>Finding titles, descriptions, and categories</li>
                  <li>File paths and line numbers (relative paths only)</li>
                  <li>HIPAA regulation references</li>
                  <li>Repository name and PR metadata</li>
                  <li>Scan duration and files scanned count</li>
                </ul>
                <p className="text-slate-300 text-sm mt-3">
                  <strong className="text-white">We do NOT receive:</strong> source code, file contents, environment
                  variables, secrets, credentials, or any Protected Health Information (PHI).
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <h3 className="text-base font-semibold text-white mb-2">GitHub App Data</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  When you install the VLayer GitHub App, we receive your GitHub account login, installation ID, and the
                  list of repositories you grant access to. We use this to manage your integration and deliver scan results
                  as PR comments and Check Runs.
                </p>
              </div>

            </div>
          </section>

          {/* 2. How We Use Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">2. How We Use Your Information</h2>
            <div className="text-slate-300 mt-4 space-y-3 leading-relaxed">
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Authenticate your identity and manage your account</li>
                <li>Display compliance dashboards, reports, and scan history</li>
                <li>Post scan results as comments and Check Runs on your GitHub PRs</li>
                <li>Process subscription payments and manage billing</li>
                <li>Send essential service notifications (security alerts, billing issues)</li>
                <li>Improve the accuracy and performance of our scanning engine</li>
              </ul>
            </div>
          </section>

          {/* 3. Data Sharing */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">3. Data Sharing</h2>
            <div className="text-slate-300 mt-4 space-y-3 leading-relaxed">
              <p>
                <strong className="text-white">We do not sell, rent, or trade your personal information to third parties.</strong>
              </p>
              <p>We share data only with the following service providers, strictly as needed to operate the Service:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li><strong className="text-white">Supabase</strong> &mdash; database hosting and authentication</li>
                <li><strong className="text-white">Stripe</strong> &mdash; payment processing</li>
                <li><strong className="text-white">Vercel</strong> &mdash; application hosting and serverless functions</li>
                <li><strong className="text-white">GitHub</strong> &mdash; PR comments, Check Runs, and App integration</li>
              </ul>
              <p>
                We may disclose information if required by law, court order, or governmental authority, or if necessary
                to protect the rights, property, or safety of VLayer, our users, or the public.
              </p>
            </div>
          </section>

          {/* 4. Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">4. Data Retention</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              We retain scan metadata and account information for as long as your account is active. When you delete your
              account or a project, associated scan data and findings are permanently deleted from our database. Payment
              records are retained as required by applicable tax and financial regulations.
            </p>
          </section>

          {/* 5. Security */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">5. Security</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              We implement industry-standard security measures to protect your data, including encryption in transit
              (TLS/HTTPS), encrypted database connections, Row-Level Security (RLS) policies, and hashed API keys.
              However, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute
              security.
            </p>
          </section>

          {/* 6. Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">6. Your Rights</h2>
            <div className="text-slate-300 mt-4 space-y-3 leading-relaxed">
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict certain processing activities</li>
                <li>Export your data in a portable format</li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:privacy@vlayer.app" className="text-emerald-400 hover:text-emerald-300 underline">privacy@vlayer.app</a>.
                We will respond within 30 days.
              </p>
            </div>
          </section>

          {/* 7. Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">7. Cookies</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              We use essential cookies for authentication session management (Supabase Auth tokens). We do not use
              tracking cookies, advertising cookies, or third-party analytics cookies.
            </p>
          </section>

          {/* 8. Children */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">8. Children&apos;s Privacy</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              VLayer is not intended for use by individuals under 18 years of age. We do not knowingly collect personal
              information from children. If you believe we have inadvertently collected data from a minor, please contact
              us immediately.
            </p>
          </section>

          {/* 9. Changes */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">9. Changes to This Policy</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              We may update this Privacy Policy from time to time. Material changes will be communicated via email or a
              prominent notice on the Service. Your continued use after changes are posted constitutes acceptance of the
              revised policy.
            </p>
          </section>

          {/* 10. Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">10. Contact</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              For privacy-related inquiries, contact us at{' '}
              <a href="mailto:privacy@vlayer.app" className="text-emerald-400 hover:text-emerald-300 underline">privacy@vlayer.app</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
