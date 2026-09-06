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
});
