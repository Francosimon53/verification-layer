import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLANS } from '@/lib/stripe';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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

    // Get authenticated user (using anon key with cookies)
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('Error getting user:', userError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }

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

    console.log('Creating checkout session for user:', user.id, 'email:', user.email);
    console.log('Price ID:', priceId, 'Billing period:', billingPeriod);

    // Use admin client to bypass RLS for profile operations
    const adminSupabase = createAdminClient();

    // Check if user profile exists (using maybeSingle to handle no results)
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({
        error: 'Database error. Please try again.'
      }, { status: 500 });
    }

    let customerId = profile?.stripe_customer_id;

    // If no profile exists, create it
    if (!profile) {
      console.log('Profile does not exist for user:', user.id, '- creating new profile');

      const { data: newProfile, error: createError } = await adminSupabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          plan: 'free',
          created_at: new Date().toISOString(),
        })
        .select('id, stripe_customer_id')
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        // Continue anyway - we'll just not save the Stripe customer ID
      } else {
        console.log('Created new profile for user:', user.id);
      }
    }

    // Create or retrieve Stripe customer
    if (!customerId) {
      console.log('Creating new Stripe customer for user:', user.email);

      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
          source: 'vlayer_dashboard',
        },
      });

      customerId = customer.id;
      console.log('Created Stripe customer:', customerId);

      // Save Stripe customer ID to profile
      const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile with Stripe customer ID:', updateError);
        // Continue anyway - customer is created in Stripe
      } else {
        console.log('Updated profile with Stripe customer ID');
      }
    } else {
      console.log('Using existing Stripe customer:', customerId);
    }

    // Create Stripe checkout session
    console.log('Creating checkout session...');
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: PLANS.pro.trialDays,
        metadata: {
          supabase_user_id: user.id,
          plan: 'pro',
          billing_period: billingPeriod,
        },
      },
      success_url: `${req.nextUrl.origin}/?upgrade=success`,
      cancel_url: `${req.nextUrl.origin}/pricing?upgrade=cancelled`,
      allow_promotion_codes: true,
    });

    console.log('Checkout session created successfully:', session.id);
    console.log('Checkout URL:', session.url);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      raw: error.raw,
    });

    return NextResponse.json({
      error: error.message || 'Failed to create checkout session. Please try again.'
    }, { status: 500 });
  }
}
