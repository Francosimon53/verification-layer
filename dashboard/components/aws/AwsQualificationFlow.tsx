'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  saveAwsValidationAnswers,
  trackAwsValidationEvent,
} from '@/lib/aws-validation-client';
import type { AwsEvidenceReason, AwsValidationAnswers } from '@/lib/aws-validation';

type Step = 1 | 2 | 3 | 4 | 'disqualified';

const REASONS: Array<{ value: AwsEvidenceReason; label: string; detail: string }> = [
  {
    value: 'customer_security_review',
    label: 'Customer security review',
    detail: 'A buyer wants proof before moving forward.',
  },
  {
    value: 'sales_or_procurement',
    label: 'Sales or procurement',
    detail: 'Security evidence is slowing a contract or renewal.',
  },
  {
    value: 'audit_or_risk_review',
    label: 'Audit or internal risk review',
    detail: 'Your team needs defensible infrastructure evidence.',
  },
  {
    value: 'proactive_assurance',
    label: 'Proactive assurance',
    detail: 'You want an evidence pack ready before anyone asks.',
  },
];

function ChoiceButton({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-4 text-left transition hover:border-emerald-400/70 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
    >
      <span className="block font-semibold text-white">{label}</span>
      {detail && <span className="mt-1 block text-sm leading-6 text-slate-400">{detail}</span>}
    </button>
  );
}

export function AwsQualificationFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<AwsValidationAnswers>({});
  const [finishing, setFinishing] = useState(false);

  function updateAnswers(patch: AwsValidationAnswers): AwsValidationAnswers {
    const next = { ...answers, ...patch };
    setAnswers(next);
    saveAwsValidationAnswers(next);
    return next;
  }

  function answerAws(usesAws: boolean) {
    updateAnswers({ usesAws });
    if (!usesAws) {
      setStep('disqualified');
      return;
    }

    void trackAwsValidationEvent('aws_yes', { usesAws: true });
    setStep(2);
  }

  function answerPhi(processesPhi: boolean) {
    updateAnswers({ processesPhi });
    if (!processesPhi) {
      setStep('disqualified');
      return;
    }

    void trackAwsValidationEvent('phi_yes', { processesPhi: true });
    setStep(3);
  }

  function answerReason(evidenceReason: AwsEvidenceReason) {
    updateAnswers({ evidenceReason });
    setStep(4);
  }

  async function answerCustomerRequest(customerRequested: boolean) {
    if (finishing) return;
    setFinishing(true);
    updateAnswers({ customerRequested });

    if (customerRequested) {
      await Promise.race([
        trackAwsValidationEvent('active_evidence_request', { customerRequested: true }),
        new Promise<boolean>((resolve) => globalThis.setTimeout(() => resolve(false), 600)),
      ]);
    }

    router.push('/aws/report');
  }

  const numericStep = typeof step === 'number' ? step : 2;

  if (step === 'disqualified') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900/80 p-8 text-center shadow-2xl shadow-black/20">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-white">This pilot is intentionally narrow</h1>
        <p className="mt-3 leading-7 text-slate-400">
          The current experiment is only for teams running PHI workloads in AWS. We are keeping the scope narrow so the evidence is useful, not generic.
        </p>
        <Link href="/aws" className="mt-7 inline-flex font-semibold text-emerald-400 hover:text-emerald-300">
          Back to the AWS evidence overview
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between text-sm">
        <span className="font-medium text-emerald-400">60-second fit check</span>
        <span className="text-slate-500">{numericStep} of 4</span>
      </div>
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all duration-300"
          style={{ width: `${numericStep * 25}%` }}
        />
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 sm:p-9">
        {step === 1 && (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Environment</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Do you use AWS?</h1>
            <p className="mt-3 leading-7 text-slate-400">This validation is scoped to workloads running in Amazon Web Services.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ChoiceButton label="Yes" onClick={() => answerAws(true)} />
              <ChoiceButton label="No" onClick={() => answerAws(false)} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Data boundary</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Does this environment process PHI?</h1>
            <p className="mt-3 leading-7 text-slate-400">That includes storing, transmitting, or processing protected health information.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ChoiceButton label="Yes" onClick={() => answerPhi(true)} />
              <ChoiceButton label="No" onClick={() => answerPhi(false)} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence need</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Why do you need evidence?</h1>
            <p className="mt-3 leading-7 text-slate-400">Choose the closest match. No cloud access is requested in this experiment.</p>
            <div className="mt-8 space-y-3">
              {REASONS.map((reason) => (
                <ChoiceButton
                  key={reason.value}
                  label={reason.label}
                  detail={reason.detail}
                  onClick={() => answerReason(reason.value)}
                />
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Urgency</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Has a customer requested security evidence?</h1>
            <p className="mt-3 leading-7 text-slate-400">We use this only to understand how immediate the evidence gap is.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ChoiceButton label={finishing ? 'Opening preview…' : 'Yes'} onClick={() => void answerCustomerRequest(true)} />
              <ChoiceButton label={finishing ? 'Opening preview…' : 'Not yet'} onClick={() => void answerCustomerRequest(false)} />
            </div>
          </>
        )}
      </div>

      <p className="mt-5 text-center text-xs leading-5 text-slate-500">
        Do not enter PHI, account IDs, credentials, or architecture details. This fit check records only the choices shown above.
      </p>
    </div>
  );
}
