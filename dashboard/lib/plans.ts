import { createClient } from '@/lib/supabase/client';

export type Plan = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'none' | 'active' | 'trialing' | 'canceled' | 'past_due' | 'payment_failed';

export interface UserSubscription {
  plan: Plan;
  status: SubscriptionStatus;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const PRO_FEATURES = [
  'pdf_reports',
  'hipaa_templates',
  'team_members',
  'custom_rules',
  'scan_history_full',
  'github_integration',
  'slack_integration',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export function isPro(subscription: UserSubscription | null): boolean {
  if (!subscription) return false;
  return subscription.plan === 'pro' && (subscription.status === 'active' || subscription.status === 'trialing');
}

export function canAccess(feature: ProFeature, subscription: UserSubscription | null): boolean {
  return isPro(subscription);
}

export function getTrialDaysLeft(subscription: UserSubscription | null): number | null {
  if (!subscription || subscription.status !== 'trialing' || !subscription.trialEnd) return null;
  const now = new Date();
  const end = new Date(subscription.trialEnd);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export async function fetchSubscription(): Promise<UserSubscription> {
  try {
    const res = await fetch('/api/subscription');
    if (!res.ok) return { plan: 'free', status: 'none', trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    return await res.json();
  } catch {
    return { plan: 'free', status: 'none', trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }
}
