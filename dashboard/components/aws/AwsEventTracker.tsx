'use client';

import { useEffect } from 'react';
import { trackAwsValidationEvent } from '@/lib/aws-validation-client';
import type { AwsValidationEventName } from '@/lib/aws-validation';

export function AwsEventTracker({ eventName }: { eventName: AwsValidationEventName }) {
  useEffect(() => {
    void trackAwsValidationEvent(eventName);
  }, [eventName]);

  return null;
}
