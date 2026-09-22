import { NextRequest, NextResponse } from 'next/server';
import {
  isAwsIntakeReviewDue,
  isUuid,
  sanitizeAwsAnswers,
  sanitizeAwsAttribution,
} from '@/lib/aws-validation';
import { recordAwsValidationEvent } from '@/lib/aws-validation-server';
import { notifyFounder } from '@/lib/aws-validation-notify';
import { createAdminClient } from '@/lib/supabase/server';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const COMPANY_MIN_LENGTH = 2;
const COMPANY_MAX_LENGTH = 120;
const NOTE_MAX_LENGTH = 500;

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > 8_192) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const body = await req.json() as Record<string, unknown>;

    if (!isUuid(body.sessionId)) {
      return invalid('Invalid session identifier');
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (email.length === 0 || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
      return invalid('Enter a valid work email');
    }

    const company = typeof body.company === 'string' ? body.company.trim() : '';
    if (company.length < COMPANY_MIN_LENGTH || company.length > COMPANY_MAX_LENGTH) {
      return invalid(`Company must be ${COMPANY_MIN_LENGTH} to ${COMPANY_MAX_LENGTH} characters`);
    }

    if (!isAwsIntakeReviewDue(body.review_due)) {
      return invalid('Select when the review is due');
    }
    const reviewDue = body.review_due;

    let note: string | null = null;
    if (body.note !== undefined && body.note !== null) {
      if (typeof body.note !== 'string') return invalid('Note must be text');
      const trimmed = body.note.trim();
      if (trimmed.length > NOTE_MAX_LENGTH) {
        return invalid(`Note must be at most ${NOTE_MAX_LENGTH} characters`);
      }
      note = trimmed.length > 0 ? trimmed : null;
    }

    const answers = sanitizeAwsAnswers(body.answers);
    const attribution = sanitizeAwsAttribution(body.attribution);

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from('aws_validation_intakes')
      .insert({
        session_id: body.sessionId,
        email,
        company,
        review_due: reviewDue,
        note,
        answers,
        attribution,
      });

    if (error) {
      throw new Error(`Could not persist AWS pilot intake: ${error.message}`);
    }

    // The events table only receives non-identifying properties.
    await recordAwsValidationEvent({
      eventId: globalThis.crypto.randomUUID(),
      sessionId: body.sessionId,
      eventName: 'intake_requested',
      source: 'server',
      path: '/aws/early-access',
      properties: { review_due: reviewDue, ...answers, ...attribution },
    });

    await notifyFounder(
      [
        'AWS PHI pilot: intake requested',
        `company: ${company}`,
        `email: ${email}`,
        `review_due: ${reviewDue}`,
        `evidence_reason: ${answers.evidenceReason ?? 'not_provided'}`,
        `customer_requested: ${answers.customerRequested === undefined ? 'unknown' : String(answers.customerRequested)}`,
        `utm_source: ${attribution.utm_source ?? 'none'}`,
      ].join('\n')
    );

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    console.error('AWS pilot intake error:', error);
    return NextResponse.json({ error: 'Request could not be recorded' }, { status: 503 });
  }
}
