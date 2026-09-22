import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import {
  AWS_PILOT_PRICE_CENTS,
  AWS_VALIDATION_EXPERIMENT,
  isUuid,
  sanitizeAwsAnswers,
} from '@/lib/aws-validation';
import { recordAwsValidationEvent } from '@/lib/aws-validation-server';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return NextResponse.json({ error: 'Checkout is not configured yet.' }, { status: 503 });
    }

    const body = await req.json() as Record<string, unknown>;
    if (!isUuid(body.sessionId)) {
      return NextResponse.json({ error: 'Invalid validation session.' }, { status: 400 });
    }

    const answers = sanitizeAwsAnswers(body.answers);
    if (answers.usesAws !== true || answers.processesPhi !== true) {
      return NextResponse.json(
        { error: 'Complete the AWS and PHI fit check before reserving a pilot.' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_creation: 'always',
      client_reference_id: body.sessionId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: AWS_PILOT_PRICE_CENTS,
            product_data: {
              name: 'vLayer Founding PHI Evidence Pilot',
              description: 'One scoped AWS PHI Infrastructure Evidence Report and reusable evidence pack.',
            },
          },
        },
      ],
      metadata: {
        experiment: AWS_VALIDATION_EXPERIMENT,
        aws_validation_session_id: body.sessionId,
        evidence_reason: answers.evidenceReason ?? 'not_provided',
        active_evidence_request: String(answers.customerRequested === true),
      },
      payment_intent_data: {
        metadata: {
          experiment: AWS_VALIDATION_EXPERIMENT,
          aws_validation_session_id: body.sessionId,
        },
      },
      success_url: `${req.nextUrl.origin}/aws/early-access?checkout=success`,
      cancel_url: `${req.nextUrl.origin}/aws/early-access?checkout=cancelled`,
      custom_text: {
        submit: {
          message: 'Your payment reserves a founding pilot. If vLayer cannot deliver the agreed pilot, it will be refunded.',
        },
      },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    try {
      await recordAwsValidationEvent({
        eventId: `checkout:${session.id}`,
        sessionId: body.sessionId,
        eventName: 'checkout_started',
        source: 'server',
        path: '/aws/early-access',
        properties: {
          amountCents: AWS_PILOT_PRICE_CENTS,
          currency: 'usd',
          stripeCheckoutSessionId: session.id,
          ...answers,
        },
      });
    } catch (eventError: unknown) {
      // Do not block a real buyer after Stripe has created a valid session.
      console.error('Checkout created but checkout_started was not persisted:', eventError);
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('AWS validation checkout error:', error);
    return NextResponse.json({ error: 'Checkout could not be started. Please try again.' }, { status: 500 });
  }
}
