import type { Metadata } from 'next';
import { AwsQualificationFlow } from '@/components/aws/AwsQualificationFlow';

export const metadata: Metadata = {
  title: 'AWS Evidence Fit Check',
  description: 'Check whether the vLayer AWS PHI evidence pilot matches your environment and evidence need.',
};

export default function AwsStartPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <AwsQualificationFlow />
    </section>
  );
}
