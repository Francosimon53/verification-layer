import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service - VLayer',
  description: 'VLayer Terms of Service. Read about our terms, liability limitations, and HIPAA disclaimer.',
};

export default function TermsOfServicePage() {
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
          <h1 className="text-3xl font-bold text-white mt-2">Terms of Service</h1>
          <p className="text-slate-400 mt-1">Last updated: February 14, 2026</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="prose prose-invert prose-slate max-w-none space-y-10">

          {/* 1. Acceptance */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">1. Acceptance of Terms</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              By accessing or using VLayer (&quot;the Service&quot;), operated by VLayer Inc. (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
              you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
              These terms apply to all users, including visitors, registered users, and paying subscribers.
            </p>
          </section>

          {/* 2. Description of Service */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">2. Description of Service</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              VLayer is a static analysis tool that scans source code repositories for potential HIPAA compliance issues.
              The Service is provided <strong className="text-white">&quot;as-is&quot;</strong> and <strong className="text-white">&quot;as-available&quot;</strong>.
              VLayer performs automated pattern matching and heuristic analysis to identify common compliance gaps. It is a
              developer productivity tool, not a substitute for professional legal counsel, manual code review, or a formal
              compliance audit.
            </p>
          </section>

          {/* 3. HIPAA Disclaimer */}
          <section>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-amber-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                3. HIPAA Disclaimer
              </h2>
              <p className="text-slate-300 mt-4 leading-relaxed">
                VLayer helps identify potential HIPAA violations in source code but <strong className="text-white">DOES NOT
                guarantee compliance</strong>. Use of this software does not constitute legal advice, a professional compliance
                assessment, or an official audit certification.
              </p>
              <p className="text-slate-300 mt-3 leading-relaxed">
                VLayer is <strong className="text-white">not a Business Associate</strong> under HIPAA definitions (45 CFR &sect; 160.103).
                VLayer does not create, receive, maintain, or transmit Protected Health Information (PHI) on behalf of any
                Covered Entity. Source code analysis occurs entirely within the user&apos;s own GitHub Actions runner environment;
                we receive only metadata such as findings, file paths, and compliance scores.
              </p>
              <p className="text-slate-300 mt-3 leading-relaxed">
                Users remain solely responsible for ensuring their applications comply with HIPAA, HITECH, and all applicable
                regulations. We strongly recommend engaging qualified legal and compliance professionals for formal assessments.
              </p>
            </div>
          </section>

          {/* 4. Subscriptions and Billing */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">4. Subscriptions and Billing</h2>
            <div className="text-slate-300 mt-4 space-y-3 leading-relaxed">
              <p>
                VLayer offers a free tier and paid subscription plans. The current Pro plan is priced at <strong className="text-white">$49
                per month</strong> (or discounted annual equivalent). Prices are subject to change with 30 days&apos; notice.
              </p>
              <p>
                Subscriptions are billed in advance on a recurring basis. You may cancel at any time through your account
                settings or Stripe billing portal. Cancellation takes effect at the end of the current billing period.
              </p>
              <p>
                <strong className="text-white">No partial refunds</strong> are issued for unused portions of a billing cycle.
                If you cancel mid-cycle, you retain access to paid features until the end of that period.
              </p>
              <p>
                All payments are processed by Stripe, Inc. We do not store credit card numbers or payment credentials on
                our servers.
              </p>
            </div>
          </section>

          {/* 5. Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">5. Intellectual Property</h2>
            <div className="text-slate-300 mt-4 space-y-3 leading-relaxed">
              <p>
                <strong className="text-white">Your Code:</strong> You retain all ownership rights to the source code you
                submit for analysis. VLayer does not claim any intellectual property rights over your repositories, code,
                or derivative works. As described in our Privacy Policy, we do not store your source code.
              </p>
              <p>
                <strong className="text-white">Our Software:</strong> The VLayer scanner, dashboard, algorithms, reports,
                documentation, and all associated trademarks are the exclusive property of VLayer Inc. You are granted a
                limited, non-exclusive, non-transferable license to use the Service for its intended purpose during the term
                of your subscription.
              </p>
              <p>
                You may not reverse-engineer, decompile, distribute, sublicense, or create derivative works of the VLayer
                software without our prior written consent.
              </p>
            </div>
          </section>

          {/* 6. Limitation of Liability */}
          <section>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-red-400">6. Limitation of Liability</h2>
              <div className="text-slate-300 mt-4 space-y-3 leading-relaxed">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL VLAYER INC., ITS OFFICERS,
                  DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                  CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, BUSINESS
                  OPPORTUNITIES, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Your use of or inability to use the Service;</li>
                  <li>Any findings, recommendations, or scores provided by the Service;</li>
                  <li>Unauthorized access to or alteration of your data or transmissions;</li>
                  <li>Any HIPAA violations, regulatory penalties, or compliance failures in your applications;</li>
                  <li>Any third-party conduct or content related to the Service.</li>
                </ul>
                <p className="font-semibold text-white">
                  THE TOTAL, AGGREGATE LIABILITY OF VLAYER INC. FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE
                  SHALL NOT EXCEED THE AMOUNT YOU HAVE PAID TO VLAYER IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING
                  THE EVENT GIVING RISE TO THE CLAIM, OR ONE HUNDRED U.S. DOLLARS ($100), WHICHEVER IS GREATER.
                </p>
                <p>
                  This limitation applies regardless of the legal theory on which the claim is based, whether in contract,
                  tort (including negligence), strict liability, or otherwise, even if VLayer has been advised of the
                  possibility of such damages.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Indemnification */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">7. Indemnification</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              You agree to indemnify, defend, and hold harmless VLayer Inc. and its officers, directors, employees, and
              agents from any claims, liabilities, damages, losses, and expenses (including reasonable attorneys&apos; fees)
              arising from your use of the Service, your violation of these Terms, or your violation of any third-party
              rights, including HIPAA or other regulatory requirements.
            </p>
          </section>

          {/* 8. Disclaimer of Warranties */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">8. Disclaimer of Warranties</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              NON-INFRINGEMENT, AND ACCURACY. VLAYER DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
              SECURE, OR THAT ANY DEFECTS WILL BE CORRECTED. VLAYER MAKES NO REPRESENTATIONS REGARDING THE COMPLETENESS
              OR ACCURACY OF SCAN RESULTS.
            </p>
          </section>

          {/* 9. Termination */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">9. Termination</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              We may suspend or terminate your access to the Service at any time, with or without cause, and with or
              without notice. Upon termination, your right to use the Service ceases immediately. Provisions that by their
              nature should survive termination shall survive, including Sections 5 through 8, and this Section 9.
            </p>
          </section>

          {/* 10. Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">10. Governing Law</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware,
              United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or the
              Service shall be resolved exclusively in the state or federal courts located in Delaware.
            </p>
          </section>

          {/* 11. Changes */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">11. Changes to These Terms</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              We reserve the right to modify these Terms at any time. Material changes will be communicated via email or
              a prominent notice on the Service at least 30 days before taking effect. Your continued use of the Service
              after such changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">12. Contact</h2>
            <p className="text-slate-300 mt-4 leading-relaxed">
              If you have questions about these Terms, contact us at{' '}
              <a href="mailto:legal@vlayer.app" className="text-emerald-400 hover:text-emerald-300 underline">legal@vlayer.app</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
