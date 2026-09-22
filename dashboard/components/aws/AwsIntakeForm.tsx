'use client';

import { useState, type FormEvent } from 'react';
import {
  getAwsValidationAnswers,
  getAwsValidationAttribution,
  getAwsValidationSessionId,
} from '@/lib/aws-validation-client';
import { AWS_INTAKE_REVIEW_DUE, type AwsIntakeReviewDue } from '@/lib/aws-validation';

const REVIEW_DUE_LABELS: Record<AwsIntakeReviewDue, string> = {
  this_week: 'This week',
  this_month: 'This month',
  this_quarter: 'This quarter',
  no_date: 'No date yet',
};

const inputClassName =
  'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400';

export function AwsIntakeForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [reviewDue, setReviewDue] = useState<AwsIntakeReviewDue | ''>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!reviewDue) {
      setError('Select when the review is due.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/aws/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getAwsValidationSessionId(),
          email,
          company,
          review_due: reviewDue,
          note: note.trim().length > 0 ? note : undefined,
          answers: getAwsValidationAnswers(),
          attribution: getAwsValidationAttribution(),
        }),
      });

      if (response.status === 204) {
        setSubmitted(true);
        return;
      }

      const data = await response.json().catch(() => ({})) as { error?: unknown };
      setError(typeof data.error === 'string' ? data.error : 'The request could not be sent. Please try again.');
    } catch {
      setError('The request could not be sent. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-6 text-center text-sm leading-6 text-slate-200" role="status">
        Request received. Expect a reply within 1 business day.
      </div>
    );
  }

  return (
    <section aria-labelledby="aws-intake-heading" className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 sm:p-8">
      <h2 id="aws-intake-heading" className="text-xl font-semibold text-white">Not ready to pay yet?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Request the intake first. Simón replies within 1 business day with the scoping questions and the read-only collection script, and you decide then.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="aws-intake-email" className="text-sm font-medium text-slate-200">Work email</label>
          <input
            id="aws-intake-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="aws-intake-company" className="text-sm font-medium text-slate-200">Company</label>
          <input
            id="aws-intake-company"
            name="company"
            type="text"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={120}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="aws-intake-review-due" className="text-sm font-medium text-slate-200">When is the review due?</label>
          <select
            id="aws-intake-review-due"
            name="review_due"
            required
            value={reviewDue}
            onChange={(event) => setReviewDue(event.target.value as AwsIntakeReviewDue | '')}
            className={inputClassName}
          >
            <option value="" disabled>Select one</option>
            {AWS_INTAKE_REVIEW_DUE.map((value) => (
              <option key={value} value={value}>{REVIEW_DUE_LABELS[value]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="aws-intake-note" className="text-sm font-medium text-slate-200">Note <span className="font-normal text-slate-500">(optional)</span></label>
          <textarea
            id="aws-intake-note"
            name="note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClassName}
          />
          <p className="mt-1.5 text-xs text-slate-500">Do not include PHI, AWS account IDs, or credentials.</p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl border border-emerald-400/60 px-5 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-400/10 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? 'Sending…' : 'Request the pilot intake'}
        </button>
      </form>
    </section>
  );
}
