import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLANS } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // Validate Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      console.error('Stripe secret key not configured');
      return NextResponse.json({
        error: 'Stripe is not configured. Please contact support.'
      }, { status: 500 });
    }

    if (!process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_MONTHLY_PRICE_ID.startsWith('price_your-')) {
      console.error('Stripe price ID not configured');
      return NextResponse.json({
        error: 'Pricing is not configured. Please contact support.'
      }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { billingPeriod = 'monthly' } = await req.json();

    const priceId = billingPeriod === 'annual'
      ? PLANS.pro.annualPriceId
      : PLANS.pro.monthlyPriceId;

    if (!priceId) {
      console.error('Price ID is undefined for billing period:', billingPeriod);
      return NextResponse.json({ error: 'Price ID not configured' }, { status: 500 });
    }

    console.log('Creating checkout session for user:', user.id, 'with price:', priceId);

    // Check if user already has a Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      // If profiles table doesn't exist or user doesn't have a profile, create customer anyway
    }

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      console.log('Creating new Stripe customer for user:', user.email);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      console.log('Created Stripe customer:', customerId);

      // Try to update profile, but don't fail if table doesn't exist
      try {
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id);
      } catch (updateError) {
        console.warn('Could not update profile with Stripe customer ID:', updateError);
      }
    }

    console.log('Creating checkout session with customer:', customerId);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: PLANS.pro.trialDays,
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${req.nextUrl.origin}/?upgrade=success`,
      cancel_url: `${req.nextUrl.origin}/pricing?upgrade=cancelled`,
      allow_promotion_codes: true,
    });

    console.log('Checkout session created:', session.id);
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
    });
    return NextResponse.json({
      error: error.message || 'Failed to create checkout session. Please try again.'
    }, { status: 500 });
  }
}
