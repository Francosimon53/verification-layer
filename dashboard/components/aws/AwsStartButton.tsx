'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackAwsValidationEvent } from '@/lib/aws-validation-client';

export function AwsStartButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleStart() {
    if (pending) return;
    setPending(true);

    await Promise.race([
      trackAwsValidationEvent('start_clicked'),
      new Promise<boolean>((resolve) => globalThis.setTimeout(() => resolve(false), 600)),
    ]);

    router.push('/aws/start');
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={pending}
      className={compact
        ? 'rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-70'
        : 'inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:translate-y-0 disabled:opacity-70'}
    >
      {pending ? 'Opening…' : 'See if this fits your AWS environment'}
    </button>
  );
}
