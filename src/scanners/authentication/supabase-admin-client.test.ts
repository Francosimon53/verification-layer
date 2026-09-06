import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authenticationScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('MFA-001 Supabase non-auth client precision', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfa-supabase-admin-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const options = (): ScanOptions => ({ path: tempDir });

  it('does not flag a service-role Supabase client used only for database operations', async () => {
    const routeDir = path.join(tempDir, 'app', 'api', 'stripe', 'webhook');
    await fs.mkdir(routeDir, { recursive: true });
    const file = path.join(routeDir, 'route.ts');
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
  await supabaseAdmin.from('profiles').update({ plan: 'pro' }).eq('id', '123');
}
`,
      'utf-8'
    );

    const findings = await authenticationScanner.scan([file], options());
    expect(findings.filter((f) => f.id === 'MFA-001')).toHaveLength(0);
  });
});
