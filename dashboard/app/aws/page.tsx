import { AwsEventTracker } from '@/components/aws/AwsEventTracker';
import { AwsStartButton } from '@/components/aws/AwsStartButton';

const reportRows = [
  { control: 'RDS encryption at rest', evidence: 'AWS API observation', status: 'Observed' },
  { control: 'Database public exposure', evidence: 'Network configuration', status: 'Observed' },
  { control: 'Workload identity', evidence: 'ECS task role', status: 'Observed' },
  { control: 'Evidence bucket logging', evidence: 'S3 configuration', status: 'Gap' },
];

export default function AwsLandingPage() {
  return (
    <>
      <AwsEventTracker eventName="landing_view" />

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(circle_at_28%_15%,rgba(52,211,153,0.14),transparent_42%),radial-gradient(circle_at_82%_20%,rgba(56,189,248,0.10),transparent_35%)]" />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
              AWS-first validation
            </div>
            <h1 className="mt-7 max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-white sm:text-6xl sm:leading-[1.05]">
              Prove how your PHI workloads are protected in AWS
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Turn the observable state of one AWS workload into reusable evidence for customer security reviews, procurement, and internal assurance.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <AwsStartButton />
              <span className="text-sm text-slate-500">No sign-in · no AWS access · 60 seconds</span>
            </div>
            <p className="mt-6 max-w-xl text-sm leading-6 text-slate-500">
              vLayer is testing an evidence product, not claiming certification. The fit check does not collect PHI, AWS account IDs, credentials, or architecture details.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Evidence report</div>
                <div className="mt-2 text-xl font-semibold text-white">Patient API · production</div>
                <div className="mt-1 text-sm text-slate-500">Illustrative preview · AWS us-east-1</div>
              </div>
              <span className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-300">PHI boundary</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-xs text-slate-500">Technical observations</div>
                <div className="mt-1 text-3xl font-semibold text-white">4</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-xs text-slate-500">Open evidence gaps</div>
                <div className="mt-1 text-3xl font-semibold text-amber-300">1</div>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
              {reportRows.map((row, index) => (
                <div key={row.control} className={`grid grid-cols-[1fr_auto] gap-4 p-3.5 ${index > 0 ? 'border-t border-slate-800' : ''}`}>
                  <div>
                    <div className="text-sm font-medium text-slate-200">{row.control}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{row.evidence}</div>
                  </div>
                  <span className={row.status === 'Gap'
                    ? 'self-center rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300'
                    : 'self-center rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300'}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">The output</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Evidence, not another compliance score</h2>
            <p className="mt-4 text-base leading-7 text-slate-400">A score tells you how a tool graded you. An evidence report shows a reviewer what was in scope, what was observed, where the source evidence came from, and what remains unproven.</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['1', 'Define the PHI boundary', 'Identify the workload and AWS services that store, process, or transmit PHI.'],
              ['2', 'Capture technical observations', 'Translate real configuration state into traceable, time-stamped evidence.'],
              ['3', 'Reuse the assurance report', 'Answer customer and procurement questions without rebuilding the proof each time.'],
            ].map(([number, title, description]) => (
              <div key={number} className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 text-sm font-semibold text-emerald-300">{number}</div>
                <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-white">Is evidence work slowing a live deal?</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-400">Answer four questions, inspect the report preview, and decide whether the founding pilot is worth paying for.</p>
        <div className="mt-8"><AwsStartButton /></div>
      </section>
    </>
  );
}
