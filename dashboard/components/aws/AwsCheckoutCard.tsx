'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  getAwsValidationAnswers,
  getAwsValidationSessionId,
} from '@/lib/aws-validation-client';
import { AWS_PILOT_PRICE_LABEL } from '@/lib/aws-validation';

export function AwsCheckoutCard({ checkoutState }: { checkoutState: 'success' | 'cancelled' | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (loading) return;

    const answers = getAwsValidationAnswers();
    if (answers.usesAws !== true || answers.processesPhi !== true) {
      setError('Complete the 60-second fit check first so we can confirm this pilot matches your environment.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/aws/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getAwsValidationSessionId(),
          answers,
        }),
      });
      const data = await response.json() as { url?: unknown; error?: unknown };

      if (!response.ok || typeof data.url !== 'string') {
        setError(typeof data.error === 'string' ? data.error : 'Checkout could not be started. Please try again.');
        setLoading(false);
        return;
      }

      globalThis.location.assign(data.url);
    } catch {
      setError('Checkout could not be started. Please try again.');
      setLoading(false);
    }
  }

  if (checkoutState === 'success') {
    return (
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-white">Your founding pilot is reserved</h2>
        <p className="mt-3 leading-7 text-slate-300">Stripe will send your receipt. We will use the checkout email to send the pilot intake and agree the AWS scope before any evidence is collected.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-400/40 bg-slate-900 shadow-2xl shadow-emerald-950/30">
      <div className="border-b border-slate-800 bg-emerald-400/10 px-6 py-3 text-center text-sm font-semibold text-emerald-300">
        Founding pilot · limited initial cohort
      </div>
      <div className="p-7 sm:p-9">
        {checkoutState === 'cancelled' && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Checkout was cancelled. Nothing was charged.
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">AWS PHI Evidence Pilot</h2>
            <p className="mt-1 text-sm text-slate-400">One scoped workload · one-time payment</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-semibold tracking-tight text-white">{AWS_PILOT_PRICE_LABEL}</div>
            <div className="text-xs text-slate-500">USD</div>
          </div>
        </div>

        <ul className="mt-8 space-y-4 text-sm leading-6 text-slate-300">
          {[
            'PHI boundary and in-scope AWS services agreed before collection',
            'Technical observations tied to reusable source evidence',
            'Reviewer-ready assurance report with limitations and open gaps',
            'Evidence index for customer security reviews and procurement',
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm leading-6 text-slate-400">
          This is a paid founding pilot, not an automated scanner, certification, legal opinion, or guarantee of HIPAA compliance. If vLayer cannot deliver the agreed pilot, the payment will be refunded.
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}{' '}
            {error.startsWith('Complete') && <Link href="/aws/start" className="font-semibold underline">Start the fit check</Link>}
          </div>
        )}

        <button
          type="button"
          onClick={() => void startCheckout()}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-emerald-400 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? 'Opening secure checkout…' : `Reserve the pilot — ${AWS_PILOT_PRICE_LABEL}`}
        </button>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Secure payment by Stripe. By continuing, you agree to the <Link href="/legal/terms" className="underline hover:text-slate-300">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}
