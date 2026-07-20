/**
 * Tests for Multi-Factor Authentication Scanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authenticationScanner } from './index.js';
import type { ScanOptions } from '../../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Authentication Scanner', () => {
  let tempDir: string = '';
  let testFiles: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'auth-test-'));
  });

  afterEach(async () => {
    // Cleanup
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore
      }
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    testFiles = [];
  });

  async function createTestFile(
    filename: string,
    content: string
  ): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    testFiles.push(filePath);
    return filePath;
  }

  const scanOptions: ScanOptions = {
    path: tempDir,
  };

  describe('MFA-001: Auth Configuration Without MFA', () => {
    it('should detect NextAuth without MFA', async () => {
      const file = await createTestFile(
        'auth.ts',
        `
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export default NextAuth({
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const user = await verifyCredentials(credentials);
        return user;
      }
    })
  ],
  session: {
    strategy: 'jwt'
  }
});
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-001');

      expect(mfaFindings.length).toBeGreaterThan(0);
      expect(mfaFindings[0].severity).toBe('critical');
      expect(mfaFindings[0].hipaaReference).toContain('164.312(d)');
    });

    it('should not flag NextAuth with MFA enabled', async () => {
      const file = await createTestFile(
        'auth-secure.ts',
        `
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export default NextAuth({
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "TOTP Code", type: "text" }
      },
      async authorize(credentials) {
        const user = await verifyCredentials(credentials);
        // Verify MFA
        if (user.mfaEnabled) {
          const validTotp = await verifyTotp(user.id, credentials.totpCode);
          if (!validTotp) return null;
        }
        return user;
      }
    })
  ],
  session: {
    strategy: 'jwt'
  }
});
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-001');

      expect(mfaFindings.length).toBe(0);
    });

    it('should detect Clerk configuration without MFA', async () => {
      const file = await createTestFile(
        'clerk-provider.tsx',
        `
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: '#000' }
      }}
    >
      {children}
    </ClerkProvider>
  );
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-001');

      expect(mfaFindings.length).toBeGreaterThan(0);
      expect(mfaFindings[0].severity).toBe('critical');
    });

    it('should detect Auth0 configuration without MFA', async () => {
      const file = await createTestFile(
        'auth0-config.ts',
        `
import { Auth0Provider } from '@auth0/auth0-react';

const Auth0Config = () => (
  <Auth0Provider
    domain="myapp.auth0.com"
    clientId="abc123"
    redirectUri={window.location.origin}
  >
    <App />
  </Auth0Provider>
);
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-001');

      expect(mfaFindings.length).toBeGreaterThan(0);
    });

    it('should detect Supabase Auth without MFA', async () => {
      const file = await createTestFile(
        'supabase-config.ts',
        `
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://myproject.supabase.co',
  'public-anon-key'
);

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-001');

      expect(mfaFindings.length).toBeGreaterThan(0);
    });
  });

  describe('MFA-002: Login Flow Without Second Factor', () => {
    it('should detect signIn with only email+password', async () => {
      const file = await createTestFile(
        'login.ts',
        `
export async function handleLogin(email: string, password: string) {
  const result = await signIn('credentials', {
    email,
    password,
    redirect: false,
  });

  if (result?.ok) {
    router.push('/dashboard');
  }
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-002');

      expect(mfaFindings.length).toBeGreaterThan(0);
      expect(mfaFindings[0].severity).toBe('high');
    });

    it('should detect login with credentials object', async () => {
      const file = await createTestFile(
        'auth-handler.ts',
        `
async function authenticate(credentials: { email: string; password: string }) {
  const user = await login(credentials);
  return user;
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-002');

      expect(mfaFindings.length).toBeGreaterThan(0);
    });

    it('should not flag login with MFA verification', async () => {
      const file = await createTestFile(
        'login-secure.ts',
        `
export async function handleLogin(
  email: string,
  password: string,
  mfaToken: string
) {
  const result = await signIn('credentials', {
    email,
    password,
    mfaToken,
    redirect: false,
  });

  if (result?.ok) {
    router.push('/dashboard');
  }
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-002');

      expect(mfaFindings.length).toBe(0);
    });

    it('should not flag login with TOTP code', async () => {
      const file = await createTestFile(
        'login-totp.ts',
        `
async function authenticate(email: string, password: string, totpCode: string) {
  const user = await verifyPassword(email, password);
  if (!user) return null;

  const validTotp = await verifyTotpCode(user.id, totpCode);
  if (!validTotp) return null;

  return user;
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-002');

      expect(mfaFindings.length).toBe(0);
    });
  });

  describe('MFA-003: MFA Bypass Detected', () => {
    it('should detect skipMfa function call', async () => {
      const file = await createTestFile(
        'bypass.ts',
        `
async function login(user: User) {
  if (process.env.NODE_ENV === 'development') {
    return skipMfa(user);
  }
  return requireMfaVerification(user);
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-003');

      expect(mfaFindings.length).toBeGreaterThan(0);
      expect(mfaFindings[0].severity).toBe('critical');
    });

    it('should detect bypassMfa in code', async () => {
      const file = await createTestFile(
        'bypass-func.ts',
        `
function authenticate(user: User, bypassMfa = false) {
  if (bypassMfa) {
    return grantAccess(user);
  }
  return checkMfaAndGrant(user);
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-003');

      expect(mfaFindings.length).toBeGreaterThan(0);
    });

    it('should detect mfaEnabled=false', async () => {
      const file = await createTestFile(
        'config-bypass.ts',
        `
const authConfig = {
  providers: ['google', 'github'],
  mfaEnabled: false,
  sessionTimeout: 3600
};
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-003');

      expect(mfaFindings.length).toBeGreaterThan(0);
    });

    it('should detect requireMfa=false', async () => {
      const file = await createTestFile(
        'mfa-disabled.ts',
        `
export const authOptions = {
  requireMfa: false,
  allowPasswordReset: true
};
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-003');

      expect(mfaFindings.length).toBeGreaterThan(0);
    });

    it('should detect environment-based MFA bypass', async () => {
      const file = await createTestFile(
        'env-bypass.ts',
        `
const mfaRequired = !process.env.SKIP_MFA;

if (process.env.DISABLE_MFA === 'true') {
  console.log('MFA disabled');
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-003');

      expect(mfaFindings.length).toBeGreaterThan(0);
    });

    it('should not flag MFA bypass in test files', async () => {
      const file = await createTestFile(
        'auth.test.ts',
        `
describe('Auth', () => {
  it('should allow skipMfa in tests', () => {
    const user = skipMfa(testUser);
    expect(user).toBeDefined();
  });
});
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-003');

      expect(mfaFindings.length).toBe(0);
    });

    it('should not flag MFA bypass in error messages', async () => {
      const file = await createTestFile(
        'error-handler.ts',
        `
function validateMfa(user: User) {
  if (!user.mfaEnabled) {
    throw new Error('MFA is disabled for this user. Please contact admin.');
  }
  console.warn('User has mfaEnabled: false in profile');
}
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-003');

      expect(mfaFindings.length).toBe(0);
    });
  });

  describe('General Scanner Behavior', () => {
    it('should only scan relevant file types', async () => {
      await createTestFile('README.md', 'signIn(email, password)');
      await createTestFile('data.json', '{"mfaEnabled": false}');
      await createTestFile('code.ts', 'const user = signIn(email, password);');

      const findings = await authenticationScanner.scan(
        testFiles,
        scanOptions
      );

      // Should only find findings in .ts file
      const mdFindings = findings.filter((f) => f.file.endsWith('.md'));
      expect(mdFindings.length).toBe(0);
    });

    it('should skip comment lines', async () => {
      const file = await createTestFile(
        'commented.ts',
        `
// This is how to skipMfa (don't do this!)
/*
 * bypassMfa should never be used
 */
const validCode = true;
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);
      const mfaFindings = findings.filter((f) => f.id === 'MFA-003');

      expect(mfaFindings.length).toBe(0);
    });

    it('should include confidence scores', async () => {
      const file = await createTestFile(
        'test.ts',
        `
const config = {
  mfaEnabled: false
};
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);

      for (const finding of findings) {
        expect(finding.confidence).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(finding.confidence);
      }
    });

    it('should include proper HIPAA references', async () => {
      const file = await createTestFile(
        'auth.ts',
        `
export default NextAuth({
  providers: [
    CredentialsProvider({
      credentials: { email: {}, password: {} }
    })
  ]
});
        `
      );

      const findings = await authenticationScanner.scan([file], scanOptions);

      for (const finding of findings) {
        expect(finding.hipaaReference).toBeDefined();
        expect(finding.hipaaReference).toContain('164.312(d)');
      }
    });
  });
});
