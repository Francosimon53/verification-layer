import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hipaa2026Scanner } from './index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('HIPAA 2026 false-positive regressions', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hipaa2026-fp-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function scan(filename: string, content: string) {
    const file = path.join(tempDir, filename);
    await fs.writeFile(file, content, 'utf-8');
    return hipaa2026Scanner.scan([file], { path: tempDir });
  }

  it('does not treat metadata authors + PHI marketing copy as an MFA flow', async () => {
    const findings = await scan(
      'layout.tsx',
      `
export const metadata = {
  authors: [{ name: 'vlayer' }],
  description: 'Find PHI security risks before production',
};
      `,
    );

    expect(findings.some((f) => f.id === 'HIPAA-MFA-001')).toBe(false);
  });

  it('does not treat supabase.auth.signUp as a PHI login flow', async () => {
    const findings = await scan(
      'signup.ts',
      `
const result = await supabase.auth.signUp({ email, password });
const healthProfile = await createHealthProfile(result.data.user?.id);
      `,
    );

    expect(findings.some((f) => f.id === 'HIPAA-MFA-001')).toBe(false);
  });

  it('does not classify a single invalid-credentials response as a breach', async () => {
    const findings = await scan(
      'signin.ts',
      `
if (error) {
  return Response.json({ error: 'Invalid credentials' }, { status: 401 });
}
      `,
    );

    expect(findings.some((f) => f.id === 'HIPAA-BREACH-001')).toBe(false);
  });

  it('still detects repeated failed login attempts without monitoring', async () => {
    const findings = await scan(
      'auth-monitoring.ts',
      `
const failedLoginAttempts = getFailedLoginAttempts(user.id);
if (failedLoginAttempts > 5) {
  lockAccount(user.id);
}
      `,
    );

    expect(findings.some((f) => f.id === 'HIPAA-BREACH-001')).toBe(true);
  });
});
