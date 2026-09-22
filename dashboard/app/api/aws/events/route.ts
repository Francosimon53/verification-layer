import { NextRequest, NextResponse } from 'next/server';
import {
  isAwsValidationEventName,
  isUuid,
  sanitizeEventProperties,
} from '@/lib/aws-validation';
import { recordAwsValidationEvent } from '@/lib/aws-validation-server';

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
    if (!isUuid(body.eventId) || !isUuid(body.sessionId)) {
      return NextResponse.json({ error: 'Invalid event identifiers' }, { status: 400 });
    }

    if (!isAwsValidationEventName(body.eventName)) {
      return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
    }

    if (typeof body.path !== 'string' || !body.path.startsWith('/aws') || body.path.length > 128) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    await recordAwsValidationEvent({
      eventId: body.eventId,
      sessionId: body.sessionId,
      eventName: body.eventName,
      source: 'browser',
      path: body.path,
      properties: sanitizeEventProperties(body.properties),
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    console.error('AWS validation event error:', error);
    return NextResponse.json({ error: 'Event could not be recorded' }, { status: 503 });
  }
}
