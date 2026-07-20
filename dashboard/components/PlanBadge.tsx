'use client';

import { useEffect, useState } from 'react';
import { fetchSubscription, isPro, getTrialDaysLeft, type UserSubscription } from '@/lib/plans';
import Link from 'next/link';

export function PlanBadge() {
  const [sub, setSub] = useState<UserSubscription | null>(null);

  useEffect(() => {
    fetchSubscription().then(setSub);
  }, []);

  if (!sub) return null;

  const pro = isPro(sub);
  const trialDays = getTrialDaysLeft(sub);

  if (sub.status === 'payment_failed') {
    return (
      <Link href="/settings" className="block px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
        <span className="text-xs font-medium text-red-400">Payment Failed</span>
      </Link>
    );
  }

  if (pro && trialDays !== null) {
    return (
      <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
        <span className="text-xs font-medium text-emerald-400">Pro Trial</span>
        <span className="text-xs text-slate-400 ml-1">{trialDays}d left</span>
      </div>
    );
  }

  if (pro) {
    return (
      <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
        <span className="text-xs font-semibold text-emerald-400">Pro</span>
      </div>
    );
  }

  return (
    <Link href="/pricing" className="block px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-center hover:bg-slate-700 transition-colors">
      <span className="text-xs font-medium text-slate-400">Free</span>
      <span className="text-xs text-emerald-400 ml-1">Upgrade</span>
    </Link>
  );
}
