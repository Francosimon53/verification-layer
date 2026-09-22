import type { Metadata } from 'next';
import { AwsCheckoutCard } from '@/components/aws/AwsCheckoutCard';
import { AwsEventTracker } from '@/components/aws/AwsEventTracker';

export const metadata: Metadata = {
  title: 'AWS PHI Evidence Founding Pilot',
  description: 'Reserve a founding vLayer pilot for one scoped AWS PHI Infrastructure Evidence Report.',
};

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
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">Buy the evidence outcome before we build the full connector</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">The founding pilot is deliberately assisted. We agree one PHI workload, collect only the evidence required for that boundary, and produce the report you previewed.</p>

          <div className="mt-8 space-y-5 border-l border-slate-700 pl-5">
            <div><div className="text-sm font-semibold text-white">What you are paying for</div><div className="mt-1 text-sm leading-6 text-slate-400">A completed evidence outcome for one scoped AWS workload.</div></div>
            <div><div className="text-sm font-semibold text-white">What is not built yet</div><div className="mt-1 text-sm leading-6 text-slate-400">The self-serve AWS connector and continuous refresh workflow.</div></div>
            <div><div className="text-sm font-semibold text-white">What happens after payment</div><div className="mt-1 text-sm leading-6 text-slate-400">You receive a written intake to define scope and evidence access. No surprise sales call is required to reserve.</div></div>
          </div>
        </div>

        <AwsCheckoutCard checkoutState={checkoutState} />
      </section>
    </>
  );
}
