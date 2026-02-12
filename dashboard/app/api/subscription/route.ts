import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('plan, subscription_status, current_period_end, trial_end, cancel_at_period_end')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({
        plan: 'free',
        status: 'none',
        trialEnd: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    return NextResponse.json({
      plan: profile.plan || 'free',
      status: profile.subscription_status || 'none',
      trialEnd: profile.trial_end,
      currentPeriodEnd: profile.current_period_end,
      cancelAtPeriodEnd: profile.cancel_at_period_end || false,
    });
  } catch (error: any) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}
