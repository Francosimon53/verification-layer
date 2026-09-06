import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authenticationScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('MFA-001 Supabase call-site precision', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfa-supabase-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const scanOptions = (): ScanOptions => ({ path: tempDir });

  it('does not treat supabase.auth.signUp as provider-level MFA configuration', async () => {
    const file = path.join(tempDir, 'signup-route.ts');
    await fs.writeFile(
      file,
      `
export async function signup(supabase, email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}
`,
      'utf-8'
    );

    const findings = await authenticationScanner.scan([file], scanOptions());
    expect(findings.filter((f) => f.id === 'MFA-001')).toHaveLength(0);
  });

  it('still detects explicit NextAuth configuration without MFA', async () => {
    const file = path.join(tempDir, 'auth.ts');
    await fs.writeFile(
      file,
      `
export default NextAuth({
  providers: [],
  session: { strategy: 'jwt' }
});
`,
      'utf-8'
    );

    const findings = await authenticationScanner.scan([file], scanOptions());
    expect(findings.some((f) => f.id === 'MFA-001')).toBe(true);
  });
});
