import type { Metadata } from 'next';
import Link from 'next/link';
import { AwsEventTracker } from '@/components/aws/AwsEventTracker';

export const metadata: Metadata = {
  title: 'PHI Infrastructure Evidence Report Preview',
  description: 'Preview how vLayer could turn AWS technical observations into reusable assurance evidence.',
};

const observations = [
  {
    control: 'RDS encryption at rest',
    observation: 'Storage encryption is enabled with a customer-managed KMS key.',
    source: 'RDS DescribeDBInstances + KMS DescribeKey',
    status: 'Observed',
  },
  {
    control: 'Database public exposure',
    observation: 'The database is not publicly accessible; ingress is restricted to the application security group.',
    source: 'RDS network attributes + EC2 security groups',
    status: 'Observed',
  },
  {
    control: 'Workload identity',
    observation: 'The ECS task uses an IAM role; no static AWS access keys appear in the task definition.',
    source: 'ECS task definition + IAM role policy',
    status: 'Observed',
  },
  {
    control: 'Administrative activity trail',
    observation: 'A multi-region CloudTrail trail is enabled with log file validation.',
    source: 'CloudTrail DescribeTrails + GetTrailStatus',
    status: 'Observed',
  },
  {
    control: 'Evidence bucket access logging',
    observation: 'No server access logging target was observed for the scoped S3 bucket.',
    source: 'S3 GetBucketLogging',
    status: 'Evidence gap',
  },
];

export default function AwsReportPreviewPage() {
  return (
    <>
      <AwsEventTracker eventName="report_preview" />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              Sample preview · illustrative data
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">PHI Infrastructure Evidence Report</h1>
            <p className="mt-2 text-slate-400">Patient API · Production · AWS us-east-1</p>
          </div>
          <Link href="/aws/early-access" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-400 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-300">
            Reserve a founding pilot
          </Link>
        </div>

        <article className="overflow-hidden rounded-2xl border border-slate-700 bg-[#f8fafc] text-slate-900 shadow-2xl shadow-black/30">
          <header className="border-b border-slate-200 bg-white px-6 py-7 sm:px-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">vLayer assurance evidence</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">Patient API · PHI workload</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">A reviewer-oriented record of declared scope, time-bound technical observations, supporting evidence sources, and limitations.</p>
              </div>
              <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs">
                <dt className="text-slate-500">Report ID</dt><dd className="font-mono font-semibold">VLR-AWS-0248</dd>
                <dt className="text-slate-500">Observed</dt><dd className="font-semibold">Sep 18, 2026</dd>
                <dt className="text-slate-500">Region</dt><dd className="font-semibold">us-east-1</dd>
              </dl>
            </div>
          </header>

          <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-10">
            <section>
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">1. Assurance summary</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="text-sm leading-7 text-slate-700">Four scoped safeguards were observed in AWS configuration. One evidence gap remains open. This result describes observable technical state only; it does not assert organization-wide HIPAA compliance.</p>
                <div className="flex gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center"><div className="text-2xl font-bold text-emerald-700">4</div><div className="text-xs text-emerald-800">Observed</div></div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center"><div className="text-2xl font-bold text-amber-700">1</div><div className="text-xs text-amber-800">Gap</div></div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">2. Declared PHI boundary</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  ['Entry', 'API Gateway', 'patient-api'],
                  ['Compute', 'Amazon ECS', 'patient-service'],
                  ['Database', 'Amazon RDS', 'patient-prod'],
                  ['Documents', 'Amazon S3', 'clinical-documents'],
                ].map(([label, service, resource]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                    <div className="mt-2 text-sm font-semibold">{service}</div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-500">{resource}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Boundary source: organization declaration, corroborated against observed resource relationships. No PHI contents are collected.</p>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">3. Technical observations and source evidence</h3>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[760px] w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-500">
                    <tr><th className="px-4 py-3 font-semibold">Safeguard</th><th className="px-4 py-3 font-semibold">Observation</th><th className="px-4 py-3 font-semibold">Evidence source</th><th className="px-4 py-3 font-semibold">Result</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {observations.map((item) => (
                      <tr key={item.control} className="align-top">
                        <td className="px-4 py-4 font-semibold text-slate-800">{item.control}</td>
                        <td className="px-4 py-4 leading-6 text-slate-600">{item.observation}</td>
                        <td className="px-4 py-4 font-mono text-xs leading-5 text-slate-500">{item.source}</td>
                        <td className="px-4 py-4">
                          <span className={item.status === 'Observed' ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800' : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800'}>{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-800">Reusable evidence index</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Each observation points to its source, capture time, scoped resource, normalized value, and evidence hash so it can be reused without losing provenance.</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="text-sm font-bold text-amber-900">Known limitations</h3>
                <p className="mt-2 text-sm leading-6 text-amber-900/75">This report does not evaluate policies, workforce behavior, BAAs, incident response effectiveness, or services outside the declared boundary.</p>
              </div>
            </section>
          </div>

          <footer className="border-t border-slate-200 bg-slate-100 px-6 py-4 text-center text-xs leading-5 text-slate-500 sm:px-10">
            Illustrative preview only. This is not evidence from your AWS account and is not a certification, attestation, legal opinion, or guarantee of HIPAA compliance.
          </footer>
        </article>

        <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-center sm:flex-row sm:text-left">
          <div><h2 className="text-xl font-semibold text-white">Would this make a customer review easier?</h2><p className="mt-1 text-sm leading-6 text-slate-400">The founding pilot turns one scoped workload into this evidence structure.</p></div>
          <Link href="/aws/early-access" className="shrink-0 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">See pilot pricing</Link>
        </div>
      </section>
    </>
  );
}
