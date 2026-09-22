import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import {
  AWS_VALIDATION_EXPERIMENT,
  isUuid,
} from '@/lib/aws-validation';
import { recordAwsValidationEvent } from '@/lib/aws-validation-server';
import { notifyFounder } from '@/lib/aws-validation-notify';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown signature error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.experiment === AWS_VALIDATION_EXPERIMENT) {
          const validationSessionId = session.metadata.aws_validation_session_id ?? session.client_reference_id;

          if (!isUuid(validationSessionId)) {
            console.error('AWS validation payment is missing a valid session ID:', session.id);
            break;
          }

          if (session.payment_status !== 'paid') {
            console.warn('AWS validation checkout completed without a paid status:', session.id);
            break;
          }

          await recordAwsValidationEvent({
            eventId: `stripe:${event.id}`,
            sessionId: validationSessionId,
            eventName: 'payment',
            source: 'stripe',
            path: '/api/webhooks/stripe',
            properties: {
              amountCents: session.amount_total,
              currency: session.currency,
              stripeCheckoutSessionId: session.id,
              paymentStatus: session.payment_status,
              evidenceReason: session.metadata.evidence_reason,
              activeEvidenceRequest: session.metadata.active_evidence_request === 'true',
            },
          });

          await notifyFounder(
            [
              'AWS PHI pilot: payment received',
              `amount: ${session.amount_total ?? 'unknown'} ${session.currency ?? ''}`.trim(),
              `evidence_reason: ${session.metadata.evidence_reason ?? 'not_provided'}`,
              `active_evidence_request: ${session.metadata.active_evidence_request ?? 'unknown'}`,
              `stripe_checkout_session: ${session.id}`,
            ].join('\n')
          );

          console.log('Recorded AWS validation payment:', session.id);
          break;
        }

        // Get the subscription details
        const subscriptionId = session.subscription as string;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = session.customer as string;

        // Find user by stripe_customer_id
        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!profile) {
          console.error('No profile found for customer:', customerId);
          break;
        }

        await adminSupabase
          .from('profiles')
          .update({
            plan: 'pro',
            subscription_id: subscriptionId,
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('id', profile.id);

        console.log('Activated Pro plan for user:', profile.id);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!profile) {
          console.error('No profile found for customer:', customerId);
          break;
        }

        const isActive = subscription.status === 'active' || subscription.status === 'trialing';

        await adminSupabase
          .from('profiles')
          .update({
            plan: isActive ? 'pro' : 'free',
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('id', profile.id);

        console.log('Updated subscription for user:', profile.id, 'status:', subscription.status);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!profile) break;

        await adminSupabase
          .from('profiles')
          .update({
            plan: 'free',
            subscription_id: null,
            subscription_status: 'canceled',
            current_period_end: null,
            trial_end: null,
            cancel_at_period_end: false,
          })
          .eq('id', profile.id);

        console.log('Reverted to Free plan for user:', profile.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!profile) break;

        await adminSupabase
          .from('profiles')
          .update({
            subscription_status: 'payment_failed',
          })
          .eq('id', profile.id);

        console.log('Payment failed for user:', profile.id);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
