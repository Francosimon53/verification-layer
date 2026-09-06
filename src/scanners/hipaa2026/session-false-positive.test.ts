import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { hipaa2026Scanner } from './index.js';

let tempDir = '';

async function scanFile(name: string, content: string) {
  const file = path.join(tempDir, name);
  await fs.writeFile(file, content, 'utf-8');
  return hipaa2026Scanner.scan([file], { path: tempDir });
}

describe('HIPAA-SESSION-001 false-positive regression', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vlayer-session-regression-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('does not treat Supabase client/auth usage as local session configuration', async () => {
    const findings = await scanFile(
      'supabase.ts',
      `
import { createBrowserClient } from '@supabase/ssr';
const supabase = createBrowserClient(url, key);
const { data } = await supabase.auth.getUser();
      `,
    );

    expect(findings.filter((finding) => finding.id === 'HIPAA-SESSION-001')).toHaveLength(0);
  });

  it('does not treat Stripe Checkout Session as an authentication session', async () => {
    const findings = await scanFile(
      'stripe.ts',
      `
const session = await stripe.checkout.sessions.create({ mode: 'subscription' });
if (event.type === 'checkout.session.completed') {
  const checkoutSession = event.data.object;
  console.log(checkoutSession.id);
}
      `,
    );

    expect(findings.filter((finding) => finding.id === 'HIPAA-SESSION-001')).toHaveLength(0);
  });

  it('still detects express-session configuration without a timeout', async () => {
    const findings = await scanFile(
      'server.ts',
      `
import session from 'express-session';
app.use(session({ secret: process.env.SESSION_SECRET, resave: false }));
      `,
    );

    expect(findings.some((finding) => finding.id === 'HIPAA-SESSION-001')).toBe(true);
  });
});
