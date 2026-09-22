import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import type { AwsValidationEventName, AwsValidationEventSource } from '@/lib/aws-validation';

interface RecordAwsValidationEventInput {
  eventId: string;
  sessionId: string;
  eventName: AwsValidationEventName;
  source: AwsValidationEventSource;
  path: string;
  properties?: Record<string, unknown>;
}

export async function recordAwsValidationEvent(input: RecordAwsValidationEventInput): Promise<void> {
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from('aws_validation_events')
    .upsert(
      {
        event_id: input.eventId,
        session_id: input.sessionId,
        event_name: input.eventName,
        source: input.source,
        path: input.path,
        properties: input.properties ?? {},
      },
      {
        onConflict: 'session_id,event_name',
        ignoreDuplicates: true,
      }
    );

  if (error) {
    throw new Error(`Could not persist AWS validation event: ${error.message}`);
  }
}
