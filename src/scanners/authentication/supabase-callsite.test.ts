import { describe, it, expect, afterEach } from 'vitest';
import { authenticationScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('MFA-001 Supabase call-site precision', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not treat a shared-client signup route as provider MFA configuration', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'supabase-callsite-'));
    const file = path.join(tempDir, 'route.ts');

    await fs.writeFile(
      file,
      `
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: 'user@example.com',
    password: 'example-password',
  });
  return Response.json({ data, error });
}
`,
      'utf-8',
    );

    const options: ScanOptions = { path: tempDir };
    const findings = await authenticationScanner.scan([file], options);
    const mfaConfigFindings = findings.filter((finding) => finding.id === 'MFA-001');

    expect(mfaConfigFindings).toHaveLength(0);
  });

  it('does not treat a direct Supabase service client in an unrelated webhook as MFA config', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'supabase-webhook-'));
    const dir = path.join(tempDir, 'app', 'api', 'stripe', 'webhook');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'route.ts');

    await fs.writeFile(
      file,
      `
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function POST() {
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.from('profiles').update({ plan: 'pro' }).eq('id', 'user-id');
  return Response.json({ received: true });
}
`,
      'utf-8',
    );

    const options: ScanOptions = { path: tempDir };
    const findings = await authenticationScanner.scan([file], options);
    const mfaConfigFindings = findings.filter((finding) => finding.id === 'MFA-001');

    expect(mfaConfigFindings).toHaveLength(0);
  });
});
