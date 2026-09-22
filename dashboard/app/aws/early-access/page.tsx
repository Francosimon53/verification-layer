import type { Metadata } from 'next';
import { AwsCheckoutCard } from '@/components/aws/AwsCheckoutCard';
import { AwsIntakeForm } from '@/components/aws/AwsIntakeForm';
import { AwsEventTracker } from '@/components/aws/AwsEventTracker';

export const metadata: Metadata = {
  title: 'AWS PHI Evidence Founding Pilot',
  description: 'Reserve a founding vLayer pilot for one scoped AWS PHI Infrastructure Evidence Report.',
};

const pilotTerms = [
  {
    label: 'Delivery',
    body: 'The report is delivered within 10 business days of agreeing the scope in writing.',
  },
  {
    label: 'Access',
    body: 'Option A — you run our read-only collection script (AWS CLI describe and get calls only) and send us the output. Option B — a read-only IAM role scoped to the agreed services. We never request write permissions, and no PHI contents are collected.',
  },
  {
    label: 'Who does the work',
    body: 'Simón Franco, founder of FPI Enterprises, Inc. (VLayer). You deal with the same person from intake to delivery.',
  },
  {
    label: 'Refund',
    body: 'If we cannot deliver the agreed pilot, the payment is refunded in full.',
  },
  {
    label: 'Format',
    body: 'The founding pilot runs entirely in writing — intake, scoping, questions and delivery. No calls are offered.',
  },
];

export default async function AwsEarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const checkoutState = params.checkout === 'success'
    ? 'success'
    : params.checkout === 'cancelled'
      ? 'cancelled'
      : null;

  return (
    <>
      <AwsEventTracker eventName="pricing_view" />
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:sticky lg:top-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Early access</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">One PHI workload, one reviewer-ready evidence report</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">The founding pilot is deliberately assisted. We agree one PHI workload, collect only the evidence required for that boundary, and produce the report you previewed.</p>

          <div className="mt-8 space-y-5 border-l border-slate-700 pl-5">
            <div><div className="text-sm font-semibold text-white">What you are paying for</div><div className="mt-1 text-sm leading-6 text-slate-400">A completed evidence outcome for one scoped AWS workload.</div></div>
            <div><div className="text-sm font-semibold text-white">What is not built yet</div><div className="mt-1 text-sm leading-6 text-slate-400">The self-serve AWS connector and continuous refresh workflow.</div></div>
            <div><div className="text-sm font-semibold text-white">What happens after payment</div><div className="mt-1 text-sm leading-6 text-slate-400">You receive a written intake to define scope and evidence access. No surprise sales call is required to reserve.</div></div>
          </div>
        </div>

        <div className="space-y-8">
          <section aria-labelledby="how-the-pilot-works" className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 sm:p-8">
            <h2 id="how-the-pilot-works" className="text-xl font-semibold text-white">How the pilot works</h2>
            <dl className="mt-5 space-y-5 text-sm leading-6 text-slate-300">
              {pilotTerms.map((item) => (
                <div key={item.label}>
                  <dt className="font-semibold text-white">{item.label}</dt>
                  <dd className="mt-1">{item.body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <AwsCheckoutCard checkoutState={checkoutState} />

          <AwsIntakeForm />
        </div>
      </section>
    </>
  );
}
